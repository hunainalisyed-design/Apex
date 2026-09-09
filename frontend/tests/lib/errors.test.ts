import { describe, expect, it } from "vitest";
import { getErrorMessage } from "../../src/lib/errors/getErrorMessage";

describe("getErrorMessage", () => {
  it.each([
    ["VEHICLE_NOT_FOUND", "Unable to load vehicle. Please try again."],
    ["VALIDATION_ERROR", "Something about this build isn't valid. Please try again."],
    [
      "OPTION_VEHICLE_MISMATCH",
      "One of your selections doesn't belong to this vehicle. Please refresh and try again.",
    ],
    [
      "DUPLICATE_OPTION_SELECTION",
      "A selection was submitted more than once. Please refresh and try again.",
    ],
    ["CONFIGURATION_NOT_FOUND", "This build could not be found."],
    ["RATE_LIMITED", "Too many requests. Please wait a moment and try again."],
    ["AI_PROVIDER_ERROR", "CarAI is temporarily unavailable. You can continue configuring manually."],
    ["AI_ASSISTANT_DISABLED", "CarAI is temporarily unavailable. You can continue configuring manually."],
  ])("maps %s to its human-readable message", (code, expected) => {
    expect(getErrorMessage(code)).toBe(expected);
  });

  it("falls back to a generic message for an unmapped code, never leaking the raw code (AC-4)", () => {
    expect(getErrorMessage("SOME_UNKNOWN_CODE")).toBe("Something went wrong. Please try again.");
  });

  it("falls back to a generic message when the code is missing or empty", () => {
    expect(getErrorMessage(undefined)).toBe("Something went wrong. Please try again.");
    expect(getErrorMessage(null)).toBe("Something went wrong. Please try again.");
    expect(getErrorMessage("")).toBe("Something went wrong. Please try again.");
  });
});
