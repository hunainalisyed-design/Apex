"use client";

import { Component, type ReactNode } from "react";
import { HeroFallback } from "./HeroFallback";

interface HeroErrorBoundaryProps {
  children: ReactNode;
}

interface HeroErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches WebGL/Canvas construction failures (unsupported WebGL, driver errors) and
 * degrades to the static fallback instead of a broken/blank canvas (AC-5). This is a
 * per-spec stand-in for the shared error-boundary pattern Spec 12 will formalize.
 */
export class HeroErrorBoundary extends Component<HeroErrorBoundaryProps, HeroErrorBoundaryState> {
  state: HeroErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): HeroErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <HeroFallback />;
    }
    return this.props.children;
  }
}
