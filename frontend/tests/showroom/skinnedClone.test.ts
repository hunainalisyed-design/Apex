import {
  Bone,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from "three";
import { clone as cloneWithSkeletons } from "three/examples/jsm/utils/SkeletonUtils.js";
import { describe, expect, it } from "vitest";
import { prepareArScene } from "../../src/lib/ar/exportModel";

/**
 * A tiny "car" with a skeleton, like the Mustang and Pagani GLBs: one skinned box, every vertex
 * fully bound to one bone. Found by Spec 37: a plain `.clone(true)` of such a model keeps
 * following the ORIGINAL bones, so moving the copy doesn't move what's drawn.
 */
function skinnedModel(): Group {
  const root = new Group();
  const bone = new Bone();
  root.add(bone);
  const geometry = new BoxGeometry(4, 1, 2);
  const count = geometry.attributes.position.count;
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(Array.from({ length: count }, () => [1, 0, 0, 0]).flat(), 4));
  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial());
  mesh.name = "body";
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new Skeleton([bone]));
  return root;
}

/** Where vertex 0 is actually drawn: through its bones, in world space. */
function drawnVertex(root: Group): Vector3 {
  root.updateMatrixWorld(true);
  const mesh = root.getObjectByName("body") as SkinnedMesh;
  mesh.skeleton.update();
  const v = new Vector3().fromBufferAttribute(mesh.geometry.attributes.position, 0);
  mesh.applyBoneTransform(0, v);
  return v.applyMatrix4(mesh.matrixWorld);
}

describe("copying a skinned model", () => {
  it("a plain clone stays stuck to the original skeleton (the bug)", () => {
    const original = skinnedModel();
    const copy = original.clone(true);
    const before = drawnVertex(copy);
    copy.position.set(10, 0, 0);
    const after = drawnVertex(copy);
    expect(after.x - before.x).toBeCloseTo(0); // moved the copy, nothing moved on screen
  });

  it("SkeletonUtils.clone gives the copy its own skeleton, so it moves with its transform", () => {
    const original = skinnedModel();
    const copy = cloneWithSkeletons(original) as Group;
    const mesh = copy.getObjectByName("body") as SkinnedMesh;
    expect(mesh.skeleton.bones.every((bone) => copy.getObjectById(bone.id) !== undefined)).toBe(true);

    const before = drawnVertex(copy);
    copy.position.set(10, 0, 0);
    expect(drawnVertex(copy).x - before.x).toBeCloseTo(10);
    // …and the original is untouched.
    expect(drawnVertex(original).x).toBeCloseTo(before.x);
  });

  it("the AR copy of a skinned car follows its rescale to real-world size (Spec 27)", () => {
    const live = skinnedModel(); // 4 units long
    const ar = prepareArScene(live, 8); // → 8 m long: every drawn vertex should double
    const liveVertex = drawnVertex(live);
    const arVertex = drawnVertex(ar);
    expect(Math.abs(arVertex.x)).toBeCloseTo(Math.abs(liveVertex.x) * 2, 5);
    // The AR copy has its own skeleton — the live car's bones are not in it.
    const arMesh = ar.getObjectByName("body") as SkinnedMesh;
    const liveBone = (live.getObjectByName("body") as SkinnedMesh).skeleton.bones[0];
    expect(arMesh.skeleton.bones[0]).not.toBe(liveBone);
  });
});
