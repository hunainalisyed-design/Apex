"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import type { Mesh, BufferGeometry } from "three";

export type CarModelNodeName =
  | "body"
  | "spoiler"
  | "wheel-front-left"
  | "wheel-front-right"
  | "wheel-back-left"
  | "wheel-back-right";

/**
 * Loads a shared car GLB (drei caches the parse by url, so requesting several node
 * names from the same file only triggers one fetch) and returns the named node's
 * geometry, cloned so multiple instances (e.g. the four wheels) never share a single
 * mutable BufferGeometry. Only geometry is used — every part keeps this app's own
 * declarative <meshStandardMaterial> rather than the GLB's bundled material/texture,
 * since customization (paint/wheel-style/accessory color) is driven entirely by props.
 */
export function useCarModelGeometry(url: string, nodeName: CarModelNodeName): BufferGeometry {
  const { nodes } = useGLTF(url) as unknown as { nodes: Record<string, Mesh> };

  return useMemo(() => {
    const source = nodes[nodeName];
    if (!source) {
      throw new Error(`[CarModel] node "${nodeName}" not found in ${url}`);
    }
    return source.geometry.clone();
  }, [nodes, nodeName, url]);
}
