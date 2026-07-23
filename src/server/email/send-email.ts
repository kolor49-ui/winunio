import { Resend } from "resend";
import { readEnv } from "@/server/env";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getResendClient(): Resend | null {
  const apiKey = readEnv("RESEND_API_KEY");
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getEmailFrom(): string {
  const configured = readEnv("EMAIL_FROM");
  if (configured) return configured;
  return "onboarding@resend.dev";
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const resend = getResendClient();

  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY nincs beállítva — levél nem lett elküldve:",
      input.subject,
      "→",
      input.to,
    );
    console.warn("[email] Szöveg:", input.text);
    return;
  }

  const from = getEmailFrom();
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    console.error("[email] Resend hiba:", error);
    throw new Error(
      `RESEND_FAILED:${error.statusCode ?? 500}:${JSON.stringify(error)}`,
    );
  }

  if (!data?.id) {
    throw new Error("RESEND_FAILED:500:{\"message\":\"No email id returned\"}");
  }
}

export function verificationEmailContent(verifyUrl: string) {
  const subject = "Erősítsd meg a Winunio e-mail címed";
  const text = [
    "Szia!",
    "",
    "Kattints az alábbi linkre az e-mail címed megerősítéséhez:",
    verifyUrl,
    "",
    "A link 24 óráig érvényes.",
    "",
    "Ha nem te regisztráltál, hagyd figyelmen kívül ezt a levelet.",
  ].join("\n");

  const html = `
    <p>Szia!</p>
    <p>Kattints az alábbi gombra az e-mail címed megerősítéséhez:</p>
    <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#4a5568;color:#fff;text-decoration:none;border-radius:6px;">E-mail megerősítése</a></p>
    <p style="font-size:13px;color:#666;">Vagy másold be ezt a linket: ${verifyUrl}</p>
    <p style="font-size:13px;color:#666;">A link 24 óráig érvényes.</p>
    <p style="font-size:13px;color:#666;">Ha nem te regisztráltál, hagyd figyelmen kívül ezt a levelet.</p>
  `.trim();

  return { subject, text, html };
}

export function passwordResetEmailContent(resetUrl: string) {
  const subject = "Winunio jelszó visszaállítás";
  const text = [
    "Szia!",
    "",
    "Jelszó-visszaállítást kértél. Kattints az alábbi linkre:",
    resetUrl,
    "",
    "A link 1 óráig érvényes.",
    "",
    "Ha nem te kérted, hagyd figyelmen kívül ezt a levelet.",
  ].join("\n");

  const html = `
    <p>Szia!</p>
    <p>Jelszó-visszaállítást kértél. Kattints az alábbi gombra:</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#4a5568;color:#fff;text-decoration:none;border-radius:6px;">Új jelszó beállítása</a></p>
    <p style="font-size:13px;color:#666;">Vagy másold be ezt a linket: ${resetUrl}</p>
    <p style="font-size:13px;color:#666;">A link 1 óráig érvényes.</p>
    <p style="font-size:13px;color:#666;">Ha nem te kérted, hagyd figyelmen kívül ezt a levelet.</p>
  `.trim();

  return { subject, text, html };
}

export function roundDeadlineReminderEmailContent(input: {
  question: string;
  roundNumber: number;
  deadlineAt: string;
}) {
  const deadlineLabel = new Date(input.deadlineAt).toLocaleString("hu-HU");
  const subject = `Winunio — ${input.roundNumber}. forduló határidő emlékeztető`;
  const text = [
    "Szia!",
    "",
    `A „${input.question}” vitában a ${input.roundNumber}. forduló válaszadási határideje közeledik.`,
    `Határidő: ${deadlineLabel}`,
    "",
    "Jelentkezz be a Winunio-ra, és küldd be a válaszod időben.",
  ].join("\n");

  const html = `
    <p>Szia!</p>
    <p>A <strong>${input.question}</strong> vitában a ${input.roundNumber}. forduló válaszadási határideje közeledik.</p>
    <p>Határidő: <strong>${deadlineLabel}</strong></p>
    <p>Jelentkezz be a Winunio-ra, és küldd be a válaszod időben.</p>
  `.trim();

  return { subject, text, html };
}

export function formatResendError(error: unknown): string {
  if (!(error instanceof Error)) return "Ismeretlen e-mail hiba";
  const msg = error.message;
  if (msg.includes("only send testing emails")) {
    return "Sandbox: csak a Resend-fiókod e-mail címére megy a levél. Éles oldalon verified winunio.com domain kell.";
  }
  if (msg.includes("invalid") || msg.includes("401")) {
    return "Érvénytelen Resend API kulcs — ellenőrizd a .env fájlt, majd indítsd újra a szervert.";
  }
  return "Nem sikerült elküldeni a levelet. Próbáld újra pár perc múlva.";
}
