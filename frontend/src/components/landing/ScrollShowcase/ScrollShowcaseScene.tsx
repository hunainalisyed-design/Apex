"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas3DErrorBoundary } from "@/components/shell/Canvas3DErrorBoundary";
import { PlaceholderVehicleMesh } from "@/components/landing/PlaceholderVehicleMesh";
import { formatPriceCents } from "@/lib/format/currency";
import { lerpCameraState } from "@/lib/showroom/cameraInterpolation";
import type { VehicleSummaryDto } from "@/types/catalog";
import { buildShowcaseStages, type ShowcaseStage } from "./showcaseStages";

interface ShowcaseRigProps {
  stages: ShowcaseStage[];
  progressRef: RefObject<number>;
}

/** Writes the camera position/target directly each frame from a scroll-progress ref (Spec
 * 13, AC-8/AC-9) — no OrbitControls, since scroll alone drives this camera; accepting drag
 * input here would blur "the user's own scroll position always remains in direct control"
 * into "and also can be knocked off course by an accidental drag." */
function ShowcaseRig({ stages, progressRef }: ShowcaseRigProps) {
  useFrame(({ camera }) => {
    const segments = stages.length - 1;
    const scaled = Math.min(1, Math.max(0, progressRef.current)) * segments;
    const index = Math.min(Math.floor(scaled), segments - 1);
    const localT = scaled - index;
    const state = lerpCameraState(stages[index].camera, stages[index + 1].camera, localT);
    camera.position.set(state.position.x, state.position.y, state.position.z);
    camera.lookAt(state.target.x, state.target.y, state.target.z);
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 5]} intensity={1.2} />
      <directionalLight position={[-4, 2, -5]} intensity={0.4} color="#3d6fe0" />
      <PlaceholderVehicleMesh />
    </>
  );
}

export interface ScrollShowcaseSceneProps {
  vehicle: VehicleSummaryDto;
}

/**
 * The live, scroll-driven six-beat showcase (Spec 13, AC-8 through AC-11) — a second,
 * independent Canvas from Hero's (see Spec 13's own resolved Risk #2: no real GLB exists to
 * dedupe yet, and Hero's Canvas has no ref/context escape hatch to share safely). Progress
 * is tracked via a GSAP ScrollTrigger `scrub` (reads scroll position, never writes it —
 * AC-9), while the visible "stays on screen while its section scrolls" effect comes from
 * ordinary CSS `position: sticky` (this codebase's own existing pin pattern, see
 * ShowroomLayout.tsx) rather than ScrollTrigger's own `pin` option — one less moving part
 * for the same visual result.
 */
export function ScrollShowcaseScene({ vehicle }: ScrollShowcaseSceneProps) {
  const stages = useMemo(() => buildShowcaseStages(vehicle.name), [vehicle.name]);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [stageIndex, setStageIndex] = useState(0);
  const stageIndexRef = useRef(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    // gsap.context + ctx.revert() is GSAP's documented React-safety pattern — without it,
    // Strict Mode's dev double-invoke (or navigating away from "/" and back) leaves
    // dangling ScrollTriggers and scroll listeners behind.
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.75,
        onUpdate: (self) => {
          progressRef.current = self.progress;
          const segments = stages.length - 1;
          const index = Math.min(Math.floor(self.progress * segments), segments);
          if (index !== stageIndexRef.current) {
            stageIndexRef.current = index;
            setStageIndex(index);
          }
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, [stages]);

  const currentStage = stages[stageIndex];
  const isSummary = currentStage.id === "summary";

  return (
    <div ref={containerRef} className="relative h-[500vh]">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center gap-6 px-6 py-16">
        <div className="relative aspect-video w-full max-w-3xl">
          <Canvas3DErrorBoundary vehicle={vehicle}>
            <Canvas camera={{ position: [5.5, 2.3, 7.5], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true }}>
              <ShowcaseRig stages={stages} progressRef={progressRef} />
            </Canvas>
          </Canvas3DErrorBoundary>
        </div>

        <p className="max-w-md text-center text-sm text-white/80">{currentStage.caption}</p>

        {isSummary && (
          <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl px-8 py-6 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Starting at</p>
            <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {formatPriceCents(vehicle.basePriceCents, vehicle.currency)}
            </p>
            <Link
              href={`/configure/${vehicle.slug}`}
              className="focus-ring rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Configure Your Car
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
