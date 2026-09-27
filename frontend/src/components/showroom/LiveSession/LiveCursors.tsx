"use client";

import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { Vector2, type Object3D } from "three";
import type { LiveCursorPosition } from "@/types/liveSession";

export interface LiveCursor {
  id: string;
  displayName: string;
  color: string;
  position: [number, number, number];
}

const RAYCAST_INTERVAL_MS = 50;

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

/**
 * Where on the car this user's pointer is (Spec 33, AC-2): a raycast from the pointer against
 * the car only — not the floor or backdrop — reported as a world-space point, or null when the
 * pointer is off the car. World space means it lands in the right place on everyone's screen
 * whatever their own camera angle. Listens on the canvas directly, since the car's hoverable
 * parts stop their own pointer events from bubbling.
 */
function CarPointerTracker({ target, onCarPointer }: { target: RefObject<Object3D | null>; onCarPointer: (p: LiveCursorPosition) => void }) {
  const { gl, camera, raycaster } = useThree();
  const last = useRef<LiveCursorPosition>(null);
  const lastCastAt = useRef(0);

  useEffect(() => {
    const element = gl.domElement;
    const pointer = new Vector2();

    function report(position: LiveCursorPosition) {
      if (position === null && last.current === null) return;
      last.current = position;
      onCarPointer(position);
    }

    function onMove(event: PointerEvent) {
      const now = performance.now();
      if (now - lastCastAt.current < RAYCAST_INTERVAL_MS || !target.current) return;
      lastCastAt.current = now;
      const rect = element.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(target.current, true).find((h) => h.object.visible);
      report(hit ? [round(hit.point.x), round(hit.point.y), round(hit.point.z)] : null);
    }

    function onLeave() {
      report(null);
    }

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, camera, raycaster, target, onCarPointer]);

  return null;
}

/** The other participants' pointers, as a colored dot with their name, pinned to the car. */
function RemoteCursors({ cursors }: { cursors: LiveCursor[] }) {
  return (
    <>
      {cursors.map((cursor) => (
        <Html key={cursor.id} position={cursor.position} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="flex -translate-x-1.5 -translate-y-1.5 items-center gap-1" aria-hidden="true" data-testid="live-cursor">
            <span className="h-3 w-3 rounded-full ring-2 ring-white/80" style={{ backgroundColor: cursor.color }} />
            <span
              className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold text-black shadow"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.displayName}
            </span>
          </div>
        </Html>
      ))}
    </>
  );
}

export interface LiveCursorLayerProps {
  target: RefObject<Object3D | null>;
  cursors: LiveCursor[];
  onCarPointer?: (position: LiveCursorPosition) => void;
}

export function LiveCursorLayer({ target, cursors, onCarPointer }: LiveCursorLayerProps) {
  return (
    <>
      {onCarPointer && <CarPointerTracker target={target} onCarPointer={onCarPointer} />}
      <RemoteCursors cursors={cursors} />
    </>
  );
}
