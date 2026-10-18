import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { useI18n } from "../i18n";

export type CostRowKind = "info" | "cost" | "margin";
export interface CostRow { id: string; item: string; kind: CostRowKind; value: string; kpi: string; kpiDays: string; documentation: string; completed: boolean }
export interface ValueChainCosting {
  productDescription: string; manufacturer: string; hsCode: string; orderQuantity: string;
  freightPrice: string; incoterm: string; currency: string; targetPrice: string; rows: CostRow[];
}

// Rows transcribed from the supplied Costing - Value Chain PDF (row 1 is the sheet title).
const template: [string, CostRowKind, string, string, string][] = [
  ["Product Configuration", "info", "Product Shipment Specification", "2", "Final Approved Product Specification Document"],
  ["Forecast of the product", "info", "Forecast Accuracy", "6", "Approved Forecast from each team"],
  ["Cost of good sold per unit", "cost", "Cost Accuracy", "2", "Using the Cost in Cell B12"],
  ["International and/or Domestic Logistics Cost per unit", "cost", "Logistics Cost Accuracy", "4", "Cost offer from different logistic companies"],
  ["Import Duties & Customs per unit", "cost", "Import Duty Accuracy", "4", "Email from broker"],
  ["Customs Broker Cost per unit", "cost", "Broker Fee Accuracy", "2", "Email from broker"],
  ["Additional Import Requirements per unit", "cost", "Other Custom Cost Accuracy", "4", "Email from broker"],
  ["Customs and Border Protection per unit", "cost", "Estimated CBP Accuracy", "4", "Email from broker and/or forwarder"],
  ["Storage Cost per unit", "cost", "Storage Cost Accuracy", "8", "Cost offer from logistic companies"],
  ["Fulfilment Cost per unit", "cost", "Fulfillment Cost Accuracy", "8", "Average shipment cost from different cargo companies"],
  ["Admin Expenses per unit", "cost", "Admin Cost Allocation", "6", "Administrative plan"],
  ["Outsource Expense per unit", "cost", "Outsource Service Cost Accuracy", "8", "Outsource Service Provider Agreement List"],
  ["Product returns per unit", "cost", "Return Cost Accuracy", "2", "Verbal or written statement of manufacturer"],
  ["Retailer other cost per unit (incl. Packing, Audit)", "cost", "Retailer Other Cost Accuracy", "2", "Verbal or written statement of retailer"],
  ["Marketing Budget per unit", "cost", "Marketing Budget Accuracy", "2", "Approved Marketing Budget Plan"],
  ["Net Profit Per Unit", "margin", "Profit Margin Accuracy", "2", "Optimum margin according to market research and forecast"],
  ["Retailer Brand Margin Per Unit", "margin", "Back Margin Accuracy", "2", "Verbal or written statement of retailer"],
  ["Retailer Front Margin Per unit", "margin", "Front Margin Accuracy", "2", "Verbal or written statement of retailer"],
];

export const createValueChainCosting = (): ValueChainCosting => ({
  productDescription: "", manufacturer: "", hsCode: "", orderQuantity: "", freightPrice: "", incoterm: "FOB", currency: "USD", targetPrice: "",
  rows: template.map(([item, kind, kpi, kpiDays, documentation], index) => ({ id: `cost-row-${index}`, item, kind, value: "", kpi, kpiDays, documentation, completed: false })),
});

const incoterms = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const kinds: CostRowKind[] = ["cost", "margin", "info"];
const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:bg-slate-50";
// Accepts both "1.250,50" and "1250.50" style entries.
const amount = (value: string) => { const text = value.trim().replace(/\s/g, ""); const number = Number(/,\d{1,2}$/.test(text) ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "")); return text && Number.isFinite(number) ? number : null; };

