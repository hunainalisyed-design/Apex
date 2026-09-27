import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({ prisma: {} }));
const computeMock = vi.fn();
vi.mock("../src/services/comboRarity.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/services/comboRarity.js")>()),
  computeComboRarity: (...args: unknown[]) => computeMock(...args),
}));

const { ceilPercent, isRare, MIN_SAMPLE_SIZE } = await import("../src/services/comboRarity.js");
const { runComboRarityJob, startComboRarityJob } = await import("../src/jobs/computeComboRarity.js");

describe("ceilPercent (Spec 32, AC-4)", () => {
  it("keeps exact tenths exact", () => {
    expect(ceilPercent(7, 200)).toBe(3.5);
    expect(ceilPercent(1, 50)).toBe(2);
    expect(ceilPercent(3, 100)).toBe(3);
  });

  it("rounds up, never down — a pair is never shown rarer than it is", () => {
    expect(ceilPercent(1, 3)).toBe(33.4); // 33.33…%
    expect(ceilPercent(29, 850)).toBe(3.5); // 3.41…%
    expect(ceilPercent(1, 1000)).toBe(0.1);
    expect(ceilPercent(1, 100_000)).toBe(0.1); // 0.001% still shows as 0.1%, not 0%
  });
});

describe("isRare (Spec 32, AC-2 / AC-3)", () => {
  it("needs a meaningful sample: nothing is rare below the minimum", () => {
    expect(MIN_SAMPLE_SIZE).toBe(50);
    expect(isRare(1, 49)).toBe(false);
    expect(isRare(1, 50)).toBe(true);
  });

  it("is strictly under 5%, on the exact ratio", () => {
    expect(isRare(4, 100)).toBe(true);
    expect(isRare(5, 100)).toBe(false); // exactly 5% is not "under 5%"
    expect(isRare(49, 1000)).toBe(true); // 4.9%
    expect(isRare(3, 61)).toBe(true); // 4.918…% — rounds up to 5.0 for display but is under 5%
  });

  it("a pair nobody has saved gets no badge", () => {
    expect(isRare(0, 500)).toBe(false);
  });
});

describe("combo rarity job scheduling", () => {
  it("is disabled by an interval of 0 (and by nonsense)", () => {
    vi.useFakeTimers();
    try {
      startComboRarityJob({ RARITY_JOB_INTERVAL_MINUTES: "0" });
      startComboRarityJob({ RARITY_JOB_INTERVAL_MINUTES: "soon" });
      vi.advanceTimersByTime(24 * 60 * 60_000);
      expect(computeMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs shortly after startup, then every interval, until stopped", async () => {
    vi.useFakeTimers();
    computeMock.mockReset().mockResolvedValue({ vehicles: 1, combos: 1, builds: 1, durationMs: 1 });
    try {
      const stop = startComboRarityJob({ RARITY_JOB_INTERVAL_MINUTES: "30" });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(computeMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(30 * 60_000);
      expect(computeMock).toHaveBeenCalledTimes(2);
      stop();
      await vi.advanceTimersByTimeAsync(2 * 60 * 60_000);
      expect(computeMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("defaults to hourly", async () => {
    vi.useFakeTimers();
    computeMock.mockReset().mockResolvedValue({ vehicles: 0, combos: 0, builds: 0, durationMs: 0 });
    try {
      const stop = startComboRarityJob({});
      await vi.advanceTimersByTimeAsync(10_000 + 59 * 60_000);
      expect(computeMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(computeMock).toHaveBeenCalledTimes(2);
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("never overlaps runs, and a failed run doesn't throw", async () => {
    let finish: () => void = () => {};
    computeMock.mockReset().mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
    const first = runComboRarityJob();
    await runComboRarityJob(); // skipped: the first is still running
    expect(computeMock).toHaveBeenCalledTimes(1);
    finish();
    await first;

    computeMock.mockRejectedValueOnce(new Error("db down"));
    await expect(runComboRarityJob()).resolves.toBeUndefined();
  });
});
