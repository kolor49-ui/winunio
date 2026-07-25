import { describe, expect, it } from "vitest";
import {
  isDatabaseConfigError,
  isTransientDbError,
  withDbRetry,
} from "@/server/db";

describe("db retry helpers", () => {
  it("detects missing DATABASE_URL config errors", () => {
    expect(isDatabaseConfigError(new Error("DATABASE_URL is not set"))).toBe(
      true,
    );
    expect(isDatabaseConfigError(new Error("connection timeout"))).toBe(false);
  });

  it("detects transient pool and connection errors", () => {
    expect(
      isTransientDbError(
        new Error(
          "(EMAXCONNSESSION) max clients reached in session mode - pool_size: 15",
        ),
      ),
    ).toBe(true);
    expect(isTransientDbError({ code: "53300", message: "too many" })).toBe(
      true,
    );
    expect(isTransientDbError(new Error("DATABASE_URL is not set"))).toBe(
      false,
    );
  });

  it("retries transient failures then succeeds", async () => {
    let attempts = 0;
    const result = await withDbRetry(async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new Error("max clients reached in session mode");
      }
      return "ok";
    });

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("does not retry config errors", async () => {
    let attempts = 0;
    await expect(
      withDbRetry(async () => {
        attempts += 1;
        throw new Error("DATABASE_URL is not set");
      }),
    ).rejects.toThrow("DATABASE_URL is not set");
    expect(attempts).toBe(1);
  });
});
