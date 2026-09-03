export const runtime = "nodejs";

/**
 * POST /api/visual/explore  (multipart/form-data: file + experience)
 * Returns: { originalUrl, resultUrl, experience }
 *
 * Calls Perfect Corp API server-side. NOT tied to a journey ID —
 * patient can explore visually before a journey exists.
 */

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/apiHelpers";
import { saveFile } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const experience = formData.get("experience") as string | null;

    if (!file) return err("file is required");
    if (!experience) return err("experience is required");

    const safeName = `visual-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Save original file via persistent storage (Blob on Vercel, local in dev)
    const originalUrl = await saveFile(["visual", safeName], buffer, file.type || "image/jpeg");

    const resultUrl = await callPerfectCorp(buffer, file.name, experience, originalUrl);

    return ok({ originalUrl, resultUrl, experience });
  } catch (e) {
    console.error("visual/explore error:", e);
    return err("Visual exploration failed", 500);
  }
}

async function callPerfectCorp(
  buffer: Buffer,
  fileName: string,
  experience: string,
  fallbackUrl: string
): Promise<string> {
  const feature = process.env.PERFECT_CORP_FEATURE || "makeup-vto";
  const headers = { Authorization: `Bearer ${process.env.PERFECT_CORP_API_KEY}` };

  try {
    // Step 1: upload the file
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)]), fileName);

    const uploadRes = await fetch(`${process.env.PERFECT_CORP_API_URL}/s2s/v2.0/file/${feature}`, {
      method: "POST", headers, body: form,
    });
    if (!uploadRes.ok) throw new Error(`Perfect Corp upload ${uploadRes.status}`);
    const uploadData = await uploadRes.json();
    const fileId = uploadData.result?.file_id ?? uploadData.file_id;
    if (!fileId) throw new Error("Perfect Corp upload response missing file_id");

    // Step 2: run the AI task
    const taskRes = await fetch(`${process.env.PERFECT_CORP_API_URL}/s2s/v2.0/task/${feature}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, experience }),
    });
    if (!taskRes.ok) throw new Error(`Perfect Corp task ${taskRes.status}`);
    const taskData = await taskRes.json();
    const taskId = taskData.result?.task_id ?? taskData.task_id;
    if (!taskId) throw new Error("Perfect Corp task response missing task_id");

    // Step 3: poll for result
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(
        `${process.env.PERFECT_CORP_API_URL}/s2s/v2.0/task/${feature}?task_id=${taskId}`,
        { headers }
      );
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();
      const status = statusData.result?.status ?? statusData.status;
      if (status === "success" || status === "completed") {
        const resultUrl = statusData.result?.result_url ?? statusData.result?.url;
        if (resultUrl) return resultUrl;
        break;
      }
      if (status === "failed" || status === "error") break;
    }

    console.warn("[API-FALLBACK][PerfectCorp] Task did not complete within poll window — using simulated preview.");
    return buildFallbackPreview(buffer, fileName, fallbackUrl, experience);
  } catch (e) {
    console.warn("[API-FALLBACK][PerfectCorp] Call failed — using simulated preview. Reason:", e);
    return buildFallbackPreview(buffer, fileName, fallbackUrl, experience);
  }
}

async function buildFallbackPreview(
  buffer: Buffer,
  fileName: string,
  originalUrl: string,
  experience: string
): Promise<string> {
  try {
    const label = experience.replace(/[<>&]/g, "").slice(0, 40);
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "jpg";
    const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const base64 = buffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <filter id="previewFilter">
      <feColorMatrix type="saturate" values="1.25"/>
      <feComponentTransfer>
        <feFuncR type="linear" slope="1.05" intercept="0.02"/>
        <feFuncG type="linear" slope="1.02" intercept="0.01"/>
        <feFuncB type="linear" slope="0.98"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <image href="${dataUri}" x="0" y="0" width="800" height="800"
    preserveAspectRatio="xMidYMid slice" filter="url(#previewFilter)"/>
  <rect x="0" y="720" width="800" height="80" fill="rgba(0,0,0,0.55)"/>
  <text x="20" y="758" font-family="sans-serif" font-size="22" fill="#ffffff">
    Simulated preview — ${label}
  </text>
  <text x="20" y="784" font-family="sans-serif" font-size="14" fill="#dddddd">
    Live visualization service unavailable — showing an adjusted preview
  </text>
</svg>`;

    const svgName = `visual-preview-${Date.now()}.svg`;
    const svgBuffer = Buffer.from(svg, "utf-8");
    return await saveFile(["visual", svgName], svgBuffer, "image/svg+xml");
  } catch (e) {
    console.warn("[API-FALLBACK][PerfectCorp] Failed to build simulated preview — returning original photo.", e);
    return originalUrl;
  }
}
