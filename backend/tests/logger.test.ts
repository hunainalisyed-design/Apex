import { describe, expect, it } from "vitest";
import { redact } from "../src/lib/redact.js";

describe("redact", () => {
  it("replaces known-sensitive keys with a redaction marker", () => {
    const input = {
      email: "driver@example.com",
      password: "hunter2",
      newPassword: "hunter3",
      sessionToken: "abc123",
      apiKey: "sk-live-xyz",
      Authorization: "Bearer abc",
      cardNumber: "4242424242424242",
      cvv: "123",
    };

    expect(redact(input)).toEqual({
      email: "driver@example.com",
      password: "[REDACTED]",
      newPassword: "[REDACTED]",
      sessionToken: "[REDACTED]",
      apiKey: "[REDACTED]",
      Authorization: "[REDACTED]",
      cardNumber: "[REDACTED]",
      cvv: "[REDACTED]",
    });
  });

  it("redacts sensitive keys nested inside objects and arrays", () => {
    const input = {
      user: { name: "Ada", password: "hunter2" },
      sessions: [{ token: "abc" }, { token: "def" }],
    };

    expect(redact(input)).toEqual({
      user: { name: "Ada", password: "[REDACTED]" },
      sessions: [{ token: "[REDACTED]" }, { token: "[REDACTED]" }],
    });
  });

  it("leaves non-sensitive values untouched, including primitives and null", () => {
    expect(redact("plain string")).toBe("plain string");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBe(null);
    expect(redact({ vehicleSlug: "apex-gt", count: 3 })).toEqual({ vehicleSlug: "apex-gt", count: 3 });
  });

  it("does not throw on a circular reference", () => {
    const input: Record<string, unknown> = { name: "Ada" };
    input.self = input;

    expect(() => redact(input)).not.toThrow();
    expect((redact(input) as { self: unknown }).self).toBe("[CIRCULAR]");
  });
});
