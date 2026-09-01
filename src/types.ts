export interface Provider {
  id: string;
  name: string;
  city: string;
  country: string;
  specialties: string[];
  services: string[];
  description: string;
  phone: string;
  website: string;
  imageUrl: string;
  matchReasons: string[];
  matchStrength: "Strong" | "Good" | "Possible";
  rating?: number;
  reviewCount?: number;
}

export interface RedactionSuggestion {
  id: string;
  label: string;
  page: number;
  confidence: number;
  approved: boolean;
}

export interface DocItem {
  id: string;
  label: string;
  fileName?: string;
  status: "waiting" | "uploaded" | "processing" | "ready" | "error";
  processingStep: number;
  /** Nutrient DWS review/seal fields — populated once Foxit has the file
   * ready. Undefined redactions means suggestions haven't been requested
   * yet; sealed=true means a human reviewed them and Nutrient produced a
   * tamper-evident, dated copy. */
  redactions?: RedactionSuggestion[];
  sealed?: boolean;
  sealedAt?: string;
  sealId?: string;
}

export interface VisualSession {
  originalUrl: string;
  resultUrl: string;
  savedAt: string;
  experience: string;
}

export type JourneyStatus =
  | "draft"
  | "documents"
  | "consultation"
  | "signing"
  | "requested"
  | "confirmed";

export interface Patient {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

export interface FormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "radio" | "select";
  options?: string[];
  required?: boolean;
}

export interface FormSection {
  id: string;
  title: string;
  fields: FormField[];
}

export interface ConsultationAnswers {
  [key: string]: string;
}

/** A single step in the Foxit MCP agent's tool-use loop — see
 * src/lib/foxitAgent.ts. "tool_call"/"tool_result" pairs are the agent
 * using one of Foxit's real reversible document tools; "final_text" is
 * the agent's plain-language summary once it's done. */
export interface AgentStep {
  type: "tool_call" | "tool_result" | "final_text";
  toolName?: string;
  toolInput?: unknown;
  content: string;
}

/** A signer on a Foxit eSign request — see src/lib/foxitEsign.ts. This
 * is the deliberately separate, human-triggered signing step; it is
 * never something the agent above can call on its own. */
export interface EsignParty {
  firstName: string;
  lastName: string;
  emailId: string;
}

export interface Journey {
  id: string;
  providerId: string;
  providerName: string;
  providerCity: string;
  providerCountry: string;
  service: string;
  patient: Patient;
  visualSession?: VisualSession;
  docs: DocItem[];
  consultationAnswers?: ConsultationAnswers;
  consultationSchema?: FormSection[];
  signed?: boolean;
  signedAt?: string;
  status: JourneyStatus;
  createdAt: string;
  updatedAt: string;
}
