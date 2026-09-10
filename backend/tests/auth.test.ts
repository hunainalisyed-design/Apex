import { describe, expect, it } from "vitest";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "../src/services/auth/password.js";
import { generateToken, hashToken } from "../src/services/auth/session.js";
import { normalizeEmail } from "../src/services/auth/user.js";

describe("password hashing (Spec 16)", () => {
  it("round-trips: a hashed password verifies against its original plaintext", async () => {
    const hash = await hashPassword("correcthorse1");
    await expect(verifyPassword("correcthorse1", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password against a valid hash", async () => {
    const hash = await hashPassword("correcthorse1");
    await expect(verifyPassword("wrongpassword1", hash)).resolves.toBe(false);
  });

  it("never stores the plaintext password in the hash", async () => {
    const hash = await hashPassword("correcthorse1");
    expect(hash).not.toContain("correcthorse1");
  });
});

describe("validatePasswordPolicy (Spec 16 §3: 8+ chars, >=1 letter, >=1 number)", () => {
  it("accepts a password satisfying every rule", () => {
    expect(validatePasswordPolicy("abcdef12")).toBeNull();
  });

  it("rejects a password under 8 characters", () => {
    expect(validatePasswordPolicy("abc123")).not.toBeNull();
  });

  it("rejects a password with no letter", () => {
    expect(validatePasswordPolicy("12345678")).not.toBeNull();
  });

  it("rejects a password with no number", () => {
    expect(validatePasswordPolicy("abcdefgh")).not.toBeNull();
  });
});

describe("session token generation/hashing (Spec 16 §3)", () => {
  it("generates unique tokens across calls", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });

  it("hashes the same token deterministically", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces different hashes for different tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it("never stores the raw token as its own hash", () => {
    const token = generateToken();
    expect(hashToken(token)).not.toBe(token);
  });
});

describe("normalizeEmail (Spec 16)", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  User@Example.com  ")).toBe("user@example.com");
  });
});
