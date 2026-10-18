import type { Messages } from "../i18n";

// İşlem geçmişi açıklaması. Yeni olaylar dilden bağımsız anahtarla yazılır (statusKey / detailKey) ve ekranda çevrilir;
// eski olaylarda yalnızca o anki metin (detail) vardır ve olduğu gibi gösterilir.
export interface WorkflowEvent { detail?: string; statusKey?: string; detailKey?: string; detailParams?: Record<string, string> }
export function eventText(t: Messages, event: WorkflowEvent) {
  if (event.detailKey === "shortlisted") return t.sourcing.events.shortlisted(event.detailParams?.name ?? "");
  if (event.detailKey === "periodClosed") return t.sourcing.events.periodClosed(Number(event.detailParams?.period ?? 0));
  if (event.statusKey === "approved") return t.status.approved;
  if (event.statusKey) return t.status.workflow[event.statusKey] ?? event.statusKey;
  return event.detail ?? "";
}
