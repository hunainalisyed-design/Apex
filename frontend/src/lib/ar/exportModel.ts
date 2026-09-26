import { Box3, Group, Mesh, type Object3D, type Texture, Vector3 } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import type { ArPlatform } from "./capability";

/** An exported AR file — raw bytes plus the media type the viewer expects. Kept as bytes
 * (not a Blob) so callers choose how to hand it off: a blob URL for Quick Look, an upload
 * body for Scene Viewer. */
export interface ArFile {
  bytes: Uint8Array<ArrayBuffer>;
  mimeType: "model/gltf-binary" | "model/vnd.usdz+zip";
}

export interface ArExportOptions {
  /** The real car's overall length in metres (realGlbVehicles.ts). */
  lengthMeters: number;
  /** iOS only: fraction of triangles to keep; omit to export full detail. */
  usdzTriangleRatio?: number;
}

/** Texture slots on MeshStandard/PhysicalMaterial whose images get re-encoded on export. */
const TEXTURE_SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"] as const;

/**
 * A detached copy of the car (Spec 27): the showroom's rig normalizes every model to a
 * framing length in scene units, so it's re-scaled here to the real car's length in metres
 * (AR viewers treat 1 unit = 1 m — AC-4), centred and standing on y=0. Geometry and materials
 * stay shared with the live scene (no copies, so current paint is included, AC-2); callers
 * that alter geometry must swap it, never mutate it — simplifyObject does exactly that.
 */
export function prepareArScene(vehicle: Object3D, lengthMeters: number): Group {
  const copy = vehicle.clone(true);
  copy.position.set(0, 0, 0);
  copy.rotation.set(0, 0, 0);
  copy.scale.set(1, 1, 1);
  copy.updateMatrixWorld(true);

  const size = new Box3().setFromObject(copy).getSize(new Vector3());
  const longest = Math.max(size.x, size.z);
  if (longest > 0) copy.scale.setScalar(lengthMeters / longest);
  copy.updateMatrixWorld(true);

  const box = new Box3().setFromObject(copy);
  const center = box.getCenter(new Vector3());
  copy.position.set(-center.x, -box.min.y, -center.z);

  const root = new Group();
  root.name = "ArVehicle";
  root.add(copy);
  root.updateMatrixWorld(true);
  return root;
}

function collectTextures(root: Object3D): Set<Texture> {
  const textures = new Set<Texture>();
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    for (const material of [child.material].flat()) {
      for (const slot of TEXTURE_SLOTS) {
        const texture = (material as unknown as Record<string, Texture | null>)[slot];
        if (texture) textures.add(texture);
      }
    }
  });
  return textures;
}

/** Whether an image has any meaningfully transparent pixel (sampled at 64×64). Any doubt —
 * including a cross-origin image whose pixels can't be read — counts as transparent, which
 * just keeps it as PNG instead of failing the export. */
function hasTransparency(texture: Texture): boolean {
  const image = texture.image as CanvasImageSource & { width?: number } | undefined;
  if (!image || typeof document === "undefined") return true;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return true;
  try {
    context.drawImage(image, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 250) return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * Binary glTF for Android Scene Viewer (AC-3). The source models' WebP textures would
 * otherwise be re-encoded as PNG; opaque ones are written as JPEG instead, which roughly
 * halves the file (Step 0: 19 MB → 11 MB for the Revuelto). The mime-type hint is restored
 * afterwards since those textures are shared with the live scene.
 */
export async function exportGlb(root: Object3D): Promise<ArFile> {
  const textures = [...collectTextures(root)];
  const previous = textures.map((t) => t.userData.mimeType as string | undefined);
  try {
    for (const texture of textures) if (!hasTransparency(texture)) texture.userData.mimeType = "image/jpeg";
    const result = await new GLTFExporter().parseAsync(root, { binary: true, maxTextureSize: 2048 });
    return { bytes: new Uint8Array(result as ArrayBuffer), mimeType: "model/gltf-binary" };
  } finally {
    textures.forEach((texture, i) => {
      if (previous[i] === undefined) delete texture.userData.mimeType;
      else texture.userData.mimeType = previous[i];
    });
  }
}

/** USDZ for iOS Quick Look (AC-3) — iOS can't open glTF. Heavy models are simplified first
 * (see RealGlbVehicleConfig.usdzTriangleRatio); the simplifier is loaded only on this path. */
export async function exportUsdz(root: Object3D, triangleRatio?: number): Promise<ArFile> {
  if (triangleRatio !== undefined && triangleRatio < 1) {
    const { simplifyObject } = await import("./simplify");
    await simplifyObject(root, triangleRatio);
  }
  const result = await new USDZExporter().parseAsync(root, { quickLookCompatible: true, maxTextureSize: 1024 });
  return { bytes: new Uint8Array(result), mimeType: "model/vnd.usdz+zip" };
}

/** The AR file for `platform`, built from the car currently in the scene. */
export async function exportArModel(vehicle: Object3D, platform: ArPlatform, options: ArExportOptions): Promise<ArFile> {
  const root = prepareArScene(vehicle, options.lengthMeters);
  return platform === "ios" ? exportUsdz(root, options.usdzTriangleRatio) : exportGlb(root);
}
