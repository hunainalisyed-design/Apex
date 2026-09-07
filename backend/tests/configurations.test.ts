import { describe, expect, it } from "vitest";
import { generatePublicId, PublicIdGenerationError } from "../src/services/publicId.js";

const FULL_FORMAT = /^[A-Z]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

describe("generatePublicId", () => {
  it("derives a 4-letter prefix from the first word of a multi-word vehicle name", async () => {
    const id = await generatePublicId("Apex GT", async () => false);
    expect(id.startsWith("APEX-")).toBe(true);
  });

  it("produces the full XXXX-YYYY-ZZZZ format using only the ambiguity-excluding alphabet", async () => {
    const id = await generatePublicId("Apex RS", async () => false);
    expect(id).toMatch(FULL_FORMAT);
  });

  it("retries when a candidate is already taken, and eventually returns a free one", async () => {
    let calls = 0;
    const isTaken = async () => {
      calls++;
      return calls <= 2; // first two candidates are "taken", third is free
    };

    const id = await generatePublicId("Apex GT", isTaken);

    expect(calls).toBe(3);
    expect(id).toMatch(FULL_FORMAT);
  });

  it("throws PublicIdGenerationError after exhausting maxAttempts consecutive collisions", async () => {
    const alwaysTaken = async () => true;

    await expect(generatePublicId("Apex GT", alwaysTaken, 3)).rejects.toThrow(PublicIdGenerationError);
  });
});
