/**
 * Display names for the fixed document categories the classify step can
 * return (report / prescription / photo / lab_result / referral / general).
 *
 * This mirrors the `$label_names` map in `xano/apis/documents_confirm.xs`
 * exactly — keep the two in sync. The frontend needs its own copy so the
 * confirmation screen ("I understand you have: ...") can show friendly
 * names for the raw category keys classify() returns, before confirm()
 * round-trips to the server and creates the real document rows.
 */
export const DOCUMENT_LABEL_NAMES: Record<string, string> = {
  report: "Previous medical report",
  prescription: "Prescription",
  photo: "Photo",
  lab_result: "Lab result",
  referral: "Referral letter",
  general: "Document",
};

export function displayLabel(category: string): string {
  return DOCUMENT_LABEL_NAMES[category] ?? "Document";
}
