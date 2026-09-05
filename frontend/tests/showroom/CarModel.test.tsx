import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@react-three/drei", () => ({
  useGLTF: vi.fn(() => ({
    nodes: {
      body: { geometry: { clone: () => "body-geometry-clone" } },
    },
  })),
}));

const { useCarModelGeometry } = await import("../../src/components/showroom/CarModel");

describe("useCarModelGeometry", () => {
  it("returns the named node's cloned geometry", () => {
    const { result } = renderHook(() => useCarModelGeometry("/models/shared/sedan-sports.glb", "body"));
    expect(result.current).toBe("body-geometry-clone");
  });

  it("throws a clear error when the node name isn't found in the loaded GLTF", () => {
    expect(() =>
      renderHook(() => useCarModelGeometry("/models/shared/sedan-sports.glb", "spoiler")),
    ).toThrow('[CarModel] node "spoiler" not found in /models/shared/sedan-sports.glb');
  });
});
