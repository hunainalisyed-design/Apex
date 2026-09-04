"use client";

import { Component, type ReactNode } from "react";
import { ShowroomFallback } from "./ShowroomFallback";

interface ShowroomErrorBoundaryProps {
  children: ReactNode;
  /** Lets the parent hide camera preset / lighting controls when the 3D scene fails,
   * while keeping the vehicle name/spec sheet visible as text (per spec §5's error state). */
  onError?: () => void;
}

interface ShowroomErrorBoundaryState {
  hasError: boolean;
}

export class ShowroomErrorBoundary extends Component<
  ShowroomErrorBoundaryProps,
  ShowroomErrorBoundaryState
> {
  state: ShowroomErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ShowroomErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return <ShowroomFallback />;
    }
    return this.props.children;
  }
}
