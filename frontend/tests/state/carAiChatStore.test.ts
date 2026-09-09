import { beforeEach, describe, expect, it, vi } from "vitest";

const sendAiConfigureMessageMock = vi.fn();
vi.mock("../../src/lib/api/ai", () => ({
  sendAiConfigureMessage: (...args: unknown[]) => sendAiConfigureMessageMock(...args),
}));

const { useCarAiChatStore } = await import("../../src/state/carAiChatStore");
const { useConfigurationStore, emptySingleSelections, emptyMultiSelections } = await import(
  "../../src/state/configurationStore"
);
const { ApiRequestError } = await import("../../src/lib/api/configurations");

function resetStores() {
  useCarAiChatStore.setState({ vehicleSlug: "apex-gt", messages: [], isOpen: false, isLoading: false });
  useConfigurationStore.setState({
    vehicleSlug: "apex-gt",
    singleSelections: { ...emptySingleSelections(), PAINT: "paint-default", WHEELS: "wheels-default" },
    customPaintHex: null,
    multiSelections: emptyMultiSelections(),
  });
}

describe("carAiChatStore (Spec 15)", () => {
  beforeEach(() => {
    sendAiConfigureMessageMock.mockReset();
    resetStores();
  });

  it("appends the user message immediately, then the assistant reply on success, in order (AC-3)", async () => {
    sendAiConfigureMessageMock.mockResolvedValueOnce({
      assistantMessage: "Sure, here's a suggestion.",
      recommendation: null,
      breakdown: null,
    });

    await useCarAiChatStore.getState().sendMessage("Make it sportier");

    const messages = useCarAiChatStore.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", content: "Make it sportier" });
    expect(messages[1]).toMatchObject({ role: "assistant", content: "Sure, here's a suggestion." });
    expect(useCarAiChatStore.getState().isLoading).toBe(false);
  });

  it("sends the vehicleSlug and the configuration store's live current selections", async () => {
    useConfigurationStore.getState().setSingleSelection("PAINT", "paint-alt");
    sendAiConfigureMessageMock.mockResolvedValueOnce({
      assistantMessage: "ok",
      recommendation: null,
      breakdown: null,
    });

    await useCarAiChatStore.getState().sendMessage("hello");

    expect(sendAiConfigureMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleSlug: "apex-gt",
        currentSelections: expect.objectContaining({
          singleSelections: expect.objectContaining({ PAINT: "paint-alt" }),
        }),
      }),
    );
  });

  it("guards against a duplicate send while a request is already in flight (AC-13)", async () => {
    let resolveFirst!: (value: unknown) => void;
    sendAiConfigureMessageMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const first = useCarAiChatStore.getState().sendMessage("first message");
    await useCarAiChatStore.getState().sendMessage("second message"); // should no-op immediately

    expect(sendAiConfigureMessageMock).toHaveBeenCalledTimes(1);
    expect(useCarAiChatStore.getState().messages.filter((m) => m.role === "user")).toHaveLength(1);

    resolveFirst({ assistantMessage: "done", recommendation: null, breakdown: null });
    await first;
  });

  it("never sends a blank/whitespace-only message", async () => {
    await useCarAiChatStore.getState().sendMessage("   ");

    expect(sendAiConfigureMessageMock).not.toHaveBeenCalled();
    expect(useCarAiChatStore.getState().messages).toHaveLength(0);
  });

  it("appends a system-error message using the mapped error copy on failure, preserving prior history (AC-8)", async () => {
    sendAiConfigureMessageMock
      .mockResolvedValueOnce({ assistantMessage: "First reply.", recommendation: null, breakdown: null })
      .mockRejectedValueOnce(new ApiRequestError("AI_PROVIDER_ERROR", "raw backend detail"));

    await useCarAiChatStore.getState().sendMessage("first");
    await useCarAiChatStore.getState().sendMessage("second");

    const messages = useCarAiChatStore.getState().messages;
    expect(messages).toHaveLength(4); // user, assistant, user, system-error
    expect(messages[1]).toMatchObject({ role: "assistant", content: "First reply." });
    expect(messages[3]).toMatchObject({
      role: "system-error",
      content: "CarAI is temporarily unavailable. You can continue configuring manually.",
    });
    expect(useCarAiChatStore.getState().isLoading).toBe(false);
  });

  it("reset clears messages and updates vehicleSlug but leaves isOpen untouched (AC-9)", () => {
    useCarAiChatStore.setState({
      isOpen: true,
      messages: [{ id: "m1", role: "user", content: "hi" }],
    });

    useCarAiChatStore.getState().reset("apex-rs");

    const state = useCarAiChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.vehicleSlug).toBe("apex-rs");
    expect(state.isOpen).toBe(true);
  });

  it("applyRecommendation overwrites each recommended single-select category via the store's existing action", () => {
    useCarAiChatStore.setState({
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "...",
          recommendation: { singleSelections: { WHEELS: "wheels-alt" }, multiSelections: {} },
        },
      ],
    });

    useCarAiChatStore.getState().applyRecommendation("m1");

    expect(useConfigurationStore.getState().singleSelections.WHEELS).toBe("wheels-alt");
    expect(useConfigurationStore.getState().singleSelections.PAINT).toBe("paint-default"); // untouched
  });

  it("applyRecommendation only toggles multi-select ids not already selected, per the worked example in the plan", () => {
    useConfigurationStore.getState().toggleMultiSelection("ACCESSORY", "a");
    useConfigurationStore.getState().toggleMultiSelection("ACCESSORY", "c");

    useCarAiChatStore.setState({
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "...",
          recommendation: { singleSelections: {}, multiSelections: { ACCESSORY: ["a", "b"] } },
        },
      ],
    });

    useCarAiChatStore.getState().applyRecommendation("m1");

    // "a" was already present and must not be toggled off; "b" is new and gets added.
    expect(useConfigurationStore.getState().multiSelections.ACCESSORY).toEqual(["a", "c", "b"]);
  });

  it("marks the message applied: true after applying its recommendation (AC-7)", () => {
    useCarAiChatStore.setState({
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "...",
          recommendation: { singleSelections: { PAINT: "paint-alt" }, multiSelections: {} },
        },
      ],
    });

    useCarAiChatStore.getState().applyRecommendation("m1");

    expect(useCarAiChatStore.getState().messages[0].applied).toBe(true);
  });

  it("applyRecommendation is a no-op for a message with no recommendation", () => {
    useCarAiChatStore.setState({
      messages: [{ id: "m1", role: "assistant", content: "no change needed" }],
    });

    expect(() => useCarAiChatStore.getState().applyRecommendation("m1")).not.toThrow();
    expect(useCarAiChatStore.getState().messages[0].applied).toBeUndefined();
  });
});
