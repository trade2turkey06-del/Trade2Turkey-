import { useState, type ReactNode } from "react";
import { stockPlan, validatePlanning } from "../domain/operations";
import { savePlanning } from "../lib/operationsStore";

export const inventoryCollections = ["products", "stock", "salesOrders", "events"] as const;
export const inventorySteps = ["B.B.1", "B.B.3", "B.B.4", "B.B.5", "B.B.6"];
const openStates = ["draft", "reserved", "partial"];
const cell = "border-b border-slate-100 p-2";
const field = "w-24 rounded-lg border border-slate-300 bg-white p-1.5 text-sm disabled:bg-slate-50";

// Reads the OperationsHub collections for the B.B cards; only B.B.1 / B.B.6 write (planning inputs per SKU).
export default function InventoryStepPanel({ stepId, projectId, data, loading, error, canPlan }: { stepId: string; projectId: string; data: Record<string, any[]>; loading: boolean; error: string; canPlan: boolean }) {
  const products = data.products || [], stock = data.stock || [];
  const product = (id: string) => products.find(item => item.id === id);
  const label = (id: string) => { const item = product(id); return item ? `${item.sku} · ${item.name}` : id; };
  const lastCount = (id: string) => (data.events || []).filter(event => event.action === "stock_count" && event.entityId === id).sort((a, b) => (b.at?.seconds || 0) - (a.at?.seconds || 0))[0]?.at?.toDate?.().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
  const sum = (key: "physical" | "reserved" | "available") => stock.reduce((total, item) => total + stockPlan(item, product(item.productId))[key], 0);

  let body;
  if (loading) body = <p className="text-sm text-slate-500">Stok kayıtları yükleniyor…</p>;
  else if (error) body = <p role="alert" className="text-sm text-red-700">{error}</p>;
  else if (!stock.length) body = <p className="text-sm text-slate-500">Henüz stok kaydı yok. Ürünleri aşağıdaki "Ürünler ve satın alma" bölümünden ekleyin.</p>;
  else if (stepId === "B.B.3") body = <Table head={["Ürün", "Fiziksel stok", "Son sayım"]} foot={["Toplam", sum("physical"), ""]}>{stock.map(item => <tr key={item.id}><td className={cell}>{label(item.productId)}</td><td className={cell}>{item.physical}</td><td className={cell}>{lastCount(item.productId) || "Sayım kaydı yok"}</td></tr>)}</Table>;
  else if (stepId === "B.B.4") {
    const open = (data.salesOrders || []).filter(order => openStates.includes(order.status));
    body = <><p className="text-sm text-slate-700">Rezerve toplamı: <strong>{sum("reserved")}</strong> · Açık satış siparişi: <strong>{open.length}</strong></p>
      <Table head={["Ürün", "Rezerve", "Açık sipariş"]}>{stock.map(item => <tr key={item.id}><td className={cell}>{label(item.productId)}</td><td className={cell}>{item.reserved}</td><td className={cell}>{open.filter(order => order.productId === item.productId).length}</td></tr>)}</Table></>;
  }
  else if (stepId === "B.B.5") body = <Table head={["Ürün", "Fiziksel", "Rezerve", "Kullanılabilir"]} foot={["Toplam", sum("physical"), sum("reserved"), sum("available")]}>{stock.map(item => { const plan = stockPlan(item, product(item.productId)); return <tr key={item.id}><td className={cell}>{label(item.productId)}</td><td className={cell}>{plan.physical}</td><td className={cell}>{plan.reserved}</td><td className={`${cell} font-semibold`}>{plan.available}</td></tr>; })}</Table>;
  else body = <Table head={["Ürün", "Günlük tahmini satış", "Termin (gün)", "Emniyet stoğu", "Sipariş noktası", ""]}>{stock.map(item => <PlanningRow key={item.id} projectId={projectId} label={label(item.productId)} stock={item} product={product(item.productId)} disabled={!canPlan} />)}</Table>;

  return <section className="space-y-2 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
    <h4 className="text-sm font-semibold text-navy">{["B.B.1", "B.B.6"].includes(stepId) ? "SKU bazında stok planlama" : "Stok verisi (salt okunur)"}</h4>
    <p className="text-xs text-slate-500">{["B.B.1", "B.B.6"].includes(stepId) ? "Sipariş noktası = (günlük satış × termin) + emniyet stoğu. Kaydedilen değerler stok tablosundaki Emniyet stoğu / Sipariş noktası sütunlarına yansır." : "Veriler aşağıdaki Stok durumu tablosundan canlı okunur."}</p>
    {body}
  </section>;
}

function Table({ head, foot, children }: { head: string[]; foot?: (string | number)[]; children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{head.map((label, index) => <th key={index} className="border-b p-2 text-xs font-semibold text-slate-500">{label}</th>)}</tr></thead><tbody>{children}</tbody>{foot && <tfoot><tr>{foot.map((value, index) => <td key={index} className="p-2 font-semibold">{value}</td>)}</tr></tfoot>}</table></div>;
}

function PlanningRow({ projectId, label, stock, product, disabled }: { projectId: string; label: string; stock: any; product?: any; disabled: boolean }) {
  const [values, setValues] = useState({ forecastDailySales: String(product?.forecastDailySales ?? 0), leadTimeDays: String(product?.leadTimeDays ?? 1), safetyStock: String(stock.safetyStock ?? 0) });
  const [state, setState] = useState("");
  const input = { forecastDailySales: Number(values.forecastDailySales.replace(",", ".")), leadTimeDays: Number(values.leadTimeDays), safetyStock: Number(values.safetyStock) };
  let preview: number | string = "—";
  try { validatePlanning(input); preview = stockPlan({ ...stock, safetyStock: input.safetyStock }, input).reorderPoint; } catch {}
  const save = async () => { setState("…"); try { await savePlanning(projectId, stock.productId, validatePlanning(input)); setState("Kaydedildi"); } catch (error) { setState(error instanceof Error ? error.message : "Kaydedilemedi"); } };
  const box = (key: keyof typeof values, step: string) => <input aria-label={`${label} ${key}`} className={field} inputMode="decimal" type="number" min={key === "leadTimeDays" ? 1 : 0} step={step} disabled={disabled} value={values[key]} onChange={e => { setValues({ ...values, [key]: e.target.value }); setState(""); }} />;
  return <tr><td className={cell}>{label}</td><td className={cell}>{box("forecastDailySales", "0.01")}</td><td className={cell}>{box("leadTimeDays", "1")}</td><td className={cell}>{box("safetyStock", "1")}</td><td className={`${cell} font-semibold`}>{preview}</td>
    <td className={cell}>{!disabled && <button type="button" onClick={() => void save()} disabled={state === "…" || preview === "—"} className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Kaydet</button>}{state && state !== "…" && <span className={`ml-2 text-xs ${state === "Kaydedildi" ? "text-emerald-700" : "text-red-700"}`}>{state}</span>}</td></tr>;
}
