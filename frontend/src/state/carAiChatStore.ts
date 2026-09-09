import { create } from "zustand";
import { sendAiConfigureMessage } from "@/lib/api/ai";
import { ApiRequestError } from "@/lib/api/configurations";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { MULTI_SELECT_CATEGORIES } from "@/types/catalog";
import type { AiConfigureRecommendation, AiConfigureResponseDto } from "@/types/ai";
import type { SingleSelectCategory } from "@/types/pricing";
import { useConfigurationStore } from "./configurationStore";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system-error";
  content: string;
  recommendation?: AiConfigureRecommendation | null;
  breakdown?: AiConfigureResponseDto["breakdown"];
  /** Set true once the user clicks Apply on this message's recommendation (Spec 15, AC-7). */
  applied?: boolean;
}

export interface CarAiChatState {
  vehicleSlug: string;
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  setOpen: (open: boolean) => void;
  sendMessage: (text: string) => Promise<void>;
  /** Merges a message's recommendation into configurationStore via its EXISTING actions
   * (Spec 15, AC-7) — the 3D scene and price update through the exact same pipeline a
   * manual swatch click would trigger. */
  applyRecommendation: (messageId: string) => void;
  /** Called when the showroom's vehicle changes (Spec 15, AC-9) — clears history and
   * updates the tracked vehicleSlug, but deliberately never touches isOpen, so a nav-
   * control-triggered "open" (set before navigating, AC-2) survives this reset. */
  reset: (vehicleSlug: string) => void;
}

let nextMessageId = 0;
function createMessageId(): string {
  nextMessageId += 1;
  return `msg_${nextMessageId}`;
}

/**
 * Chat state for the CarAI assistant (Spec 15) — a plain global Zustand store, like
 * configurationStore.ts, not React-Context-scoped. That's what lets `isOpen` survive a
 * Next.js client-side navigation triggered by the nav entry point (AC-2): the module is a
 * singleton that's never torn down except on a full page reload, so a synchronous
 * `setOpen(true)` write in the nav control's onClick handler completes before/independent
 * of the route transition and is still true once ConfigureShowroom (and ChatWindow) mount
 * for the target vehicle.
 */
export const useCarAiChatStore = create<CarAiChatState>((set, get) => ({
  vehicleSlug: "",
  messages: [],
  isOpen: false,
  isLoading: false,

  setOpen: (open) => set({ isOpen: open }),

  sendMessage: async (text) => {
    const trimmed = text.trim();
    // The real enforcement point for AC-13's duplicate-send guard — the UI's own
    // disabled={isLoading} is belt-and-suspenders, not what this guards against.
    if (!trimmed || get().isLoading) return;

    const userMessage: ChatMessage = { id: createMessageId(), role: "user", content: trimmed };

    // The backend only accepts "user"/"assistant" history roles and requires the first
    // entry (if any) be "user" — system-error messages are this UI's own concern, never
    // sent back to CarAI.
    const history = get()
      .messages.filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "system-error")
      .map((m) => ({ role: m.role, content: m.content }));

    set((state) => ({ messages: [...state.messages, userMessage], isLoading: true }));

    const configState = useConfigurationStore.getState();

    try {
      const response = await sendAiConfigureMessage({
        vehicleSlug: get().vehicleSlug,
        message: trimmed,
        history,
        currentSelections: {
          singleSelections: configState.singleSelections,
          multiSelections: configState.multiSelections,
        },
      });

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: response.assistantMessage,
        recommendation: response.recommendation,
        breakdown: response.breakdown ?? undefined,
      };
      set((state) => ({ messages: [...state.messages, assistantMessage], isLoading: false }));
    } catch (err) {
      // Prior history is left exactly as-is (AC-8) — only a new system-error bubble is
      // appended, the rest of the configurator stays fully usable.
      const message = getErrorMessage(err instanceof ApiRequestError ? err.code : undefined);
      const errorMessage: ChatMessage = { id: createMessageId(), role: "system-error", content: message };
      set((state) => ({ messages: [...state.messages, errorMessage], isLoading: false }));
    }
  },

  applyRecommendation: (messageId) => {
    const message = get().messages.find((m) => m.id === messageId);
    if (!message?.recommendation) return;

    const configStore = useConfigurationStore.getState();

    for (const [category, optionId] of Object.entries(message.recommendation.singleSelections)) {
      if (optionId) configStore.setSingleSelection(category as SingleSelectCategory, optionId);
    }

    // toggleMultiSelection TOGGLES rather than sets/adds — only call it for ids the user
    // doesn't already have selected, mirroring the backend's own union-merge semantics
    // (backend/src/services/ai/configureVehicle.ts). Diffed against live state at
    // apply-time: if the user changed selections between receiving this recommendation and
    // clicking Apply, the resulting total can differ slightly from breakdown.totalPriceCents
    // shown on the card at receive-time — expected given AC-7's "existing actions" design,
    // not a bug.
    for (const category of MULTI_SELECT_CATEGORIES) {
      const recommended = message.recommendation.multiSelections[category];
      if (!recommended) continue;
      const current = configStore.multiSelections[category];
      for (const optionId of recommended) {
        if (!current.includes(optionId)) configStore.toggleMultiSelection(category, optionId);
      }
    }

    set((state) => ({
      messages: state.messages.map((m) => (m.id === messageId ? { ...m, applied: true } : m)),
    }));
  },

  reset: (vehicleSlug) => set({ vehicleSlug, messages: [] }),
}));
