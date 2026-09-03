export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, dbRun } from "@/lib/db";
import { ok, err, notFound } from "@/lib/apiHelpers";
import { rowToDoc } from "@/app/api/journeys/route";
import { saveFile } from "@/lib/storage";
import fs from "fs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await dbGet("SELECT * FROM documents WHERE id = ?", [id]);
  if (!doc) return notFound("Document not found");

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return err("file field is required");

    const safeName = `${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // saveFile handles both Vercel Blob (persistent) and local fallback
    const fileUrl = await saveFile([safeName], buffer, file.type || "application/octet-stream");

    const foxitJobId = await startFoxitJob(buffer, file.name, doc.label as string);

    await dbRun(
      `UPDATE documents SET file_name = ?, file_url = ?, status = 'processing', foxit_job_id = ?, processing_step = 1 WHERE id = ?`,
      [file.name, fileUrl, foxitJobId, id]
    );

    const updated = await dbGet("SELECT * FROM documents WHERE id = ?", [id]);
    return ok(rowToDoc(updated!));
  } catch (e) {
    console.error("upload error:", e);
    await dbRun("UPDATE documents SET status = 'error' WHERE id = ?", [id]);
    return err("Upload failed", 500);
  }
}

async function startFoxitJob(buffer: Buffer, fileName: string, label: string): Promise<string> {
  if (label === "photo") return `foxit-placeholder-${Date.now()}`;

  const foxitHeaders = {
    client_id: process.env.FOXIT_CLIENT_ID ?? "",
    client_secret: process.env.FOXIT_CLIENT_SECRET ?? "",
  };

  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)]), fileName);

    const uploadRes = await fetch(`${process.env.FOXIT_API_URL}/documents/upload`, {
      method: "POST", headers: foxitHeaders, body: form,
    });
    if (!uploadRes.ok) throw new Error(`Foxit upload ${uploadRes.status}`);
    const uploadData = await uploadRes.json();
    const documentId = uploadData.documentId;
    if (!documentId) throw new Error("Foxit upload response missing documentId");

    const extractRes = await fetch(`${process.env.FOXIT_API_URL}/documents/pdf-structural-extract`, {
      method: "POST",
      headers: { ...foxitHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    if (!extractRes.ok) throw new Error(`Foxit extract ${extractRes.status}`);
    const extractData = await extractRes.json();
    const taskId = extractData.taskId;
    if (!taskId) throw new Error("Foxit extract response missing taskId");

    return taskId;
  } catch (e) {
    console.warn("[API-FALLBACK][Foxit] Upload/OCR start failed — using placeholder job.", e);
    return `foxit-placeholder-${Date.now()}`;
  }
}
