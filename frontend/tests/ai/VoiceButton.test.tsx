import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VehicleDetailDto } from "../../src/types/catalog";
import { FakeRecognition, installFakeRecognition, installFakeSynthesis } from "../voice/fakeSpeech";

const sendAiConfigureMessageMock = vi.fn();
vi.mock("../../src/lib/api/ai", () => ({
  sendAiConfigureMessage: (...args: unknown[]) => sendAiConfigureMessageMock(...args),
}));

const { ChatWindow } = await import("../../src/components/ai/ChatWindow/ChatWindow");
const { useCarAiChatStore } = await import("../../src/state/carAiChatStore");
const { resetVoicePreferencesForTests } = await import("../../src/lib/voice/voicePreferences");
const { cancelSpeech } = await import("../../src/lib/voice/speechSynthesis");

const vehicle = { slug: "apex-gt", name: "Apex GT", options: {} } as unknown as VehicleDetailDto;

function renderChat() {
  return render(<ChatWindow vehicle={vehicle} buttonRef={{ current: document.createElement("button") }} />);
}

function reply(assistantMessage: string) {
  return { assistantMessage, recommendation: null, breakdown: null };
}

describe("Voice-driven CarAI (Spec 34)", () => {
  beforeEach(() => {
    sendAiConfigureMessageMock.mockReset();
    useCarAiChatStore.setState({ vehicleSlug: "apex-gt", messages: [], isOpen: true, isLoading: false });
    localStorage.clear();
    resetVoicePreferencesForTests();
  });

  afterEach(() => {
    // A reply may still be "speaking" when a test ends; stopping it updates the mounted chat.
    act(() => cancelSpeech());
    vi.unstubAllGlobals();
  });

  describe("microphone", () => {
    it("is absent in a browser without speech recognition — typing still works (AC-1)", () => {
      renderChat();
      expect(screen.queryByRole("button", { name: "Speak your request" })).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Ask CarAI/)).toBeEnabled();
    });

    it("puts spoken words in the message box as they're heard, then sends them exactly like typing (AC-2)", async () => {
      installFakeRecognition();
      sendAiConfigureMessageMock.mockResolvedValue(reply("Here's a meaner look."));
      renderChat();

      fireEvent.click(screen.getByRole("button", { name: "Speak your request" }));
      expect(screen.getByRole("button", { name: "Stop listening" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByTestId("voice-listening")).toHaveTextContent("Listening… speak now");

      const recognition = FakeRecognition.latest();
      act(() => recognition.hear(["make it"]));
      expect(screen.getByPlaceholderText(/Ask CarAI/)).toHaveValue("make it");
      act(() => recognition.hear(["make it ", "more aggressive"], true));
      act(() => recognition.finish());
      expect(screen.getByPlaceholderText(/Ask CarAI/)).toHaveValue("make it more aggressive");
      expect(screen.queryByTestId("voice-listening")).not.toBeInTheDocument();
      // Words streaming in re-render the chat; focus stays in the message box, ready for Send.
      expect(screen.getByPlaceholderText(/Ask CarAI/)).toHaveFocus();

      // Nothing is sent until the user taps Send (decision: review before a paid request).
      expect(sendAiConfigureMessageMock).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      await screen.findByText("Here's a meaner look.");
      expect(sendAiConfigureMessageMock).toHaveBeenCalledOnce();
      expect(sendAiConfigureMessageMock.mock.calls[0][0]).toMatchObject({ vehicleSlug: "apex-gt", message: "make it more aggressive" });
      expect(screen.getByText("make it more aggressive")).toBeInTheDocument(); // the user's bubble
    });

    it("adds to what was already typed", () => {
      installFakeRecognition();
      renderChat();
      fireEvent.change(screen.getByPlaceholderText(/Ask CarAI/), { target: { value: "Keep the red paint," } });
      fireEvent.click(screen.getByRole("button", { name: "Speak your request" }));
      act(() => FakeRecognition.latest().hear(["and add carbon trim"], true));
      expect(screen.getByPlaceholderText(/Ask CarAI/)).toHaveValue("Keep the red paint, and add carbon trim");
    });

    it("tapping again stops listening", () => {
      installFakeRecognition();
      renderChat();
      fireEvent.click(screen.getByRole("button", { name: "Speak your request" }));
      fireEvent.click(screen.getByRole("button", { name: "Stop listening" }));
      expect(FakeRecognition.latest().stop).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Speak your request" })).toHaveAttribute("aria-pressed", "false");
    });

    it.each([
      ["not-allowed", "Microphone access is blocked — type your request instead."],
      ["audio-capture", "No microphone found — type your request instead."],
      ["no-speech", "Didn't catch that — try again, or type your request."],
      ["network", "Voice input isn't available right now — type your request instead."],
    ])("explains a failure (%s) and leaves typing working (AC-5)", (code, message) => {
      installFakeRecognition();
      renderChat();
      fireEvent.click(screen.getByRole("button", { name: "Speak your request" }));
      act(() => FakeRecognition.latest().fail(code));
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(screen.getByPlaceholderText(/Ask CarAI/)).toBeEnabled();
      expect(screen.getByRole("button", { name: "Speak your request" })).toBeEnabled();
    });

    it("shows the privacy note the first time only", () => {
      installFakeRecognition();
      const { unmount } = renderChat();
      fireEvent.click(screen.getByRole("button", { name: "Speak your request" }));
      expect(screen.getByText("Voice is turned into text by your browser's speech service.")).toBeInTheDocument();
      act(() => FakeRecognition.latest().finish());
      unmount();

      renderChat();
      fireEvent.click(screen.getByRole("button", { name: "Speak your request" }));
      expect(screen.queryByText("Voice is turned into text by your browser's speech service.")).not.toBeInTheDocument();
    });

    it("is disabled while CarAI is thinking, and closing the chat stops listening", () => {
      installFakeRecognition();
      useCarAiChatStore.setState({ isLoading: true });
      const { rerender } = renderChat();
      expect(screen.getByRole("button", { name: "Speak your request" })).toBeDisabled();

      act(() => useCarAiChatStore.setState({ isLoading: false }));
      fireEvent.click(screen.getByRole("button", { name: "Speak your request" }));
      const recognition = FakeRecognition.latest();
      act(() => useCarAiChatStore.setState({ isOpen: false }));
      rerender(<ChatWindow vehicle={vehicle} buttonRef={{ current: document.createElement("button") }} />);
      return waitFor(() => expect(recognition.abort).toHaveBeenCalled());
    });
  });

  describe("speak replies", () => {
    it("is absent where the browser can't speak", () => {
      renderChat();
      expect(screen.queryByRole("button", { name: "Speak CarAI's replies aloud" })).not.toBeInTheDocument();
    });

    it("is off by default: replies appear but aren't read aloud (AC-4)", async () => {
      const { spoken } = installFakeSynthesis();
      sendAiConfigureMessageMock.mockResolvedValue(reply("A sportier build."));
      renderChat();
      expect(screen.getByRole("button", { name: "Speak CarAI's replies aloud" })).toHaveAttribute("aria-pressed", "false");

      fireEvent.change(screen.getByPlaceholderText(/Ask CarAI/), { target: { value: "sportier" } });
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      await screen.findByText("A sportier build.");
      expect(spoken).toEqual([]);
    });

    it("when on, reads each new reply aloud — with a Stop button — and remembers the choice (AC-3)", async () => {
      const { spoken, synth } = installFakeSynthesis();
      sendAiConfigureMessageMock.mockResolvedValue(reply("A sportier build."));
      renderChat();
      fireEvent.click(screen.getByRole("button", { name: "Speak CarAI's replies aloud" }));
      expect(localStorage.getItem("apex:speak-replies")).toBe("true");

      fireEvent.change(screen.getByPlaceholderText(/Ask CarAI/), { target: { value: "sportier" } });
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      await screen.findByText("A sportier build.");
      await waitFor(() => expect(spoken.map((u) => u.text)).toEqual(["A sportier build."]));
      expect(screen.getByTestId("speaking-indicator")).toHaveTextContent("Speaking…");

      fireEvent.click(screen.getByRole("button", { name: "Stop speaking" }));
      expect(synth.cancel).toHaveBeenCalled();
      expect(screen.queryByTestId("speaking-indicator")).not.toBeInTheDocument();
    });

    it("never reads out replies that were already there, or errors", async () => {
      const { spoken } = installFakeSynthesis();
      localStorage.setItem("apex:speak-replies", "true");
      useCarAiChatStore.setState({ messages: [{ id: "old", role: "assistant", content: "An old reply." }] });
      renderChat();
      expect(spoken).toEqual([]);

      act(() =>
        useCarAiChatStore.setState((s) => ({ messages: [...s.messages, { id: "err", role: "system-error", content: "CarAI is unavailable." }] })),
      );
      expect(spoken).toEqual([]);
    });

    it("sending a new message cuts off the reply being read", async () => {
      const { synth } = installFakeSynthesis();
      localStorage.setItem("apex:speak-replies", "true");
      sendAiConfigureMessageMock.mockResolvedValueOnce(reply("First.")).mockResolvedValueOnce(reply("Second."));
      renderChat();
      fireEvent.change(screen.getByPlaceholderText(/Ask CarAI/), { target: { value: "one" } });
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      await screen.findByText("First.");
      synth.cancel.mockClear();

      fireEvent.change(screen.getByPlaceholderText(/Ask CarAI/), { target: { value: "two" } });
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      expect(synth.cancel).toHaveBeenCalled();
      await screen.findByText("Second.");
      // …and the new reply is the one being read now.
      await waitFor(() => expect(screen.getByTestId("speaking-indicator")).toBeInTheDocument());
    });
  });
});
