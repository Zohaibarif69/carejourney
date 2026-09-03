/**
 * Shared file-storage helpers — Vercel Blob backend.
 *
 * Replaces the local-filesystem approach so files persist across
 * Vercel serverless invocations and are shared across all instances.
 *
 * Setup:
 *   1. Vercel Dashboard → Storage → Create Blob Store → connect to project.
 *      Vercel auto-adds BLOB_READ_WRITE_TOKEN to your env vars.
 *   2. Locally, copy that token into .env.local:
 *        BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
 *
 * Local dev without a Blob store: set USE_LOCAL_STORAGE=true in .env.local
 * and files fall back to ./public/uploads (original behaviour).
 */

import { put } from "@vercel/blob";
import path from "path";
import fs from "fs";

const USE_LOCAL = !process.env.BLOB_READ_WRITE_TOKEN || process.env.USE_LOCAL_STORAGE === "true";

const LOCAL_BASE = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve("./public/uploads");

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save a file and return its public URL.
 *
 * On Vercel: uploads to Vercel Blob, returns a persistent https:// CDN URL.
 * Locally (USE_LOCAL_STORAGE=true or no token): writes to ./public/uploads,
 * returns a /api/files/... relative URL (served by the files route).
 */
export async function saveFile(
  /** Path segments used as the storage key / filename, e.g. ["sealed", "doc-123.pdf"] */
  subpath: string[],
  data: Buffer | Uint8Array,
  contentType: string = "application/octet-stream"
): Promise<string> {
  if (USE_LOCAL) {
    return saveFileLocally(subpath, data);
  }
  const pathname = subpath.join("/");
  const blob = await put(pathname, Buffer.from(data), { access: "public", contentType });
  return blob.url;
}

/**
 * Legacy compat: returns a local /api/files/... URL for a given subpath.
 * With Vercel Blob the real URL comes from saveFile() at upload time and
 * should be stored in the DB. This shim is kept so call sites that only
 * need the URL pattern (e.g. for display before upload) still compile.
 */
export function getUploadUrl(...subpath: string[]): string {
  return `/api/files/${subpath.map(encodeURIComponent).join("/")}`;
}

/**
 * Returns (and creates) a writable local directory — only used in local mode.
 * Kept for the files/[...path] route which needs to know where local files live.
 */
export function getUploadDir(...subdirs: string[]): string {
  const dir = path.join(LOCAL_BASE, ...subdirs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** The base dir used by /api/files/[...path] to serve locally-saved files. */
export const LOCAL_UPLOAD_BASE = LOCAL_BASE;

// ─── Internal ─────────────────────────────────────────────────────────────────

async function saveFileLocally(subpath: string[], data: Buffer | Uint8Array): Promise<string> {
  const dir = getUploadDir(...subpath.slice(0, -1));
  const fileName = subpath[subpath.length - 1];
  fs.writeFileSync(path.join(dir, fileName), data);
  return getUploadUrl(...subpath);
}
