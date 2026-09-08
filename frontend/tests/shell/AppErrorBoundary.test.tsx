import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "../../src/components/shell/AppErrorBoundary";

function Bomb(): never {
  throw new Error("boom — internal implementation detail");
}

describe("AppErrorBoundary", () => {
  it("renders children normally when nothing throws", () => {
    render(
      <AppErrorBoundary>
        <p>All good</p>
      </AppErrorBoundary>,
    );

    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("catches a render error anywhere in the tree and shows a generic recovery screen with a reload button, no raw error text (AC-3)", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload Page" })).toBeInTheDocument();
    expect(screen.queryByText(/boom — internal implementation detail/)).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
