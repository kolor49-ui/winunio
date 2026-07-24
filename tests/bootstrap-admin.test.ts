import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getBootstrapAdminEmails,
  isBootstrapAdminEmail,
} from "@/server/services/bootstrap-admin-service";

describe("bootstrap-admin-service", () => {
  const original = process.env.WINUNIO_BOOTSTRAP_ADMIN_EMAIL;

  beforeEach(() => {
    process.env.WINUNIO_BOOTSTRAP_ADMIN_EMAIL = "admin@winunio.test";
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.WINUNIO_BOOTSTRAP_ADMIN_EMAIL;
    } else {
      process.env.WINUNIO_BOOTSTRAP_ADMIN_EMAIL = original;
    }
  });

  it("reads bootstrap admin email from env", () => {
    expect(getBootstrapAdminEmails()).toEqual(["admin@winunio.test"]);
  });

  it("supports comma-separated admin emails", () => {
    process.env.WINUNIO_BOOTSTRAP_ADMIN_EMAIL =
      "admin@winunio.test, second@winunio.test";
    expect(isBootstrapAdminEmail("second@winunio.test")).toBe(true);
  });

  it("matches email case-insensitively", () => {
    expect(isBootstrapAdminEmail("Admin@Winunio.Test")).toBe(true);
    expect(isBootstrapAdminEmail("other@example.com")).toBe(false);
  });

  it("returns false when env is unset", () => {
    delete process.env.WINUNIO_BOOTSTRAP_ADMIN_EMAIL;
    expect(isBootstrapAdminEmail("admin@winunio.test")).toBe(false);
  });
});
