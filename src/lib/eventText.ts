import { formatters, getLang, message as msg } from "../i18n";
import type { Messages } from "../i18n";

// İşlem geçmişi açıklaması. Yeni olaylar dilden bağımsız anahtarla yazılır (statusKey / detailKey) ve ekranda çevrilir;
// eski olaylarda yalnızca o anki metin (detail) vardır ve olduğu gibi gösterilir.
export interface WorkflowEvent { detail?: string; statusKey?: string; detailKey?: string; detailParams?: Record<string, string> }
export function eventText(t: Messages, event: WorkflowEvent) {
  const quantity = Number(event.detailParams?.quantity ?? 0);
  const operational: Record<string, () => string> = {
    quoteSelected: () => t.operations.quotationTermsTransferredToThePurchaseOrder,
    stockReceived: () => msg("operations", "valueUnitsReceived", quantity),
    purchaseConfirmed: () => t.operations.theUserConfirmedOrderPlacementWithAnApprovedPo,
    ship: () => msg("operations", "shippedQuantity", quantity),
    reserve: () => msg("operations", "reservedQuantity", quantity),
    cancel: () => t.operations.remainingQuantityCancelledAndReservationReleased,
    delivered: () => t.operations.deliveryConfirmedManually,
    manual_confirmed: () => t.operations.theUserConfirmedTheExternalPlatformUpdateNoApi,
    stockPlanning: () => msg("operations", "dailySalesValueLeadTimeValueDaysSafetyStock", Number(event.detailParams?.dailySales), Number(event.detailParams?.leadTimeDays), Number(event.detailParams?.safetyStock)),
    cycleStarted: () => msg("operations", "cycleStarted", Number(event.detailParams?.cycle)),
  };
  if (event.detailKey && operational[event.detailKey]) return operational[event.detailKey]();
  if (event.detailKey === "shortlisted") return t.sourcing.events.shortlisted(event.detailParams?.name ?? "");
  if (event.detailKey === "cogsSent") return t.sourcing.events.cogsSent();
  if (event.detailKey === "periodClosed") return t.sourcing.events.periodClosed(Number(event.detailParams?.period ?? 0));
  if (event.statusKey === "approved") return t.status.approved;
  if (event.statusKey) return t.status.workflow[event.statusKey] ?? event.statusKey;
  return event.detail ?? "";
}
