"use client";

import { useRef } from "react";
import type { VehicleDetailDto } from "@/types/catalog";
import { CarAIButton } from "./CarAIButton/CarAIButton";
import { ChatWindow } from "./ChatWindow/ChatWindow";

export interface CarAIAssistantProps {
  vehicle: VehicleDetailDto;
}

const AI_ASSISTANT_ENABLED = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED !== "false";

/**
 * Mounts the floating button + chat window pair (Spec 15) — a single wrapper so
 * ConfigureShowroom only needs one new line, and so the button ref (needed by the chat
 * window's focus trap to return focus on Escape, AC-10) has one shared owner. Gated by
 * NEXT_PUBLIC_AI_ASSISTANT_ENABLED, which mirrors the backend's own AI_ASSISTANT_ENABLED
 * flag (Spec 14) — two independently-set env vars that must be kept in sync manually, the
 * same accepted tradeoff as this project's pricing formula being implemented independently
 * on frontend/backend (Spec 3 Risk #1). When disabled, this renders nothing at all rather
 * than a button that always errors (the spec's own Rollout wording).
 */
export function CarAIAssistant({ vehicle }: CarAIAssistantProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (!AI_ASSISTANT_ENABLED) return null;

  return (
    <>
      <CarAIButton ref={buttonRef} />
      <ChatWindow vehicle={vehicle} buttonRef={buttonRef} />
    </>
  );
}
