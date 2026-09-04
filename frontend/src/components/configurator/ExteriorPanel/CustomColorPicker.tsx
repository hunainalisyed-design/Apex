"use client";

import { useRef, type FormEvent } from "react";

export interface CustomColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

/**
 * A native `<input type="color">` — its `input` event already fires continuously during
 * drag, giving AC-3's "updates live as the picker is dragged" for free, no custom color
 * picker library needed. The handler is throttled to at most one update per animation
 * frame (Risk #2) — always using the latest value, never a stale one from when the frame
 * was scheduled — before it reaches the store/3D material.
 */
export function CustomColorPicker({ value, onChange }: CustomColorPickerProps) {
  const frameRef = useRef<number | null>(null);
  const latestRef = useRef(value);

  const handleInput = (e: FormEvent<HTMLInputElement>) => {
    latestRef.current = e.currentTarget.value;
    if (frameRef.current !== null) return;

    frameRef.current = requestAnimationFrame(() => {
      onChange(latestRef.current);
      frameRef.current = null;
    });
  };

  return (
    <label className="flex items-center gap-2 text-xs text-white/70">
      Custom color
      <input
        type="color"
        defaultValue={value}
        onInput={handleInput}
        aria-label="Custom paint color"
        className="h-8 w-12 cursor-pointer rounded border border-white/20 bg-transparent"
      />
    </label>
  );
}
