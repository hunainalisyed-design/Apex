"use client";

import { Component, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

/**
 * A top-level safety net around the entire app (Spec 12, AC-3) — distinct from
 * <Canvas3DErrorBoundary>, which only ever wraps a <Canvas> subtree and deliberately lets
 * the rest of the page keep working. This one catches an error anywhere in the render tree
 * and shows a generic recovery screen, never a blank page or a raw stack trace.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Spec 22, AC-3: every error this boundary catches is reported to Sentry (a no-op if
    // NEXT_PUBLIC_SENTRY_DSN is unset, same as instrumentation-client.ts). Also logged to
    // console.error so it's still visible in local dev without a DSN configured.
    console.error(error);
    Sentry.captureException(error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main id="main-content" tabIndex={-1} className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <div className="glass-panel flex max-w-xl flex-col items-center gap-4 rounded-2xl px-10 py-14">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Apex Showroom</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Something went wrong.</h1>
            <p className="text-sm text-white/60">
              An unexpected error occurred. Reloading the page usually fixes this.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="focus-ring rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Reload Page
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
