"use client";

import { Component, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { getWebGLRendererInfo, isWebGLAvailable } from "@/lib/webgl";

interface CompareSceneErrorBoundaryProps {
  children: ReactNode;
  /** Lets CompareView revert to the table view and disable the 3D toggle going forward —
   * the same handler it also calls when a vehicle-detail fetch fails before this boundary
   * ever gets a chance to render anything (Spec 18, AC-6). */
  onError: () => void;
}

interface CompareSceneErrorBoundaryState {
  hasError: boolean;
}

/**
 * Mirrors Canvas3DErrorBoundary's two-pronged WebGL-unavailable + render-error detection
 * (Spec 12) exactly, but renders null on failure instead of a fallback card — Compare's
 * spec table is already always visible regardless of 3D-view state (AC-6), so there's
 * nothing for this boundary itself to show; it only needs to signal the failure upward.
 */
export class CompareSceneErrorBoundary extends Component<
  CompareSceneErrorBoundaryProps,
  CompareSceneErrorBoundaryState
> {
  state: CompareSceneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CompareSceneErrorBoundaryState {
    return { hasError: true };
  }

  componentDidMount() {
    if (!isWebGLAvailable()) {
      this.setState({ hasError: true });
      this.props.onError();
    }
  }

  componentDidCatch(error: unknown) {
    // Spec 22, AC-3 — mirrors Canvas3DErrorBoundary's Sentry reporting exactly (see that
    // file's doc comment for why the GPU/renderer string matters here).
    Sentry.captureException(error, { tags: { webglRenderer: getWebGLRendererInfo() } });
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