export default function ValueChainCostingEditor({ costing, onChange, disabled, manufacturers = [] }: { costing: ValueChainCosting; onChange: (costing: ValueChainCosting) => void; disabled: boolean; manufacturers?: string[] }) {
  const { t, fmt } = useI18n();
  const m = t.editors.valueChain;
  const set = (patch: Partial<ValueChainCosting>) => onChange({ ...costing, ...patch });
  const updateRow = (id: string, patch: Partial<CostRow>) => set({ rows: costing.rows.map(row => row.id === id ? { ...row, ...patch } : row) });
  const money = (value: number | null) => value === null ? "—" : fmt.currency(value, costing.currency || "USD");
  const sum = (kind: CostRowKind) => costing.rows.filter(row => row.kind === kind).reduce((total, row) => total + (amount(row.value) ?? 0), 0);
  const unitCost = sum("cost"), margins = sum("margin"), price = unitCost + margins;
  const quantity = amount(costing.orderQuantity), freight = amount(costing.freightPrice), target = amount(costing.targetPrice);
  const unitFreight = quantity && freight !== null ? freight / quantity : null;
  const logisticsRow = costing.rows.find(row => row.kind === "cost" && /logistics/i.test(row.item));
  const fits = target === null ? null : price <= target;

  return <fieldset disabled={disabled} className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
    <legend className="px-2 font-semibold text-navy">{m.title}</legend>
    <p className="text-sm text-slate-600">{m.help}</p>

    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="font-semibold text-navy">{m.productHeading}</h4>
      <label className="block text-xs text-slate-600">{m.productDescription}<textarea className={input} rows={2} maxLength={1000} placeholder={m.productPlaceholder} value={costing.productDescription} onChange={e => set({ productDescription: e.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-slate-600">{m.manufacturer}<input className={input} maxLength={250} list="costing-manufacturers" value={costing.manufacturer} onChange={e => set({ manufacturer: e.target.value })} /><datalist id="costing-manufacturers">{manufacturers.map(name => <option key={name} value={name} />)}</datalist></label>
        <label className="text-xs text-slate-600">{m.hsCode}<input className={input} maxLength={20} placeholder={m.hsPlaceholder} value={costing.hsCode} onChange={e => set({ hsCode: e.target.value })} /></label>
        <label className="text-xs text-slate-600">{m.quantity}<input className={input} inputMode="decimal" maxLength={20} value={costing.orderQuantity} onChange={e => set({ orderQuantity: e.target.value })} /></label>
        <label className="text-xs text-slate-600">{m.freight}<input className={input} inputMode="decimal" maxLength={20} value={costing.freightPrice} onChange={e => set({ freightPrice: e.target.value })} /></label>
        <label className="text-xs text-slate-600">{m.incoterm}<select className={input} value={costing.incoterm} onChange={e => set({ incoterm: e.target.value })}>{incoterms.map(term => <option key={term}>{term}</option>)}</select></label>
        <label className="text-xs text-slate-600">{m.currency}<select className={input} value={costing.currency} onChange={e => set({ currency: e.target.value })}>{["USD", "EUR", "TRY", "GBP"].map(code => <option key={code}>{code}</option>)}</select></label>
      </div>
      {unitFreight !== null && <p className="flex flex-wrap items-center gap-3 text-xs text-slate-600">{m.unitFreight} <strong>{money(unitFreight)}</strong>{logisticsRow && <button type="button" className="font-semibold text-teal-700 disabled:opacity-40" onClick={() => updateRow(logisticsRow.id, { value: unitFreight.toFixed(4).replace(/\.?0+$/, "") })}>{m.writeToLogistics}</button>}</p>}
    </section>

    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="font-semibold text-navy">{m.rowsHeading(costing.currency)}</h4>
      {costing.rows.map((row, index) => <div key={row.id} className="grid gap-3 border-t border-slate-100 pt-3 first:border-0 first:pt-0 sm:grid-cols-[28px_1.6fr_120px_1fr_32px] sm:items-start">
        <span className="pt-6 text-xs text-slate-400">{index + 1}</span>
        <label className="text-xs text-slate-500">{m.item}<input className={input} maxLength={200} value={row.item} onChange={e => updateRow(row.id, { item: e.target.value })} /></label>
        <label className="text-xs text-slate-500">{m.kind}<select className={input} value={row.kind} onChange={event => updateRow(row.id, { kind: event.target.value as CostRowKind })}>{kinds.map(value => <option key={value} value={value}>{m.kinds[value]}</option>)}</select></label>
        <label className="text-xs text-slate-500">{row.kind === "info" ? m.infoValue : m.unitAmount(costing.currency)}<input className={`${input} ${row.kind !== "info" && row.value.trim() && amount(row.value) === null ? "border-red-400" : ""}`} inputMode={row.kind === "info" ? "text" : "decimal"} maxLength={row.kind === "info" ? 500 : 20} placeholder={row.kind === "info" ? "" : "0,00"} value={row.value} onChange={e => updateRow(row.id, { value: e.target.value })} /></label>
        <button type="button" aria-label={m.deleteRow(row.item || m.defaultItem)} className="self-center pt-4 text-red-700 disabled:opacity-40" onClick={() => { if (window.confirm(m.deleteRowConfirm(row.item || m.defaultItem))) set({ rows: costing.rows.filter(item => item.id !== row.id) }); }}><Trash2 className="h-4 w-4" /></button>
        <details className="text-xs text-slate-500 sm:col-span-4 sm:col-start-2"><summary className="cursor-pointer">{m.kpiDetails}{row.completed ? m.completedSuffix : ""}</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_100px_1.5fr_auto] sm:items-end">
            <label>{m.kpi}<input className={input} maxLength={200} value={row.kpi} onChange={e => updateRow(row.id, { kpi: e.target.value })} /></label>
            <label>{m.kpiDays}<input className={input} inputMode="decimal" maxLength={6} value={row.kpiDays} onChange={e => updateRow(row.id, { kpiDays: e.target.value })} /></label>
            <label>{m.documentation}<input className={input} maxLength={500} value={row.documentation} onChange={e => updateRow(row.id, { documentation: e.target.value })} /></label>
            <label className="flex items-center gap-2 pb-2"><input type="checkbox" checked={row.completed} onChange={event => updateRow(row.id, { completed: event.target.checked })} /> {m.completed}</label>
          </div>
        </details>
      </div>)}
      {!costing.rows.length && <p className="text-sm text-slate-500">{m.empty}</p>}
      <button type="button" className="flex items-center gap-2 text-sm font-semibold text-teal-700 disabled:opacity-40" onClick={() => set({ rows: [...costing.rows, { id: crypto.randomUUID(), item: "", kind: "cost", value: "", kpi: "", kpiDays: "", documentation: "", completed: false }] })}><Plus className="h-4 w-4" /> {m.addItem}</button>
    </section>

    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-live="polite">
      <h4 className="font-semibold text-navy">{m.result}</h4>
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{m.unitCost}</dt><dd className="mt-1 text-lg font-semibold text-navy">{money(unitCost)}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{m.margins}</dt><dd className="mt-1 text-lg font-semibold text-navy">{money(margins)}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{m.price}</dt><dd className="mt-1 text-lg font-semibold text-navy">{money(price)}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{m.orderCost}</dt><dd className="mt-1 text-lg font-semibold text-navy">{quantity ? money(unitCost * quantity) : "—"}</dd></div>
      </dl>
      <div className="flex flex-wrap items-end gap-4">
        <label className="w-56 text-xs text-slate-600">{m.target(costing.currency)}<input className={input} inputMode="decimal" maxLength={20} value={costing.targetPrice} onChange={e => set({ targetPrice: e.target.value })} /></label>
        {fits === null ? <p className="pb-2 text-sm text-slate-500">{m.targetHint}</p>
          : fits ? <p className="flex items-center gap-2 pb-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> {m.fits(money(target! - price))}</p>
          : <p className="flex items-center gap-2 pb-2 text-sm font-semibold text-red-700"><XCircle className="h-5 w-5" /> {m.exceeds(money(price - target!))}</p>}
      </div>
    </section>
  </fieldset>;
}
