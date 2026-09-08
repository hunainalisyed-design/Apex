"use client";

import { Component, type ReactNode } from "react";
import type { VehicleSummaryDto } from "@/types/catalog";
import { Static3DFallback } from "./Static3DFallback";

interface Canvas3DErrorBoundaryProps {
  children: ReactNode;
  vehicle: VehicleSummaryDto;
  /** Lets the parent react to the failure (e.g. ConfigureShowroom hides camera preset /
   * lighting controls while keeping the vehicle name/spec sheet visible as text). */
  onError?: () => void;
}

interface Canvas3DErrorBoundaryState {
  hasError: boolean;
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

/**
 * Degrades to <Static3DFallback> instead of a broken/blank canvas whenever a 3D canvas
 * can't render (Spec 12, AC-1). Consolidates Spec 4's HeroErrorBoundary and Spec 5's
 * ShowroomErrorBoundary — both were structurally identical apart from this onError prop.
 *
 * Guards against WebGL unavailability two ways, because they surface completely
 * differently: an actual React render error inside the 3D subtree (e.g. a bug in
 * appearance-resolution logic) throws synchronously and is caught the standard way, via
 * getDerivedStateFromError/componentDidCatch. A genuine "this browser/device has no WebGL"
 * failure does NOT throw synchronously through React at all — @react-three/fiber's Canvas
 * constructs its WebGLRenderer in a way that surfaces that failure as an unhandled promise
 * rejection, which a standard error boundary can never catch (confirmed by e2e testing
 * against a real disabled-WebGL browser context, not just a mocked component throw).
 * Feature-detecting WebGL support up front, before mounting children at all, catches that
 * case instead of relying on a catch that structurally cannot fire. This does not cover a
 * context loss occurring mid-session after a successful initial mount — Spec 12 explicitly
 * does not attempt that separately harder problem.
 *
 * Deliberately distinct from <AppErrorBoundary>: this only wraps a <Canvas> subtree and
 * lets the rest of the page keep working; <AppErrorBoundary> is a separate, top-level
 * safety net for any unexpected error anywhere else in the render tree.
 */
export class Canvas3DErrorBoundary extends Component<Canvas3DErrorBoundaryProps, Canvas3DErrorBoundaryState> {
  // Starts identical on server and client (never true during SSR — `document` doesn't
  // exist there) so hydration never mismatches; the WebGL feature-detection in
  // componentDidMount below runs client-only and swaps to the fallback right after mount
  // if needed, rather than being decided up front.
  state: Canvas3DErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): Canvas3DErrorBoundaryState {
    return { hasError: true };
  }

  componentDidMount() {
    if (!isWebGLAvailable()) {
      this.setState({ hasError: true });
      this.props.onError?.();
    }
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return <Static3DFallback vehicle={this.props.vehicle} />;
    }
    return this.props.children;
  }
}
