/**
 * Doctavian Document Generation — real 5-step pipeline.
 *
 * Every request/response shape below is copied directly from the hackathon
 * Postman collection ("Mission 1 — Command and Conquer Your Document
 * Empire"), NOT guessed. Auth is X-Api-Key only, per Doctavian's onboarding
 * email for this demo environment (confirmed — no OAuth Bearer needed here).
 *
 * ⚠️ ONE UNVERIFIED PIECE: the exact placeholder/expression syntax used
 * inside the .docx template (this code assumes {{fieldName}} — the most
 * common convention across similar platforms, but Doctavian's own template
 * authoring guide is gated behind portal login and wasn't reachable here).
 * Before relying on this for the demo, generate one test document and open
 * it — if the {{...}} placeholders show up literally instead of being
 * replaced, check the "Missions" walkthrough in your logged-in developer
 * portal (developers.doctavian.com/en/get-started) for the real syntax and
 * update consent-template.docx accordingly.
 *
 * Steps 1–3 (data source, solution, template upload) only need to happen
 * ONCE — their ids are cached to a local JSON file so repeated consultations
 * don't recreate them. Steps 4–5 (data upload + generate) happen per patient.
 */

import fs from "fs";
import path from "path";
import type { Journey } from "@/types";

const CACHE_PATH = path.resolve("./.doctavian-setup-cache.json");

interface SetupCache {
  dataSourceGuid?: string;
  documentSolutionGuid?: string;
  templateId?: string;
}

function loadCache(): SetupCache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveCache(cache: SetupCache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function headers() {
  return { "X-Api-Key": process.env.DOCTAVIAN_API_KEY ?? "" };
}

function baseUrl() {
  return process.env.DOCTAVIAN_API_URL ?? "https://demo.api.doctavian.com";
}

/**
 * Runs steps 1–3 exactly once (cached after first successful run):
 *   1. POST /v1/documents/datasource/create
 *   2. POST /v1/documents/solution/create
 *   3. POST /v1/documents/template/upload
 */
async function ensureSetup(): Promise<Required<SetupCache>> {
  const cache = loadCache();
  if (cache.dataSourceGuid && cache.documentSolutionGuid && cache.templateId) {
    return cache as Required<SetupCache>;
  }

  // Step 1 — Data Source
  let dataSourceGuid = cache.dataSourceGuid;
  if (!dataSourceGuid) {
    const res = await fetch(`${baseUrl()}/v1/documents/datasource/create`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "CareJourney Consent Data Source",
        description: "Patient consent fields for consultation sign-off.",
        variables: "[]",
        loadMethod: "Storage",
      }),
    });
    if (!res.ok) throw new Error(`Doctavian datasource/create ${res.status}`);
    const data = await res.json();
    dataSourceGuid = data.result?.data?.dataSourceGuid;
    if (!dataSourceGuid) throw new Error("Doctavian datasource/create response missing dataSourceGuid");
  }

  // Step 2 — Document Solution
  let documentSolutionGuid = cache.documentSolutionGuid;
  if (!documentSolutionGuid) {
    const res = await fetch(`${baseUrl()}/v1/documents/solution/create`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "CareJourney Consent Solution",
        description: "Ties the consent Data Source to the consent template.",
        dataGuid: dataSourceGuid,
      }),
    });
    if (!res.ok) throw new Error(`Doctavian solution/create ${res.status}`);
    const data = await res.json();
    documentSolutionGuid = data.result?.data?.documentSolution?.documentSolutionGuid;
    if (!documentSolutionGuid) throw new Error("Doctavian solution/create response missing documentSolutionGuid");
  }

  // Step 3 — Upload the template
  let templateId = cache.templateId;
  if (!templateId) {
    const templatePath = path.resolve("./doctavian-assets/consent-template.docx");
    const fileBuffer = fs.readFileSync(templatePath);
    const form = new FormData();
    form.append("file", new Blob([fileBuffer]), "consent-template.docx");

    const res = await fetch(`${baseUrl()}/v1/documents/template/upload`, {
      method: "POST",
      headers: headers(),
      body: form,
    });
    if (!res.ok) throw new Error(`Doctavian template/upload ${res.status}`);
    const data = await res.json();
    templateId = data.result?.data?.files?.[0]?.id;
    if (!templateId) throw new Error("Doctavian template/upload response missing file id");
  }

  const result = { dataSourceGuid, documentSolutionGuid, templateId };
  saveCache(result);
  return result;
}

/**
 * Runs steps 4–5 for one patient, then downloads the generated PDF:
 *   4. POST /v1/documents/data/upload
 *   5. POST /v1/documents/document/generate
 *   6. GET  /v1/documents/document/{urn}/download
 */
export async function generateConsentDocument(
  service: string,
  providerName: string,
  patient: Journey["patient"],
  answers: Record<string, string>
): Promise<Buffer> {
  const { templateId } = await ensureSetup();

  const consultationSummary =
    Object.entries(answers)
      .map(([q, a]) => `${q}: ${a}`)
      .join("\n") || "No additional consultation notes recorded.";

  const dataPayload = {
    service,
    providerName,
    patientName: patient.name || "Patient",
    patientEmail: patient.email || "",
    consultationSummary,
    consentDate: new Date().toISOString().slice(0, 10),
  };

  // Step 4 — Upload the data
  const dataForm = new FormData();
  dataForm.append(
    "file",
    new Blob([JSON.stringify(dataPayload)], { type: "application/json" }),
    "consent-data.json"
  );
  const dataRes = await fetch(`${baseUrl()}/v1/documents/data/upload`, {
    method: "POST",
    headers: headers(),
    body: dataForm,
  });
  if (!dataRes.ok) throw new Error(`Doctavian data/upload ${dataRes.status}`);
  const dataResJson = await dataRes.json();
  const dataId = dataResJson.result?.data?.files?.[0]?.id;
  if (!dataId) throw new Error("Doctavian data/upload response missing file id");

  // Step 5 — Generate the document
  const genRes = await fetch(`${baseUrl()}/v1/documents/document/generate`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      externalContext: { id: `consent-${Date.now()}` },
      template: {
        name: "consent-template.docx",
        urn: templateId,
        fileFormat: "docx",
        loadMethod: "Storage",
        options: {},
      },
      data: {
        loadMethod: "Storage",
        urn: dataId,
      },
      document: {
        name: `Consent-${patient.name || "Patient"}`.replace(/\s+/g, "-"),
        fileFormat: "pdf",
        deliveryMethod: "Storage",
        path: "root",
        locale: "en",
        timezone: "UTC",
        options: {},
      },
    }),
  });
  if (!genRes.ok) throw new Error(`Doctavian document/generate ${genRes.status}`);
  const genResJson = await genRes.json();
  const documentUrn = genResJson.result?.data?.document?.urn;
  if (!documentUrn) throw new Error("Doctavian document/generate response missing document urn");

  // Step 6 — Download the generated PDF
  const downloadRes = await fetch(`${baseUrl()}/v1/documents/document/${documentUrn}/download`, {
    headers: headers(),
  });
  if (!downloadRes.ok) throw new Error(`Doctavian document/download ${downloadRes.status}`);
  const arrayBuffer = await downloadRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
