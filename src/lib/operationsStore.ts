import { message as msg } from "../i18n";
import { collection, doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { cancel, receive, reserve, safeHttps, ship, validatePlanning, type SalesOrder, type Stock } from "../domain/operations";

export const operationCollection = (projectId: string, name: string) => collection(db, "projects", projectId, name);
export const operationDoc = (projectId: string, name: string, id: string) => doc(operationCollection(projectId, name), id);
export function actor() { if (!auth.currentUser) throw new Error(msg("operations", "signIn")); return auth.currentUser.uid; }
export function eventData(action: string, entityId: string, detail: string) {
  return { action, entityId, detail: detail.slice(0, 1500), actorUid: actor(), at: serverTimestamp() };
}
export async function createEntity(projectId: string, name: string, data: Record<string, unknown>) {
  const ref = doc(operationCollection(projectId, name));
  const event = doc(operationCollection(projectId, "events"));
  await runTransaction(db, async tx => {
    tx.set(ref, { ...data, id: ref.id, projectId, createdBy: actor(), createdAt: serverTimestamp() });
    tx.set(event, { ...eventData("create", ref.id, name), projectId });
  });
  return ref.id;
}
export async function saveProduct(projectId: string, input: { name: string; sku: string; safetyStock: number; unit: string; forecastDailySales: number; leadTimeDays: number }) {
  if (!input.name.trim() || !input.sku.trim() || !Number.isSafeInteger(input.safetyStock) || input.safetyStock < 0) throw new Error(msg("operations", "enterAProductNameSkuAndValidSafetyStock"));
  if (!Number.isFinite(input.forecastDailySales) || input.forecastDailySales < 0 || !Number.isSafeInteger(input.leadTimeDays) || input.leadTimeDays < 1) throw new Error(msg("operations", "invalidDailyForecastOrLeadTime"));
  const id = encodeURIComponent(input.sku.trim().toUpperCase());
  const ref = operationDoc(projectId, "products", id);
  const stockRef = operationDoc(projectId, "stock", id);
  await runTransaction(db, async tx => {
    const exists = await tx.get(ref);
    if (exists.exists()) throw new Error(msg("operations", "thisSkuAlreadyExists"));
    tx.set(ref, { ...input, name: input.name.trim(), sku: input.sku.trim().toUpperCase(), id, projectId, createdAt: serverTimestamp(), createdBy: actor() });
    tx.set(stockRef, { productId: id, physical: 0, reserved: 0, safetyStock: input.safetyStock, projectId });
    tx.set(doc(operationCollection(projectId, "events")), { ...eventData("product_created", id, input.name), projectId });
  });
}
export async function quoteToPurchaseOrder(projectId: string, quoteId: string) {
  const quoteRef = operationDoc(projectId, "quotes", quoteId);
  const poRef = operationDoc(projectId, "purchaseOrders", quoteId);
  await runTransaction(db, async tx => {
    const quote = await tx.get(quoteRef); const existing = await tx.get(poRef);
    if (!quote.exists() || existing.exists()) throw new Error(msg("operations", "quotationNotFoundOrAnOrderHasAlreadyBeen"));
    const data = quote.data();
    tx.set(poRef, { id: quoteId, projectId, quoteId, productId: data.productId, supplierId: data.supplierId, quantity: data.quantity, unitPrice: data.unitPrice, currency: data.currency, leadTimeDays: data.leadTimeDays, incoterm: data.incoterm, paymentTerms: data.paymentTerms, receivedQty: 0, status: "draft", createdAt: serverTimestamp(), createdBy: actor() });
    tx.update(quoteRef, { selected: true });
    tx.set(doc(operationCollection(projectId, "events")), { ...eventData("quote_selected", quoteId, "quote_selected"), detailKey: "quoteSelected", projectId });
  });
}
export async function receivePurchaseOrder(projectId: string, id: string, quantity: number) {
  const poRef = operationDoc(projectId, "purchaseOrders", id);
  await runTransaction(db, async tx => {
    const po = await tx.get(poRef); if (!po.exists()) throw new Error(msg("operations", "orderNotFound"));
    const data = po.data();
    if (!["ordered","partial"].includes(data.status)) throw new Error(msg("operations", "confirmOrderPlacementUsingAnApprovedPoDocumentFirst"));
    const stockRef = operationDoc(projectId, "stock", data.productId);
    const stock = await tx.get(stockRef); if (!stock.exists()) throw new Error(msg("operations", "noInventoryRecordForThisProduct"));
    const next = receive(stock.data() as Stock, data.quantity, data.receivedQty, quantity);
    tx.update(stockRef, { physical: next.stock.physical });
    tx.update(poRef, { receivedQty: next.receivedQty, status: next.receivedQty === data.quantity ? "received" : "partial" });
    tx.set(doc(operationCollection(projectId, "events")), { ...eventData("stock_received", id, "stock_received"), detailKey: "stockReceived", detailParams: { quantity: String(quantity) }, projectId, productId: data.productId, quantity });
  });
}
export async function confirmPurchaseOrder(projectId: string, id: string, poDocumentUrl: string) {
  if (!safeHttps(poDocumentUrl)) throw new Error(msg("operations", "enterTheHttpsUrlOfTheApprovedPoDocument"));
  const ref=operationDoc(projectId,"purchaseOrders",id);
  await runTransaction(db,async tx=>{
    const order=await tx.get(ref),contract=await tx.get(doc(db,"sopSteps",`${projectId}_sourcing-A.B.14`));
    if(!order.exists()||order.data().status!=="draft") throw new Error(msg("operations", "draftOrderNotFoundOrAlreadyConfirmed"));
    if(!contract.exists()||contract.data().approval!=="approved"||contract.data().workflowStatus!=="completed") throw new Error(msg("operations", "aB14CommercialAgreementInTheSourcingWorkflow"));
    tx.update(ref,{status:"ordered",poDocumentUrl,confirmedBy:actor(),confirmedAt:serverTimestamp()});
    tx.set(doc(operationCollection(projectId,"events")),{...eventData("purchase_confirmed",id,"purchase_confirmed"),detailKey:"purchaseConfirmed",projectId});
  });
}
export async function updateSalesOrder(projectId: string, id: string, action: "reserve" | "cancel" | "ship", shipment?: { quantity: number; tracking: string; carrier: string; labelUrl: string; proofUrl: string; expectedArrival: string }) {
  const orderRef = operationDoc(projectId, "salesOrders", id);
  const shipmentRef = doc(operationCollection(projectId, "shipmentRecords"));
  const eventRef = doc(operationCollection(projectId, "events"));
  if (action === "ship" && (!shipment || !shipment.tracking.trim() || !shipment.carrier.trim() || !safeHttps(shipment.labelUrl) || !safeHttps(shipment.proofUrl) || !shipment.expectedArrival)) throw new Error(msg("operations", "enterTheActualTrackingNumberCarrierLabelAndPhoto"));
  await runTransaction(db, async tx => {
    const orderSnapshot = await tx.get(orderRef); if (!orderSnapshot.exists()) throw new Error(msg("operations", "orderNotFound"));
    const order = orderSnapshot.data() as SalesOrder;
    const stockRef = operationDoc(projectId, "stock", order.productId);
    const stockSnapshot = await tx.get(stockRef); if (!stockSnapshot.exists()) throw new Error(msg("operations", "inventoryRecordNotFound"));
    const stock = stockSnapshot.data() as Stock;
    const next = action === "reserve" ? reserve(stock, order) : action === "cancel" ? cancel(stock, order) : ship(stock, order, shipment!.quantity);
    tx.update(stockRef, { physical: next.stock.physical, reserved: next.stock.reserved });
    tx.update(orderRef, { status: next.order.status, shippedQty: next.order.shippedQty, reservedQty: next.order.reservedQty, cancelledQty: next.order.cancelledQty, updatedAt: serverTimestamp() });
    if (action === "ship") tx.set(shipmentRef, { ...shipment, id: shipmentRef.id, projectId, orderId: id, productId: order.productId, status: "in_transit", platformSync: "manual_pending", createdAt: serverTimestamp() });
    tx.set(eventRef, { ...eventData(action, id, action), detailKey: action, detailParams: { quantity: String(action === "ship" ? shipment!.quantity : order.quantity) }, projectId, productId: order.productId });
  });
}
export async function markShipment(projectId: string, id: string, action: "delivered" | "manual_confirmed") {
  const ref = operationDoc(projectId, "shipmentRecords", id);
  await runTransaction(db, async tx => {
    const shipment = await tx.get(ref); if (!shipment.exists()) throw new Error(msg("operations", "shipmentNotFound"));
    tx.update(ref, action === "delivered" ? { status: action, deliveredAt: serverTimestamp() } : { platformSync: action, syncConfirmedBy: actor(), syncConfirmedAt: serverTimestamp() });
    tx.set(doc(operationCollection(projectId, "events")), { ...eventData(action, id, action), detailKey: action, projectId });
  });
}
// B.B.1 / B.B.6 planning inputs per SKU; the stock table derives the reorder point from them via stockPlan().
export async function savePlanning(projectId: string, productId: string, input: { forecastDailySales: number; leadTimeDays: number; safetyStock: number }) {
  validatePlanning(input);
  const productRef = operationDoc(projectId, "products", productId), stockRef = operationDoc(projectId, "stock", productId);
  await runTransaction(db, async tx => {
    const [product, stock] = await Promise.all([tx.get(productRef), tx.get(stockRef)]);
    if (!product.exists() || !stock.exists()) throw new Error(msg("operations", "productOrInventoryRecordNotFound"));
    tx.update(productRef, { forecastDailySales: input.forecastDailySales, leadTimeDays: input.leadTimeDays, safetyStock: input.safetyStock });
    tx.update(stockRef, { safetyStock: input.safetyStock });
    tx.set(doc(operationCollection(projectId, "events")), { ...eventData("stock_planning", productId, "stock_planning"), detailKey: "stockPlanning", detailParams: { dailySales: String(input.forecastDailySales), leadTimeDays: String(input.leadTimeDays), safetyStock: String(input.safetyStock) }, projectId, productId });
  });
}
export async function countStock(projectId: string, productId: string, physical: number, reason: string) {
  if (!Number.isSafeInteger(physical) || physical < 0 || !reason.trim()) throw new Error(msg("operations", "enterAValidCountQuantityAndAdjustmentReason"));
  const ref = operationDoc(projectId,"stock",productId);
  await runTransaction(db,async tx=>{
    const snapshot=await tx.get(ref);if(!snapshot.exists()) throw new Error(msg("operations", "productInventoryRecordNotFound"));
    const current=snapshot.data();if(physical<current.reserved) throw new Error(msg("operations", "countedQuantityIsBelowReservedInventoryAdjustTheRelevant"));
    tx.update(ref,{physical});
    tx.set(doc(operationCollection(projectId,"events")),{...eventData("stock_count",productId,reason),projectId,productId,before:current.physical,after:physical,quantity:physical-current.physical});
  });
}
