import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, FilePlus2, Lock, Printer, X } from "lucide-react";
import { approvalErrors, createSpec, newVersionFrom, versionOrder, type ProductSpec } from "../../domain/productSpec";
import { createSpecDoc, saveSpecDoc, useClaimThresholds, useManufacturers, useProductSpecs, useProjectPackaging } from "../../lib/productSpecStore";
import { auth } from "../../lib/firebase";
import { specText as t } from "../../i18n/productSpec";
import ProductSpecForm from "./ProductSpecForm";
import ProductSpecPrint, { printCss } from "./ProductSpecPrint";
import { input, Notice } from "./fields";

const statusTone: Record<string, string> = { draft: "bg-slate-100 text-slate-700", review: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800" };
export const StatusBadge = ({ status }: { status: string }) => <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone[status] ?? statusTone.draft}`}>{t.status[status] ?? status}</span>;
// Scoped styles; the overlay is rendered outside <main>, so the app-wide table/input rules do not apply here.
const screenCss = `
#product-spec table { width: 100%; border-collapse: collapse; font-size: 12px; }
#product-spec th { background: #f6f8fb; color: #52647a; font-weight: 600; text-align: left; white-space: nowrap; }
#product-spec th, #product-spec td { padding: 6px 8px; border-bottom: 1px solid #e8edf3; vertical-align: middle; }
#product-spec tfoot td { border-bottom: 0; background: #fafcfd; }
`;
const ensureStyle = (id: string, css: string) => { if (!document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement("style"), { id, textContent: css })); };
const sameSave = (a?: ProductSpec, b?: ProductSpec) => a?.updatedAt?.seconds === b?.updatedAt?.seconds && a?.updatedAt?.nanoseconds === b?.updatedAt?.nanoseconds;

export default function ProductSpecWorkspace({ projectId, isAdmin, preparedBy, initialManufacturerId, onClose }: { projectId: string; isAdmin: boolean; preparedBy: string; initialManufacturerId?: string; onClose: () => void }) {
  const { specs, loading, error } = useProductSpecs(projectId);
  const manufacturers = useManufacturers(projectId);
  const packagingConfig = useProjectPackaging(projectId);
  const markets = useClaimThresholds();
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<ProductSpec | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newManufacturer, setNewManufacturer] = useState(initialManufacturerId ?? "");
  const [newProduct, setNewProduct] = useState("");

  // Lineage = one product for one manufacturer; versions newest first.
  const lineages = useMemo(() => {
    const groups = new Map<string, ProductSpec[]>();
    for (const spec of specs) groups.set(spec.lineageId, [...(groups.get(spec.lineageId) ?? []), spec]);
    return [...groups.values()].map(versions => versions.sort((a, b) => versionOrder(b.version) - versionOrder(a.version))).sort((a, b) => (a[0].manufacturerName + a[0].general.productName).localeCompare(b[0].manufacturerName + b[0].general.productName, "tr"));
  }, [specs]);
  const selected = specs.find(spec => spec.id === selectedId);
  const versions = lineages.find(group => group[0].lineageId === selected?.lineageId) ?? [];
  const isLatest = versions[0]?.id === selected?.id;

  useEffect(() => {
    ensureStyle("product-spec-screen", screenCss); ensureStyle("product-spec-print", printCss);
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    // The rest of the app is inert while the dialog is open (focus and screen readers stay inside it).
    const root = document.getElementById("root");
    window.addEventListener("keydown", close); document.body.style.overflow = "hidden"; root?.setAttribute("inert", "");
    return () => { window.removeEventListener("keydown", close); document.body.style.overflow = ""; root?.removeAttribute("inert"); };
  }, []);
  useEffect(() => {
    if (selectedId || !lineages.length) return;
    const preferred = lineages.find(group => group[0].manufacturerId === initialManufacturerId) ?? lineages[0];
    setSelectedId(preferred[0].id);
  }, [lineages, selectedId]);
  // Live updates replace the draft only when there are no unsaved edits.
  useEffect(() => { if (selected && (!draft || draft.id !== selected.id || (!dirty && !sameSave(draft, selected)))) { setDraft(structuredClone(selected)); setDirty(false); } }, [selected]);

  const select = (id: string) => { if (dirty && !window.confirm("Kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?")) return; setSelectedId(id); setDraft(null); setDirty(false); setMessage(""); };
  const run = async (task: () => Promise<void>, success = t.saved) => {
    setBusy(true); setMessage("");
    try { await task(); setMessage(success); }
    catch (error) { const code = error instanceof Error ? error.message : ""; setMessage(code === "conflict" ? t.conflict : code === "auth" ? t.signIn : code || "Kaydedilemedi."); }
    finally { setBusy(false); }
  };
  const create = () => run(async () => {
    const manufacturer = manufacturers.find(item => item.id === newManufacturer), uid = auth.currentUser?.uid;
    if (!uid) throw new Error("auth");
    if (!manufacturer || !newProduct.trim()) throw new Error(t.list.needName);
    const spec = createSpec({ projectId, manufacturerId: manufacturer.id, manufacturerName: manufacturer.name, productName: newProduct.trim(), preparedBy, createdBy: uid });
    await createSpecDoc(spec); setNewProduct(""); setSelectedId(spec.id); setDraft(null);
  });
  const save = () => draft && run(async () => { if (new TextEncoder().encode(JSON.stringify(draft)).length > 800000) throw new Error(t.tooLarge); await saveSpecDoc(draft); setDirty(false); });
  const approve = () => {
    if (!draft) return;
    const errors = approvalErrors(draft);
    if (errors.length) { setMessage(errors.map(code => t.approval.errors[code]).join(" ")); return; }
    if (!window.confirm(t.approval.approveConfirm(draft.version))) return;
    void run(async () => { await saveSpecDoc(draft, true); setDirty(false); });
  };
  const openNewVersion = () => {
    if (!selected) return;
    if (versions.some(item => item.status !== "approved")) { setMessage(t.list.newVersionBlocked); return; }
    const next = newVersionFrom(selected, auth.currentUser?.uid ?? "");
    if (!window.confirm(t.list.newVersionConfirm(selected.version, next.version))) return;
    void run(async () => { await createSpecDoc(next); setSelectedId(next.id); setDraft(null); });
  };
  const print = () => { document.body.classList.add("spec-printing"); const done = () => { document.body.classList.remove("spec-printing"); window.removeEventListener("afterprint", done); }; window.addEventListener("afterprint", done); window.print(); };

  const readOnly = !isAdmin || !draft || draft.status === "approved" || busy;
  const manufacturer = manufacturers.find(item => item.id === draft?.manufacturerId);
  const market = markets.find(item => item.id === draft?.general.claimMarket) ?? markets[0];

  return createPortal(<>
    <div id="product-spec" role="dialog" aria-modal="true" aria-labelledby="product-spec-title" className="fixed inset-0 z-[70] flex bg-slate-900/40 p-0 sm:p-4">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden bg-[#f3f6f9] sm:rounded-2xl sm:shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1"><h2 id="product-spec-title" className="text-base font-semibold text-navy">{t.title}</h2><p className="text-xs text-slate-500">{t.subtitle}</p></div>
          {draft && <button type="button" onClick={print} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Printer className="h-4 w-4" /> {t.exportPdf}</button>}
          <button type="button" onClick={() => { if (!dirty || window.confirm("Kaydedilmemiş değişiklikler kaybolacak. Kapatılsın mı?")) onClose(); }} aria-label={t.close} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>
        <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-[260px_1fr] md:overflow-hidden">
          <aside className="space-y-4 border-b border-slate-200 bg-white p-4 md:overflow-auto md:border-b-0 md:border-r">
            <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.list.heading}</h3>
              {loading ? <p className="text-xs text-slate-500">{t.loading}</p> : error ? <Notice tone="red">{t.loadError}</Notice> : !lineages.length ? <p className="text-xs text-slate-400">{t.list.empty}</p> :
                <ul className="space-y-1.5">{lineages.map(group => { const latest = group[0], active = latest.lineageId === selected?.lineageId; return <li key={latest.lineageId}>
                  <button type="button" onClick={() => select(latest.id)} className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${active ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}>
                    <span className="block font-semibold text-slate-800">{latest.general.productName || "—"}</span>
                    <span className="block text-slate-500">{latest.manufacturerName}</span>
                    <span className="mt-1 flex items-center gap-2"><span className="font-mono">{latest.version}</span><StatusBadge status={latest.status} /></span>
                  </button></li>; })}</ul>}
            </div>
            {isAdmin && <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
              <h3 className="text-xs font-semibold text-slate-700">{t.list.newHeading}</h3>
              {manufacturers.length ? <>
                <select aria-label={t.list.manufacturer} className={input} value={newManufacturer} onChange={event => setNewManufacturer(event.target.value)}><option value="">{t.list.chooseManufacturer}</option>{manufacturers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                <input aria-label={t.list.productName} placeholder={t.list.productName} className={input} maxLength={300} value={newProduct} onChange={event => setNewProduct(event.target.value)} />
                <button type="button" disabled={busy || !newManufacturer || !newProduct.trim()} onClick={() => void create()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><FilePlus2 className="h-4 w-4" /> {busy ? t.list.creating : t.list.create}</button>
              </> : <p className="text-xs text-slate-500">{t.list.noManufacturers}</p>}
            </div>}
          </aside>
          <div className="min-w-0 space-y-4 p-4 md:overflow-auto sm:p-6">
            {draft ? <>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-navy">{draft.general.productName || "—"} <span className="font-mono text-xs text-slate-500">{draft.version}</span></p><p className="text-xs text-slate-500">{draft.manufacturerName}</p></div>
                <StatusBadge status={draft.status} />
                {isAdmin && draft.status !== "approved" && <select aria-label={t.general.status} className={input.replace("w-full", "w-36")} value={draft.status} disabled={busy} onChange={event => { setDraft({ ...draft, status: event.target.value as ProductSpec["status"] }); setDirty(true); }}><option value="draft">{t.status.draft}</option><option value="review">{t.status.review}</option></select>}
                {isAdmin && draft.status !== "approved" && <button type="button" disabled={busy || !dirty} onClick={() => void save()} className="rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? t.saving : t.save}</button>}
                {isAdmin && draft.status !== "approved" && <button type="button" disabled={busy} onClick={approve} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> {t.approval.approve}</button>}
                {isAdmin && draft.status === "approved" && isLatest && <button type="button" disabled={busy} onClick={openNewVersion} className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><FilePlus2 className="h-4 w-4" /> {t.list.newVersion}</button>}
              </div>
              {draft.status === "approved" && <Notice tone="teal"><span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> {t.lockedNote}</span></Notice>}
              {!isLatest && <Notice tone="slate">{t.olderNote}</Notice>}
              {!isAdmin && <Notice tone="slate">{t.readOnly}</Notice>}
              <p role="status" className="text-sm text-indigo-800">{message}</p>
              {versions.length > 1 && <div className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-2 text-xs font-semibold text-slate-600">{t.list.versions}</h3><div className="flex flex-wrap gap-2">{versions.map(item => <button type="button" key={item.id} onClick={() => select(item.id)} className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs ${item.id === draft.id ? "border-teal-500 bg-teal-50" : "border-slate-200"}`}><span className="font-mono">{item.version}</span><StatusBadge status={item.status} /></button>)}</div></div>}
              <ProductSpecForm spec={draft} onChange={next => { setDraft(next); setDirty(true); }} disabled={readOnly} isAdmin={isAdmin} manufacturer={manufacturer} packagingConfig={packagingConfig} markets={markets} />
            </> : !loading && <p className="py-12 text-center text-sm text-slate-500">{isAdmin ? t.list.empty : t.readOnly}</p>}
          </div>
        </div>
      </div>
    </div>
    {draft && <div className="spec-print-root"><ProductSpecPrint spec={draft} claims={manufacturer?.vaultDetails?.productClaims ?? []} market={market} /></div>}
  </>, document.body);
}
