import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";
import {
  getWebAuthnOrigin,
  getWebAuthnRpId,
  getWebAuthnRpName,
} from "@/server/webauthn-config";

const CHALLENGE_TTL_MINUTES = 10;

async function storeWebAuthnChallenge(
  userId: string,
  purpose: string,
  challenge: string,
) {
  const sql = getSql();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60 * 1000);
  await sql`
    DELETE FROM webauthn_challenges
    WHERE user_id = ${userId} AND purpose = ${purpose}
  `;
  await sql`
    INSERT INTO webauthn_challenges (user_id, purpose, challenge, expires_at)
    VALUES (${userId}, ${purpose}, ${challenge}, ${expiresAt})
  `;
}

async function consumeWebAuthnChallenge(userId: string, purpose: string) {
  const sql = getSql();
  const [row] = await sql<
    { id: string; challenge: string; expires_at: Date }[]
  >`
    SELECT id, challenge, expires_at
    FROM webauthn_challenges
    WHERE user_id = ${userId} AND purpose = ${purpose}
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE
  `;

  if (!row) {
    throw new ApiError(404, "WEBAUTHN_CHALLENGE_MISSING", "WebAuthn challenge lejárt");
  }
  if (row.expires_at.getTime() <= Date.now()) {
    await sql`DELETE FROM webauthn_challenges WHERE id = ${row.id}`;
    throw new ApiError(410, "WEBAUTHN_CHALLENGE_EXPIRED", "WebAuthn challenge lejárt");
  }

  await sql`DELETE FROM webauthn_challenges WHERE id = ${row.id}`;
  return row.challenge;
}

export async function userHasPasskey(userId: string): Promise<boolean> {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    SELECT id FROM passkey_credentials WHERE user_id = ${userId} LIMIT 1
  `;
  return Boolean(row);
}

export async function createPasskeyRegistrationOptions(userId: string, email: string) {
  const sql = getSql();
  const existing = await sql<{ credential_id: string }[]>`
    SELECT credential_id FROM passkey_credentials WHERE user_id = ${userId}
  `;

  const options = await generateRegistrationOptions({
    rpName: getWebAuthnRpName(),
    rpID: getWebAuthnRpId(),
    userName: email,
    userID: new TextEncoder().encode(userId),
    userDisplayName: email,
    excludeCredentials: existing.map((row) => ({
      id: row.credential_id,
      transports: ["internal", "hybrid"],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  await storeWebAuthnChallenge(userId, "register", options.challenge);
  return options;
}

export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
) {
  const expectedChallenge = await consumeWebAuthnChallenge(userId, "register");
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getWebAuthnOrigin(),
    expectedRPID: getWebAuthnRpId(),
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new ApiError(422, "PASSKEY_INVALID", "Passkey regisztráció sikertelen");
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  const sql = getSql();
  await sql`
    INSERT INTO passkey_credentials (user_id, credential_id, public_key, counter)
    VALUES (
      ${userId},
      ${credential.id},
      ${Buffer.from(credential.publicKey)},
      ${credential.counter}
    )
    ON CONFLICT (credential_id) DO NOTHING
  `;

  return {
    registered: true as const,
    credential_device_type: credentialDeviceType,
    credential_backed_up: credentialBackedUp,
  };
}

export async function createPasskeyAuthenticationOptions(
  userId: string,
  webAuthnChallenge: string,
) {
  const sql = getSql();
  const credentials = await sql<
    { credential_id: string; public_key: Buffer; counter: string }[]
  >`
    SELECT credential_id, public_key, counter::text
    FROM passkey_credentials
    WHERE user_id = ${userId}
  `;

  if (credentials.length === 0) {
    throw new ApiError(403, "PASSKEY_REQUIRED", "Előbb regisztrálj Passkey-t");
  }

  const options = await generateAuthenticationOptions({
    rpID: getWebAuthnRpId(),
    challenge: webAuthnChallenge,
    userVerification: "required",
    allowCredentials: credentials.map((row) => ({
      id: row.credential_id,
      transports: ["internal", "hybrid"],
    })),
  });

  return options;
}

export async function verifyPasskeyAuthentication(
  userId: string,
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
) {
  const sql = getSql();
  const [credential] = await sql<
    { id: string; credential_id: string; public_key: Buffer; counter: string }[]
  >`
    SELECT id, credential_id, public_key, counter::text
    FROM passkey_credentials
    WHERE user_id = ${userId} AND credential_id = ${response.id}
    LIMIT 1
  `;

  if (!credential) {
    throw new ApiError(422, "PASSKEY_INVALID", "Ismeretlen Passkey");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getWebAuthnOrigin(),
    expectedRPID: getWebAuthnRpId(),
    credential: {
      id: credential.credential_id,
      publicKey: new Uint8Array(credential.public_key),
      counter: Number(credential.counter),
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    throw new ApiError(422, "PASSKEY_INVALID", "Passkey ellenőrzés sikertelen");
  }

  const newCounter = verification.authenticationInfo.newCounter;
  await sql`
    UPDATE passkey_credentials
    SET counter = ${newCounter}
    WHERE id = ${credential.id}
  `;

  return { verified: true as const };
}
