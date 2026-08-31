/**
 * Foxit eSign — the deliberate human-triggered signing step.
 *
 * Foxit's own hackathon challenge is explicit about this boundary: their
 * MCP server (src/lib/foxitAgent.ts) intentionally leaves signing OUT of
 * its tool catalog. To send anything for signature, the call has to be
 * made directly, with its OWN credentials — separate from PDF Services —
 * and a real person has to trigger it. This file is that separate call,
 * never exposed to the agent's tool loop.
 *
 * Verified against Foxit's own developer blog tutorials (not guessed):
 *   - OAuth2 client_credentials token exchange
 *   - POST /api/folders/createfolder request shape (folderName, parties,
 *     fileUrls, permission, sequence, etc.)
 *
 * ⚠️ ONE REAL CONSTRAINT, not a bug: Foxit's servers fetch `fileUrls` over
 * the public internet. A localhost dev URL (http://localhost:3000/...)
 * is NOT reachable by Foxit — this will only work once NEXT_PUBLIC_APP_URL
 * points to a publicly reachable URL (a real deployment, or a tunnel like
 * ngrok during local testing).
 */

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getEsignAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const tokenUrl = process.env.FOXIT_ESIGN_TOKEN_URL ?? "https://na1.foxitesign.foxit.com/api/oauth2/access_token";
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.FOXIT_ESIGN_CLIENT_ID ?? "",
      client_secret: process.env.FOXIT_ESIGN_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) throw new Error(`Foxit eSign token exchange ${res.status}`);
  const data = await res.json();
  const accessToken = data.access_token;
  const expiresIn = data.expires_in ?? 3600;
  if (!accessToken) throw new Error("Foxit eSign token response missing access_token");

  cachedToken = { value: accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  return accessToken;
}

export interface EsignParty {
  firstName: string;
  lastName: string;
  emailId: string;
}

/**
 * Sends a document for real signature via Foxit eSign's createfolder
 * endpoint. Called ONLY from a route a human explicitly triggers — never
 * from the agent loop in foxitAgent.ts.
 */
export async function sendForFoxitSignature(
  folderName: string,
  documentPublicUrl: string,
  documentFileName: string,
  parties: EsignParty[]
): Promise<{ folderId: string }> {
  const accessToken = await getEsignAccessToken();
  const apiUrl = process.env.FOXIT_ESIGN_API_URL ?? "https://na1.foxitesign.foxit.com/api";

  const res = await fetch(`${apiUrl}/folders/createfolder`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      folderName,
      sendNow: true,
      processTextTags: false,
      fileUrls: [documentPublicUrl],
      fileNames: [documentFileName],
      parties: parties.map((p, i) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        emailId: p.emailId,
        permission: "FILL_FIELDS_AND_SIGN",
        sequence: i + 1,
      })),
    }),
  });
  if (!res.ok) throw new Error(`Foxit eSign createfolder ${res.status}`);
  const data = await res.json();
  const folderId = data.folderId ?? data.id;
  if (!folderId) throw new Error("Foxit eSign createfolder response missing folderId");

  return { folderId };
}
