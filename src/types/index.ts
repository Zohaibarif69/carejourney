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
  journeyId: string;
  label: string;
  fileName?: string;
  fileUrl?: string;
  status: "waiting" | "uploaded" | "processing" | "ready" | "error";
  processingStep: number;
  foxitJobId?: string;
  extractedText?: string;
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

export interface AppRequest {
  id: string;
  journeyId: string;
  status: "requested" | "confirmed";
  submittedAt: string;
  confirmedAt?: string;
}
