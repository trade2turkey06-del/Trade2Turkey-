export type SalesState = "draft" | "reserved" | "partial" | "shipped" | "cancelled";
export interface Stock { productId: string; physical: number; reserved: number; safetyStock: number; }
export interface SalesOrder { id: string; productId: string; quantity: number; reservedQty: number; shippedQty: number; cancelledQty: number; status: SalesState; customer: string; platform: string; }
export const money = (value: number, currency = "USD") => new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(value);
export const positiveInt = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
export function reorderPoint(dailySales: number, leadTimeDays: number, safetyStock: number) {
  if (![dailySales,leadTimeDays,safetyStock].every(value=>Number.isFinite(value)&&value>=0)) throw new Error("Stok planlama değerleri geçersiz.");
  return Math.ceil(dailySales * leadTimeDays + safetyStock);
}
export function validateStock(stock: Stock) {
  if (![stock.physical, stock.reserved, stock.safetyStock].every(n => Number.isSafeInteger(n) && n >= 0) || stock.reserved > stock.physical) throw new Error("Stok miktarları geçersiz.");
}
export function reserve(stock: Stock, order: SalesOrder) {
  validateStock(stock);
  if (order.status !== "draft" || !positiveInt(order.quantity) || order.shippedQty || order.reservedQty || order.cancelledQty) throw new Error("Bu sipariş rezerve edilemez.");
  if (stock.physical - stock.reserved < order.quantity) throw new Error("Sipariş miktarı için kullanılabilir stok yetersiz.");
  return { stock: { ...stock, reserved: stock.reserved + order.quantity }, order: { ...order, reservedQty: order.quantity, status: "reserved" as const } };
}
export function ship(stock: Stock, order: SalesOrder, quantity: number) {
  validateStock(stock);
  if (!["reserved", "partial"].includes(order.status) || !positiveInt(quantity) || quantity > order.reservedQty || quantity > stock.reserved || quantity > stock.physical) throw new Error("Sevk miktarı rezervasyonu aşamaz; önce stok ayırın.");
  const shippedQty = order.shippedQty + quantity;
  return { stock: { ...stock, physical: stock.physical - quantity, reserved: stock.reserved - quantity }, order: { ...order, shippedQty, reservedQty: order.reservedQty - quantity, status: (shippedQty + order.cancelledQty === order.quantity ? "shipped" : "partial") as SalesState } };
}
export function cancel(stock: Stock, order: SalesOrder) {
  validateStock(stock);
  if (!["draft", "reserved", "partial"].includes(order.status)) throw new Error("Sipariş zaten tamamlanmış veya iptal edilmiş.");
  return { stock: { ...stock, reserved: stock.reserved - order.reservedQty }, order: { ...order, reservedQty: 0, cancelledQty: order.quantity - order.shippedQty, status: "cancelled" as const } };
}
export function receive(stock: Stock, ordered: number, received: number, quantity: number) {
  validateStock(stock);
  if (!positiveInt(quantity) || !positiveInt(ordered) || received < 0 || received + quantity > ordered) throw new Error("Teslim alınan miktar kalan sipariş miktarını aşamaz.");
  return { stock: { ...stock, physical: stock.physical + quantity }, receivedQty: received + quantity };
}
export function safeHttps(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
export function todayIstanbul() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
