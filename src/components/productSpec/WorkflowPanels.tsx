import { useState } from "react";
import { BookOpenCheck, Download } from "lucide-react";
import { costLinesFromSpec, specLinkValid, versionOrder, type ProductSpec, type RecipeCostLine, type RecipeCostSource } from "../../domain/productSpec";
import type { VaultManufacturer } from "../../lib/productSpecStore";
import { useI18n } from "../../i18n";
import ProductSpecWorkspace, { StatusBadge } from "./ProductSpecWorkspace";
import { formatNumber, Notice } from "./fields";

const select = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:bg-slate-100";
const panel = "space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4";

// A.B.7: yüksek potansiyelli üretici, Belge Kasası'ndaki üreticilerden seçilir.
export function HighPotentialPicker({ manufacturers, value, onChange, disabled }: { manufacturers: VaultManufacturer[]; value?: string; onChange: (id: string, name: string) => void; disabled: boolean }) {
  const t = useI18n().t.productSpec;
  return <div className={panel}>
    <label className="block text-sm font-semibold text-navy">{t.workflow.ab7Label}
      <select className={select} value={value ?? ""} disabled={disabled || !manufacturers.length} onChange={event => onChange(event.target.value, manufacturers.find(item => item.id === event.target.value)?.name ?? "")}>
        <option value="">{t.list.chooseManufacturer}</option>
        {manufacturers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        {value && !manufacturers.some(item => item.id === value) && <option value={value}>{value}</option>}
      </select>
    </label>
    <p className="text-xs text-slate-500">{manufacturers.length ? t.workflow.ab7Help : t.workflow.ab7NoManufacturers}</p>
  </div>;
}

// A.B.8: kilidin baktığı üretici (A.B.7 ya da tek seferlik yedek seçim), bağlanan onaylı reçete ve "Reçeteyi aç / oluştur".
export function SpecLinkPanel({ projectId, isAdmin, preparedBy, manufacturers, specs, ab7, draft, onChange, disabled }: {
  projectId: string; isAdmin: boolean; preparedBy: string; manufacturers: VaultManufacturer[]; specs: ProductSpec[];
  ab7?: { highPotentialManufacturerId?: string; highPotentialManufacturerName?: string; approval?: string; workflowStatus?: string; [key: string]: unknown };
  draft: { approvedSpecId?: string; specManufacturerId?: string; specManufacturerName?: string; specManufacturerFallback?: boolean; [key: string]: unknown };
  onChange: (patch: Record<string, unknown>) => void; disabled: boolean;
}) {
  const t = useI18n().t.productSpec;
  const [open, setOpen] = useState(false);
  const fromAb7 = ab7?.highPotentialManufacturerId || "";
  const ab7Approved = ab7?.approval === "approved" && ab7?.workflowStatus === "completed";
  const required = fromAb7 || draft.specManufacturerId || "";
  const requiredName = fromAb7 ? (manufacturers.find(item => item.id === fromAb7)?.name || ab7?.highPotentialManufacturerName || fromAb7) : draft.specManufacturerName;
  const approved = specs.filter(spec => spec.manufacturerId === required && spec.status === "approved").sort((a, b) => (a.general.productName.localeCompare(b.general.productName, "tr")) || versionOrder(b.version) - versionOrder(a.version));
  const linked = specs.find(spec => spec.id === draft.approvedSpecId);
  const linkOk = specLinkValid(linked, required);
  return <div className={panel}>
    <div className="flex flex-wrap items-center gap-3">
      <h4 className="flex-1 text-sm font-semibold text-navy">{t.workflow.ab8Heading}</h4>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white"><BookOpenCheck className="h-4 w-4" /> {t.workflow.ab8Open}</button>
    </div>
    {fromAb7 ? <p className="text-xs text-slate-600">{t.workflow.ab8FromAb7(requiredName || fromAb7)}</p>
      : ab7Approved ? <div className="space-y-1">
        <Notice>{t.workflow.ab8Fallback}</Notice>
        <select aria-label={t.workflow.ab7Label} className={select} value={draft.specManufacturerId ?? ""} disabled={disabled || !isAdmin} onChange={event => onChange({ specManufacturerId: event.target.value, specManufacturerName: manufacturers.find(item => item.id === event.target.value)?.name ?? "", specManufacturerFallback: !!event.target.value, approvedSpecId: "" })}>
          <option value="">{t.list.chooseManufacturer}</option>{manufacturers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {draft.specManufacturerFallback && draft.specManufacturerId && <p className="text-[11px] text-slate-500">{t.workflow.ab8FallbackNote}</p>}
      </div>
      : <Notice tone="slate">{t.workflow.ab8WaitAb7}</Notice>}
    {required && (approved.length ? <label className="block text-xs font-medium text-slate-600">{t.workflow.ab8Spec}
      <select className={select} value={linkOk ? draft.approvedSpecId : ""} disabled={disabled || !isAdmin} onChange={event => onChange({ approvedSpecId: event.target.value })}>
        <option value="">{t.workflow.ab8ChooseSpec}</option>
        {approved.map(spec => <option key={spec.id} value={spec.id}>{spec.general.productName} {spec.version}{spec.general.variant ? ` — ${spec.general.variant}` : ""}</option>)}
      </select></label> : <Notice>{t.workflow.ab8NoApproved}</Notice>)}
    {linked && <p className="flex items-center gap-2 text-xs text-slate-600">{linked.general.productName} <span className="font-mono">{linked.version}</span> <StatusBadge status={linked.status} /></p>}
    {open && <ProductSpecWorkspace projectId={projectId} isAdmin={isAdmin} preparedBy={preparedBy} initialManufacturerId={required || undefined} onClose={() => setOpen(false)} />}
  </div>;
}

// A.B.9: preview the imported specification lines and any saved pricing information.
export function RecipeCostPreview({ spec, lines, source, onImport, canImport }: { spec?: ProductSpec; lines?: RecipeCostLine[]; source?: RecipeCostSource | null; onImport: (lines: RecipeCostLine[], source: RecipeCostSource) => void; canImport: boolean }) {
  const t = useI18n().t.productSpec;
  const [message, setMessage] = useState("");
  const c = t.workflow.ab9Columns;
  const doImport = () => {
    if (!spec) return;
    if (lines?.length && !window.confirm(t.workflow.ab9ReplaceConfirm)) return;
    const result = costLinesFromSpec(spec); onImport(result.lines, result.source); setMessage(t.workflow.ab9Imported(result.lines.length));
  };
  const empty = (value: unknown) => value === null || value === "" ? <span className="text-slate-300">—</span> : String(value);
  return <div className={panel}>
    <div className="flex flex-wrap items-center gap-3">
      <h4 className="flex-1 text-sm font-semibold text-navy">{t.workflow.ab9Heading}</h4>
      {canImport && <button type="button" disabled={!spec} onClick={doImport} className="inline-flex items-center gap-2 rounded-lg border border-teal-600 bg-white px-3 py-2 text-xs font-semibold text-teal-700 disabled:opacity-40"><Download className="h-4 w-4" /> {t.workflow.ab9Import}</button>}
    </div>
    <p className="text-xs text-slate-500">{t.workflow.ab9Help}</p>
    {!spec && <Notice tone="slate">{t.workflow.ab9NoSpec}</Notice>}
    {source && <p className="text-xs text-slate-600">{t.workflow.ab9Source(source.productName, source.version, source.manufacturerName)}</p>}
    {source && source.unitWeightG === null && lines?.some(line => line.source === "formulation") && <Notice>{t.workflow.ab9MissingWeight}</Notice>}
    {lines?.length ? <div className="overflow-x-auto"><table className="text-xs"><thead><tr><th>{c.source}</th><th>{c.material}</th><th>{c.quantity}</th><th>{c.unit}</th><th>{c.unitPrice}</th><th>{c.currency}</th><th>{c.fxRate}</th><th>{c.waste}</th><th>{c.priceSource}</th><th>{c.priceDate}</th></tr></thead>
      <tbody>{lines.map(line => <tr key={line.id}><td>{t.workflow.ab9Sources[line.source]}</td><td>{line.materialName}</td><td>{line.quantityPerUnit === null ? empty(null) : formatNumber(line.quantityPerUnit)}</td><td>{t.workflow.ab9Units[line.unit] ?? line.unit}</td><td>{empty(line.unitPrice)}</td><td>{empty(line.currency)}</td><td>{empty(line.fxRate)}</td><td>{empty(line.wastePct)}</td><td>{empty(line.priceSource)}</td><td>{empty(line.priceDate)}</td></tr>)}</tbody>
    </table></div> : <p className="text-xs text-slate-400">{t.workflow.ab9Empty}</p>}
    <p role="status" className="text-xs text-indigo-800">{message}</p>
  </div>;
}
