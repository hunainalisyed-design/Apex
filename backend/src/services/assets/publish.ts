import { constants } from "node:fs";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { basename, join, posix, resolve } from "node:path";
import { computeContentHash, toVersionedFilename } from "./versioning.js";

export interface PublishResult {
  /** Root-relative URL to store on the Vehicle/CustomizationOption row. */
  url: string;
  /** Absolute path of the versioned file on disk. */
  filePath: string;
  /** False when an identical file was already published under this exact name. */
  created: boolean;
}

/**
 * Copies `sourcePath` into `<publicRoot>/<subdir>/` under its content-addressed name (Spec 25,
 * AC-1/AC-2). Never overwrites or deletes anything: the copy is exclusive, so an existing file
 * with this name is left untouched — and since the name embeds the content hash, an existing
 * file of that name already holds these exact bytes (verified, not assumed, below).
 */
export async function publishVersionedAsset(sourcePath: string, publicRoot: string, subdir: string): Promise<PublishResult> {
  const content = await readFile(sourcePath);
  const hash = computeContentHash(content);
  const filename = toVersionedFilename(basename(sourcePath), hash);

  const cleanSubdir = subdir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (cleanSubdir.split("/").includes("..")) throw new Error(`Refusing subdir "${subdir}": it escapes the public root.`);

  const targetDir = resolve(publicRoot, cleanSubdir);
  const filePath = join(targetDir, filename);
  const url = "/" + posix.join(cleanSubdir, filename);
  await mkdir(targetDir, { recursive: true });

  try {
    await copyFile(sourcePath, filePath, constants.COPYFILE_EXCL);
    return { url, filePath, created: true };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    const existingHash = computeContentHash(await readFile(filePath));
    if (existingHash !== hash) {
      throw new Error(`${filePath} already exists with different content (hash ${existingHash}); refusing to overwrite it.`);
    }
    return { url, filePath, created: false };
  }
}
