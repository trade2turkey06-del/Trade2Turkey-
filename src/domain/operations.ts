import { formatters, getLang, message as msg } from "../i18n";
export type SalesState = "draft" | "reserved" | "partial" | "shipped" | "cancelled";
export interface Stock { productId: string; physical: number; reserved: number; safetyStock: number; }
export interface SalesOrder { id: string; productId: string; quantity: number; reservedQty: number; shippedQty: number; cancelledQty: number; status: SalesState; customer: string; platform: string; }
export const money = (value: number, currency = "USD") => formatters(getLang()).currency(value,currency);
export const positiveInt = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
export function reorderPoint(dailySales: number, leadTimeDays: number, safetyStock: number) {
  if (![dailySales,leadTimeDays,safetyStock].every(value=>Number.isFinite(value)&&value>=0)) throw new Error(msg("operations", "invalidInventoryPlanningValues"));
  return Math.ceil(dailySales * leadTimeDays + safetyStock);
}
export interface PlanningInput { forecastDailySales?: number; leadTimeDays?: number }
// Single source for stock planning (B.B.5, B.B.6 and the stock table):
// available = physical − reserved; reorder point = daily sales × lead time + safety stock; reorder when available ≤ reorder point.
export function stockPlan(stock: Pick<Stock, "physical" | "reserved" | "safetyStock">, product?: PlanningInput) {
  const available = stock.physical - stock.reserved;
  const point = reorderPoint(product?.forecastDailySales || 0, product?.leadTimeDays || 1, stock.safetyStock);
  return { physical: stock.physical, reserved: stock.reserved, available, safetyStock: stock.safetyStock, reorderPoint: point, needsReorder: available <= point };
}
export function validatePlanning(input: { forecastDailySales: number; leadTimeDays: number; safetyStock: number }) {
  if (!Number.isFinite(input.forecastDailySales) || input.forecastDailySales < 0) throw new Error(msg("operations", "forecastDailySalesMustBeZeroOrGreater"));
  if (!Number.isSafeInteger(input.leadTimeDays) || input.leadTimeDays < 1) throw new Error(msg("operations", "leadTimeMustBeAtLeastOneWholeDay"));
  if (!Number.isSafeInteger(input.safetyStock) || input.safetyStock < 0) throw new Error(msg("operations", "safetyStockMustBeANonNegativeWholeNumber"));
  return input;
}
export function validateStock(stock: Stock) {
  if (![stock.physical, stock.reserved, stock.safetyStock].every(n => Number.isSafeInteger(n) && n >= 0) || stock.reserved > stock.physical) throw new Error(msg("operations", "invalidInventoryQuantities"));
}
export function reserve(stock: Stock, order: SalesOrder) {
  validateStock(stock);
  if (order.status !== "draft" || !positiveInt(order.quantity) || order.shippedQty || order.reservedQty || order.cancelledQty) throw new Error(msg("operations", "thisOrderCannotBeReserved"));
  if (stock.physical - stock.reserved < order.quantity) throw new Error(msg("operations", "insufficientAvailableInventoryForThisOrder"));
  return { stock: { ...stock, reserved: stock.reserved + order.quantity }, order: { ...order, reservedQty: order.quantity, status: "reserved" as const } };
}
export function ship(stock: Stock, order: SalesOrder, quantity: number) {
  validateStock(stock);
  if (!["reserved", "partial"].includes(order.status) || !positiveInt(quantity) || quantity > order.reservedQty || quantity > stock.reserved || quantity > stock.physical) throw new Error(msg("operations", "shipmentQuantityCannotExceedTheReservationReserveInventoryFirst"));
  const shippedQty = order.shippedQty + quantity;
  return { stock: { ...stock, physical: stock.physical - quantity, reserved: stock.reserved - quantity }, order: { ...order, shippedQty, reservedQty: order.reservedQty - quantity, status: (shippedQty + order.cancelledQty === order.quantity ? "shipped" : "partial") as SalesState } };
}
export function cancel(stock: Stock, order: SalesOrder) {
  validateStock(stock);
  if (!["draft", "reserved", "partial"].includes(order.status)) throw new Error(msg("operations", "theOrderIsAlreadyFulfilledOrCancelled"));
  return { stock: { ...stock, reserved: stock.reserved - order.reservedQty }, order: { ...order, reservedQty: 0, cancelledQty: order.quantity - order.shippedQty, status: "cancelled" as const } };
}
export function receive(stock: Stock, ordered: number, received: number, quantity: number) {
  validateStock(stock);
  if (!positiveInt(quantity) || !positiveInt(ordered) || received < 0 || received + quantity > ordered) throw new Error(msg("operations", "receivedQuantityCannotExceedTheOutstandingOrderQuantity"));
  return { stock: { ...stock, physical: stock.physical + quantity }, receivedQty: received + quantity };
}
export function safeHttps(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
export function todayIstanbul() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
