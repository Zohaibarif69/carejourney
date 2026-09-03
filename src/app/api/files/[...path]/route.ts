export const runtime = "nodejs";

/**
 * GET /api/files/[...path]
 *
 * Serves locally-saved files in development (when USE_LOCAL_STORAGE=true or
 * no BLOB_READ_WRITE_TOKEN is set). On Vercel with Blob enabled, uploaded files
 * get direct CDN URLs from saveFile() and this route is rarely hit.
 */

import { NextRequest, NextResponse } from "next/server";
import { LOCAL_UPLOAD_BASE } from "@/lib/storage";
import path from "path";
import fs from "fs";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  if (segments.some((s) => s === ".." || s === ".")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const filePath = path.join(LOCAL_UPLOAD_BASE, ...segments);
  if (!filePath.startsWith(LOCAL_UPLOAD_BASE)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
