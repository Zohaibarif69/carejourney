export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/apiHelpers";
import { saveFile, getUploadUrl } from "@/lib/storage";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return err("file field is required");

    const safeName = `${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const url = await saveFile([safeName], buffer, file.type || "application/octet-stream");
    return ok({ url, fileName: file.name });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Upload failed", 500);
  }
}
