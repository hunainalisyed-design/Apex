"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface BeforeAfterSliderProps {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  /** The slider's accessible name, e.g. "Compare your current build with CarAI's suggestion". */
  label: string;
  /** Text read out with the position, e.g. "{percent}% CarAI's suggestion shown". */
  valueText: (percentAfter: number) => string;
  beforeAlt: string;
  afterAlt: string;
}

const KEY_STEP = 5;
const START = 50;

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Drag-to-compare (Spec 36, AC-3): the "after" picture is underneath, the "before" picture on
 * top, clipped at the divider — so dragging left reveals the suggestion, and right the current
 * build. Mouse, touch and pen use one pointer path; arrow keys move it 5%, Home/End jump to the
 * ends. Keyboard steps glide briefly unless the user prefers reduced motion (AC-5); a drag
 * always follows the pointer exactly.
 */
export function BeforeAfterSlider({ before, after, beforeLabel, afterLabel, label, valueText, beforeAlt, afterAlt }: BeforeAfterSliderProps) {
  const reducedMotion = useReducedMotion();
  // `position` = how much of the width the "before" picture covers, from the left.
  const [position, setPosition] = useState(START);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function positionFromPointer(clientX: number): number {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || !Number.isFinite(clientX)) return position;
    return clamp(((clientX - rect.left) / rect.width) * 100);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    setPosition(positionFromPointer(e.clientX));
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragging) setPosition(positionFromPointer(e.clientX));
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDragging(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const next =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? position - KEY_STEP
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? position + KEY_STEP
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? 100
              : null;
    if (next === null) return;
    e.preventDefault();
    setPosition(clamp(next));
  }

  const glide = !dragging && !reducedMotion;
  const percentAfter = Math.round(100 - position);

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentAfter}
      aria-valuetext={valueText(percentAfter)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className="focus-ring relative aspect-video w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-xl bg-black/40"
      data-testid="before-after-slider"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URLs, not optimizable assets */}
      <img src={after} alt={afterAlt} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URLs, not optimizable assets */}
      <img
        src={before}
        alt={beforeAlt}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)`, transition: glide ? "clip-path 150ms ease-out" : "none" }}
        data-testid="before-image"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]"
        style={{ left: `${position}%`, transition: glide ? "left 150ms ease-out" : "none" }}
        data-testid="slider-divider"
      >
        <span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black shadow">
          ⇆
        </span>
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        {beforeLabel}
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        {afterLabel}
      </span>
    </div>
  );
}
