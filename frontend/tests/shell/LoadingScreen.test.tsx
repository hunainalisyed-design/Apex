import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingScreen } from "../../src/components/shell/LoadingScreen";

describe("LoadingScreen", () => {
  it("shows the default label when none is provided", () => {
    render(<LoadingScreen />);
    expect(screen.getByText("Initializing Showroom…")).toBeInTheDocument();
  });

  it("shows a custom label when provided", () => {
    render(<LoadingScreen label="Loading…" />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
