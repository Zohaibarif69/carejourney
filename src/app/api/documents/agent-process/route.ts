export const runtime = "nodejs";

/**
 * POST /api/documents/agent-process
 * Body: { prompt: string }
 * Returns: { steps: AgentStep[], finalText: string }
 *
 * Runs a real agentic loop: Claude decides which of Foxit's actual MCP
 * tools to call, in what order, based on the plain-language prompt — this
 * is the "prompt in, signed-ready document out" pattern Foxit's challenge
 * asks for on the reversible-operations side. See src/lib/foxitAgent.ts.
 *
 * Requires the Foxit MCP sidecar running (npm run dev starts it
 * automatically now — see package.json's "dev" script).
 */

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/apiHelpers";
import { runFoxitAgent } from "@/lib/foxitAgent";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return err("Missing required field: prompt", 400);
    }

    const result = await runFoxitAgent(prompt);
    return ok(result);
  } catch (e) {
    console.error("[Foxit Agent] error:", e);
    const message = e instanceof Error ? e.message : String(e);
    // Common failure mode: the MCP sidecar isn't running.
    const hint = message.includes("fetch failed") || message.includes("ECONNREFUSED")
      ? " (Is the Foxit MCP sidecar running? It should start automatically with `npm run dev` — check your terminal for a 'foxit-mcp' process.)"
      : "";
    return err(`Agent processing failed: ${message}${hint}`, 500);
  }
}
