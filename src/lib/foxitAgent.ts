/**
 * Foxit MCP Agent — powered by Gemini instead of Anthropic.
 *
 * Same agentic behaviour as before: connects to the live Foxit MCP sidecar,
 * fetches its real tool list, and runs a tool-use loop until Gemini produces
 * a final answer or the step limit is hit.
 *
 * Gemini differences vs Anthropic handled here:
 *  - Tool schema uses `parameters` (not `input_schema`)
 *  - Tool calls come back as `part.functionCall` (not `type: "tool_use"`)
 *  - Tool results go back as Part[] with `functionResponse` objects
 *  - No per-call `id` — Gemini matches results by function name
 *  - Stop signal: no functionCall parts in the response
 *  - Loop: sendMessage(functionResponseParts) returns the next model turn
 *    directly — we process that response in-place, no extra empty send needed
 *
 * Prerequisite: the Foxit MCP server must be running as a sidecar process
 * (`npm run foxit-mcp`, or automatically via `npm run dev`).
 * It listens on HTTP stream transport at http://localhost:8081/mcp by default.
 */

import { GoogleGenerativeAI, Tool, FunctionDeclaration, Part } from "@google/generative-ai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.FOXIT_MCP_URL ?? "http://localhost:8081/mcp";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export interface AgentStep {
  type: "tool_call" | "tool_result" | "final_text";
  toolName?: string;
  toolInput?: unknown;
  content: string;
}

/**
 * Converts an MCP tool's inputSchema (JSON Schema) into Gemini's
 * FunctionDeclaration format. Gemini uses `parameters` with the same
 * JSON Schema shape — mostly a rename + type cast.
 */
function mcpToolToGemini(t: {
  name: string;
  description?: string;
  inputSchema?: unknown;
}): FunctionDeclaration {
  const schema = (t.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown>;
  return {
    name: t.name,
    description: t.description ?? "",
    parameters: schema as never,
  };
}

/**
 * Extracts text and functionCall parts from a Gemini response's parts array.
 */
function parseParts(parts: Part[]) {
  const textParts = parts.filter((p) => typeof p.text === "string" && p.text.trim() !== "");
  const fnCalls = parts.filter((p) => p.functionCall != null);
  return { textParts, fnCalls };
}

export async function runFoxitAgent(
  prompt: string,
  opts: { maxSteps?: number } = {}
): Promise<{ steps: AgentStep[]; finalText: string }> {
  const maxSteps = opts.maxSteps ?? 8;
  const steps: AgentStep[] = [];

  // --- Connect to Foxit MCP sidecar ---
  const mcpClient = new Client({ name: "carejourney-foxit-agent", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await mcpClient.connect(transport);

  try {
    // Fetch live tool list from MCP server
    const toolsResult = await mcpClient.listTools();
    const geminiTools: Tool[] = [
      {
        functionDeclarations: toolsResult.tools.map(mcpToolToGemini),
      },
    ];

    // --- Set up Gemini ---
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      tools: geminiTools,
      systemInstruction: `You are a document-processing agent with access to Foxit's real PDF tools via MCP.

Important: most Foxit PDF operations are asynchronous — they return a taskId
immediately. After calling a tool that returns a taskId, call get_task_result
to poll until it completes before using the result in a later step.

Work through the user's request step by step, calling only the tools you
actually need. When you're done, give a short plain-text summary of what
you did and the final document/file reference.`,
    });

    // Start chat — Gemini tracks history internally
    const chat = model.startChat();

    // --- Agent loop ---
    // Each iteration processes ONE model response (either tool calls or final text).
    // We send the initial prompt, then alternate: execute tools → send results →
    // get next model response. sendMessage(functionResponseParts) returns the
    // next model turn directly, so we never send an empty string.

    let currentResult = await chat.sendMessage(prompt);

    for (let i = 0; i < maxSteps; i++) {
      const parts: Part[] = currentResult.response.candidates?.[0]?.content?.parts ?? [];
      const { textParts, fnCalls } = parseParts(parts);

      // Capture any text the model produced this turn
      for (const p of textParts) {
        steps.push({ type: "final_text", content: p.text! });
      }

      // No function calls → model is done
      if (fnCalls.length === 0) {
        const finalText = textParts.map((p) => p.text).join("\n") || "(agent finished with no summary)";
        return { steps, finalText };
      }

      // Execute all tool calls and build functionResponse parts
      const functionResponseParts: Part[] = [];

      for (const fnPart of fnCalls) {
        const fn = fnPart.functionCall!;
        const toolName = fn.name;
        const toolInput = (fn.args ?? {}) as Record<string, unknown>;

        steps.push({
          type: "tool_call",
          toolName,
          toolInput,
          content: `Calling ${toolName}`,
        });

        try {
          const mcpResult = await mcpClient.callTool({
            name: toolName,
            arguments: toolInput,
          });
          const resultText = JSON.stringify(mcpResult.content);

          steps.push({ type: "tool_result", toolName, content: resultText });

          functionResponseParts.push({
            functionResponse: {
              name: toolName,
              response: { result: resultText },
            },
          });
        } catch (toolError) {
          const errMsg = toolError instanceof Error ? toolError.message : String(toolError);
          steps.push({ type: "tool_result", toolName, content: `ERROR: ${errMsg}` });

          functionResponseParts.push({
            functionResponse: {
              name: toolName,
              response: { error: errMsg },
            },
          });
        }
      }

      // Send all tool results back — this returns the next model response directly.
      // We assign it to currentResult so the next loop iteration processes it.
      currentResult = await chat.sendMessage(functionResponseParts);
    }

    return { steps, finalText: "(agent hit step limit before finishing)" };
  } finally {
    await mcpClient.close();
  }
}
