/** A minimal structurally-valid GLB for Spec 27 tests: a 12-byte header whose declared total
 * length matches, followed by `extraBytes` of payload. */
export function makeGlb(extraBytes = 0): Buffer {
  const glb = Buffer.alloc(12 + extraBytes);
  glb.write("glTF", 0, "ascii");
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  return glb;
}
