"use client";

import { ContactShadows, GradientTexture, GradientType } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, type ReactNode } from "react";
import { PlaceholderShowroomRig } from "@/components/showroom/PlaceholderShowroomRig";
import { RealGlbShowroomRig } from "@/components/showroom/RealGlbShowroomRig";
import type { SelectionState } from "@/lib/ai/mergeRecommendation";
import { getCameraPreset } from "@/lib/showroom/cameraPresets";
import { resolveAccessoryAppearance } from "@/lib/showroom/accessoryAppearance";
import { resolveExteriorAppearance } from "@/lib/showroom/exteriorAppearance";
import { resolveInteriorAppearance } from "@/lib/showroom/interiorAppearance";
import { getRealGlbVehicleConfig } from "@/lib/showroom/realGlbVehicles";
import type { VehicleDetailDto } from "@/types/catalog";

/** The pictures' size — small enough to make quickly, sharp enough for a chat card. */
export const COMPARISON_WIDTH = 640;
export const COMPARISON_HEIGHT = 360;
const JPEG_QUALITY = 0.85;
/** Frames rendered before reading the picture: contact shadows and textures settle over a couple. */
const WARMUP_FRAMES = 3;

const noop = () => {};

class StudioErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Mounted after the car inside the same Suspense boundary, so it runs once the car is in the
 * scene. Keyed by the capture id: a new picture re-mounts just this, inside the same 3D view.
 */
function CaptureWhenReady({ captureId, onCapture, onError }: { captureId: string; onCapture: (captureId: string, url: string) => void; onError: () => void }) {
  const advance = useThree((s) => s.advance);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < WARMUP_FRAMES; i++) {
        advance(performance.now());
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (cancelled) return;
      }
      const url = gl.domElement.toDataURL("image/jpeg", JPEG_QUALITY);
      if (!cancelled) onCapture(captureId, url);
    })().catch(() => {
      if (!cancelled) onError();
    });
    return () => {
      cancelled = true;
    };
  }, [advance, gl, captureId, onCapture, onError]);
  return null;
}

function StudioScene({ vehicle, selection, captureId, onCapture, onError }: StudioCanvasProps) {
  const appearance = resolveExteriorAppearance(vehicle, selection.singleSelections, selection.customPaintHex);
  const interior = resolveInteriorAppearance(vehicle, selection.singleSelections);
  const accessories = resolveAccessoryAppearance(vehicle, selection.multiSelections, appearance.paintColor);
  const realGlbConfig = getRealGlbVehicleConfig(vehicle.slug);
  const floorY = realGlbConfig ? 0 : -0.32;

  return (
    <>
      <GradientTexture attach="background" type={GradientType.Radial} innerCircleRadius={0} outerCircleRadius="auto" stops={[0, 1]} colors={["#dcebf8", "#c7ccd2"]} size={256} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.3} />
      <directionalLight position={[-4, 2, -5]} intensity={0.35} color="#3d6fe0" />
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#9aa3ab" metalness={0.4} roughness={0.9} />
      </mesh>
      {/* No `frames` limit: this view only renders the few frames each capture advances, and the
          shadow must be redrawn for every picture (the view is reused across a whole batch). */}
      <ContactShadows position={[0, floorY + 0.001, 0]} opacity={0.55} scale={12} blur={2.4} far={4} resolution={256} color="#0a0e14" />
      <Suspense fallback={null}>
        {realGlbConfig ? (
          <RealGlbShowroomRig config={realGlbConfig} modelUrl={vehicle.showroomModelUrl} appearance={appearance} />
        ) : (
          <PlaceholderShowroomRig
            doorOpenAmount={0}
            headlightsOn={false}
            brakePulsing={false}
            onHoverMesh={noop}
            interior={interior}
            accessories={accessories}
            {...appearance}
          />
        )}
        <CaptureWhenReady key={captureId} captureId={captureId} onCapture={onCapture} onError={onError} />
      </Suspense>
    </>
  );
}

export interface StudioCanvasProps {
  vehicle: VehicleDetailDto;
  selection: SelectionState;
  /** Identifies the picture being made; a new id means "draw `selection` and capture again". */
  captureId: string;
  /** Called once per capture id, with the picture as a JPEG data: URL. */
  onCapture: (captureId: string, url: string) => void;
  /** Called if the 3D view can't be made (no WebGL) or rendering fails. */
  onError: () => void;
}

/**
 * A small, invisible 3D view in the showroom's studio look (backdrop, lights, floor, shadow) at
 * Spec 11's standard camera. It draws `selection` and reads it back as a picture for each new
 * `captureId` — changing the build in place, never re-creating the 3D context between pictures
 * (rapid context churn with a heavy real model is a known crash risk here; see next.config.ts).
 * Separate from the live showroom's renderer entirely, so the live view is never touched.
 */
export function StudioCanvas(props: StudioCanvasProps) {
  const preset = getCameraPreset("default");
  return (
    <StudioErrorBoundary onError={props.onError}>
      <Canvas
        frameloop="never"
        dpr={1}
        camera={{ position: [preset.position.x, preset.position.y, preset.position.z], fov: 40 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ width: COMPARISON_WIDTH, height: COMPARISON_HEIGHT }}
      >
        <StudioScene {...props} />
      </Canvas>
    </StudioErrorBoundary>
  );
}
