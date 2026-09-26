import { BufferAttribute, BufferGeometry, type Object3D, Mesh } from "three";
import { MeshoptSimplifier } from "meshoptimizer/simplifier";

/** Meshes smaller than this aren't worth simplifying — they're a rounding error in file size
 * and the most likely to visibly break (badges, bolts, light lenses). */
const MIN_INDEX_COUNT = 300;

/** Allowed deviation, relative to each mesh's own size — small enough that panels keep their
 * shape at life-size AR viewing distance (checked visually during Spec 27's Step 0). */
const TARGET_ERROR = 0.01;

/**
 * A reduced copy of `geometry` keeping about `ratio` of its triangles, with vertices no
 * longer used dropped (USDZExporter writes every vertex, used or not). Mesh borders are locked
 * so separate panels don't open gaps between each other. Returns null when the geometry isn't
 * a safe candidate: non-indexed, tiny, or split into several material groups (simplifying
 * across groups would reassign faces to the wrong material).
 */
export function simplifyGeometry(geometry: BufferGeometry, ratio: number): BufferGeometry | null {
  const index = geometry.index;
  if (!index || index.count < MIN_INDEX_COUNT || geometry.groups.length > 1) return null;

  const position = geometry.attributes.position;
  const positions = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    positions[i * 3] = position.getX(i);
    positions[i * 3 + 1] = position.getY(i);
    positions[i * 3 + 2] = position.getZ(i);
  }

  const targetIndexCount = Math.max(3, Math.floor((index.count * ratio) / 3) * 3);
  const [simplified] = MeshoptSimplifier.simplify(
    new Uint32Array(index.array),
    positions,
    3,
    targetIndexCount,
    TARGET_ERROR,
    ["LockBorder"],
  );
  const [remap, vertexCount] = MeshoptSimplifier.compactMesh(simplified);

  const result = new BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const size = attribute.itemSize;
    const values = new Float32Array(vertexCount * size);
    for (let oldIndex = 0; oldIndex < attribute.count; oldIndex++) {
      const newIndex = remap[oldIndex];
      if (newIndex === 0xffffffff) continue; // vertex no longer referenced
      for (let c = 0; c < size; c++) values[newIndex * size + c] = attribute.getComponent(oldIndex, c);
    }
    result.setAttribute(name, new BufferAttribute(values, size));
  }
  result.setIndex(new BufferAttribute(simplified, 1));
  return result;
}

/** Replaces every eligible mesh's geometry under `root` with a simplified copy (in place —
 * call this on an export clone, never the live scene). Resolves once the WASM is ready. */
export async function simplifyObject(root: Object3D, ratio: number): Promise<void> {
  await MeshoptSimplifier.ready;
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const simplified = simplifyGeometry(child.geometry, ratio);
    if (simplified) child.geometry = simplified;
  });
}
