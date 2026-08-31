export const runtime = "nodejs";

/**
 * POST /api/documents/foxit-esign
 * Body: { folderName: string, documentPublicUrl: string, documentFileName: string,
 *         parties: { firstName: string, lastName: string, emailId: string }[] }
 * Returns: { folderId: string }
 *
 * This is the deliberate human decision point Foxit's challenge is about:
 * a real person on this route triggers a real signature request — it is
 * NEVER called from the agent loop in /api/documents/agent-process.
 * See src/lib/foxitEsign.ts for the real, separate OAuth2 + createfolder
 * integration this calls.
 */

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/apiHelpers";
import { sendForFoxitSignature, type EsignParty } from "@/lib/foxitEsign";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { folderName, documentPublicUrl, documentFileName, parties } = body as {
      folderName?: string;
      documentPublicUrl?: string;
      documentFileName?: string;
      parties?: EsignParty[];
    };

    if (!folderName || !documentPublicUrl || !documentFileName || !parties?.length) {
      return err(
        "Missing required fields: folderName, documentPublicUrl, documentFileName, parties",
        400
      );
    }

    const result = await sendForFoxitSignature(folderName, documentPublicUrl, documentFileName, parties);
    return ok(result);
  } catch (e) {
    console.error("[Foxit eSign] error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return err(`Foxit eSign failed: ${message}`, 500);
  }
}
