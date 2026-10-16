import { useState, type ReactNode } from "react";
import { Award, Download, MoreHorizontal, Plus, Printer, Trash2, Wand2 } from "lucide-react";
import { createDemoMatrix } from "../data/rfqMatrixDemo";
import {
  applySuggestions, createMatrix, createOfferItem, criterionPoints, criterionShare, MAX_MANUFACTURERS, MIN_MANUFACTURERS, newId, priceOutliers,
  removeManufacturer, scoreLabels, sectionPoints, suggestedScores, toCsv, totals, weightTotal, weightsValid, type Criterion, type RfqMatrix, type Section,
} from "../domain/rfqMatrix";

const green = "#2f5d50";
const cellInput = "w-full min-w-[7rem] rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-900 disabled:bg-transparent disabled:border-transparent";
const numberInput = "w-16 rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-900 disabled:bg-transparent disabled:border-transparent";
const cell = "border-b border-slate-200 px-2 py-1.5 align-top";
const points = (value: number | null) => value === null ? "–" : value.toFixed(2);
// Print only the matrix, landscape; the rest of the page is hidden while printing.
const printCss = `@media print {
  body.rfq-printing * { visibility: hidden !important; }
  body.rfq-printing #rfq-matrix, body.rfq-printing #rfq-matrix * { visibility: visible !important; }
  body.rfq-printing #rfq-matrix { position: absolute; left: 0; top: 0; width: 100%; border: 0; }
  body.rfq-printing #rfq-matrix .rfq-no-print { display: none !important; }
  body.rfq-printing #rfq-matrix .rfq-scroll { overflow: visible !important; }
  body.rfq-printing #rfq-matrix tr { break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: landscape; margin: 8mm; }
}`;

export default function RfqComparisonMatrix({ matrix: stored, onChange, disabled, isAdmin, shortlist = [] }: { matrix?: RfqMatrix; onChange: (matrix: RfqMatrix) => void; disabled: boolean; isAdmin: boolean; shortlist?: string[] }) {
  const [fallback] = useState(createMatrix);
  const matrix = stored ?? fallback;
  const result = totals(matrix), m = matrix.manufacturers, columns = 2 + m.length * 3;
  const total = weightTotal(matrix), weightsOk = weightsValid(matrix);

  const mapCriteria = (fn: (item: Criterion) => Criterion) => ({ items: matrix.items.map(item => ({ ...item, criteria: item.criteria.map(fn) })), sections: matrix.sections.map(section => ({ ...section, criteria: section.criteria.map(fn) })) });
  const setCriterion = (id: string, patch: (item: Criterion) => Partial<Criterion>) => onChange({ ...matrix, ...mapCriteria(item => item.id === id ? { ...item, ...patch(item) } : item) });
  const setScore = (item: Criterion, manufacturerId: string, value: string) => setCriterion(item.id, current => { const { [manufacturerId]: _old, ...scores } = current.scores; return { scores: value ? { ...scores, [manufacturerId]: Number(value) } : scores }; });
  const setSection = (id: string, patch: Partial<Section>) => onChange({ ...matrix, sections: matrix.sections.map(section => section.id === id ? { ...section, ...patch } : section) });
  const addManufacturer = () => onChange({ ...matrix, manufacturers: [...m, { id: newId("m"), name: `Manufacturer ${m.length + 1}` }] });
  const print = () => { document.body.classList.add("rfq-printing"); const done = () => { document.body.classList.remove("rfq-printing"); window.removeEventListener("afterprint", done); }; window.addEventListener("afterprint", done); window.print(); };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + toCsv(matrix)], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `rfq-comparison-matrix-${(matrix.brief || "export").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.csv` });
    link.click(); URL.revokeObjectURL(url);
  };

  const criterionRows = (criteria: Criterion[], weight: number) => criteria.map(item => {
    const suggested = suggestedScores(item, m), outliers = item.kind === "unitPrice" ? priceOutliers(item, m) : [];
    return <tr key={item.id} className="odd:bg-white even:bg-slate-50">
      <td className={`${cell} sticky left-0 z-[1] bg-inherit`}><input aria-label="Criterion" className={`${cellInput} min-w-[11rem] font-medium`} maxLength={120} value={item.label} onChange={e => setCriterion(item.id, () => ({ label: e.target.value }))} /></td>
      <td className={cell}><div className="flex items-center gap-1"><input aria-label={`${item.label} relative weight`} title="Relative weight within the section" className={numberInput} type="number" min={0} step={0.1} value={item.weight} onChange={e => setCriterion(item.id, () => ({ weight: Math.max(0, Number(e.target.value) || 0) }))} /><span className="whitespace-nowrap text-[11px] text-slate-500">{criterionShare(criteria, item, weight).toFixed(1)}%</span></div></td>
      {m.map(manufacturer => {
        const score = item.scores[manufacturer.id], hint = suggested[manufacturer.id];
        return [
          <td key={`${manufacturer.id}-v`} className={`${cell} border-l border-slate-300`}><input aria-label={`${manufacturer.name} ${item.label} value`} className={cellInput} maxLength={300} value={item.values[manufacturer.id] ?? ""} onChange={e => setCriterion(item.id, current => ({ values: { ...current.values, [manufacturer.id]: e.target.value } }))} />
            {outliers.includes(manufacturer.id) && <span className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Price outlier</span>}</td>,
          <td key={`${manufacturer.id}-s`} className={cell}><select aria-label={`${manufacturer.name} ${item.label} score`} className={`${cellInput} min-w-[6.5rem] ${score ? "" : "text-slate-400"}`} value={score ?? ""} onChange={e => setScore(item, manufacturer.id, e.target.value)}>
            <option value="">{hint ? `— (suggest ${hint})` : "—"}</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} · {scoreLabels[value]}</option>)}</select></td>,
          <td key={`${manufacturer.id}-w`} className={`${cell} text-right tabular-nums text-xs`}>{points(criterionPoints(criteria, item, manufacturer.id, weight))}</td>,
        ];
      })}
    </tr>;
  });
  const summaryRow = (label: ReactNode, values: (manufacturerId: string) => ReactNode, strong = false) => <tr className={strong ? "bg-emerald-50 font-semibold" : "bg-slate-100 font-semibold"}>
    <td className={`${cell} sticky left-0 z-[1] bg-inherit text-xs`} colSpan={2}>{label}</td>
    {m.map(manufacturer => <td key={manufacturer.id} colSpan={3} className={`${cell} border-l border-slate-300 text-right tabular-nums text-xs`}>{values(manufacturer.id)}</td>)}
  </tr>;
  const sectionHeader = (section: Section, index: number) => <tr style={{ backgroundColor: "#e3eee9" }}>
    <td colSpan={columns} className={`${cell} sticky left-0`}><div className="flex flex-wrap items-center gap-3 text-sm font-bold" style={{ color: green }}>{index + 1}) {section.title}
      <label className="flex items-center gap-1 text-xs font-medium text-slate-600">Weight<input aria-label={`${section.title} weight`} className={numberInput} type="number" min={0} max={100} step={1} value={section.weight} onChange={e => setSection(section.id, { weight: Math.max(0, Number(e.target.value) || 0) })} />%</label></div></td>
  </tr>;
  const impactRow = (section: Section) => summaryRow(`${section.title} Impact (${section.weight}%)`, id => `${result.rows.find(row => row.id === id)!.impacts[section.id].toFixed(1)} / ${section.weight}`);

  return <section id="rfq-matrix" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <style>{printCss}</style>
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="mr-auto flex items-center gap-2 font-semibold" style={{ color: green }}>RFQ Comparison Matrix{matrix.isDemo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">Demo data</span>}</h4>
      <div className="rfq-no-print flex flex-wrap items-center gap-2">
        <button type="button" onClick={print} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Printer className="h-3.5 w-3.5" /> Print / Save as PDF</button>
        <button type="button" onClick={exportCsv} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Download className="h-3.5 w-3.5" /> Export CSV</button>
        {isAdmin && <details className="relative"><summary aria-label="More actions" className="flex cursor-pointer list-none items-center rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" /></summary>
          <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-lg">
            <button type="button" disabled={disabled} className="block w-full rounded px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40" onClick={() => { if (window.confirm("Replace the current matrix with fictional demo data? Click Save afterwards to keep it.")) onChange(createDemoMatrix()); }}>Load demo data</button>
            {matrix.isDemo && <button type="button" disabled={disabled} className="block w-full rounded px-3 py-2 text-left text-red-700 hover:bg-red-50 disabled:opacity-40" onClick={() => { if (window.confirm("Remove the demo data and start an empty matrix? Click Save afterwards to apply.")) onChange(createMatrix()); }}>Remove demo data</button>}
          </div></details>}
      </div>
    </div>
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <label className="block text-xs text-slate-600">Project / brief<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:bg-slate-50" maxLength={300} placeholder="e.g. Hotel-grade bath towel 600 GSM, 70x140 cm – 3,000 pcs" value={matrix.brief} onChange={e => onChange({ ...matrix, brief: e.target.value })} /></label>
      <div className="rfq-no-print flex flex-wrap items-center gap-2">
        <button type="button" disabled={m.length >= MAX_MANUFACTURERS} title={m.length >= MAX_MANUFACTURERS ? `Maximum ${MAX_MANUFACTURERS} manufacturers` : undefined} onClick={addManufacturer} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{ backgroundColor: green }}><Plus className="h-3.5 w-3.5" /> Add Manufacturer</button>
        <button type="button" onClick={() => onChange(applySuggestions(matrix))} title="Fills empty scores of price, logistics, lead time, capacity and years rows" className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Wand2 className="h-3.5 w-3.5" /> Apply suggested scores</button>
        <span className="text-[11px] text-slate-500">Scores: 1 Poor · 2 Below avg · 3 Acceptable · 4 Good · 5 Excellent</span>
      </div>
      {!weightsOk && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">Section weights add up to {total}%. They must total 100% before the step can be saved.</p>}
      <datalist id="rfq-shortlist">{shortlist.map(name => <option key={name} value={name} />)}</datalist>
      <div className="rfq-scroll overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr style={{ backgroundColor: green }} className="text-white">
              <th rowSpan={2} className="sticky left-0 z-[2] px-2 py-2 font-semibold" style={{ backgroundColor: green }}>Criteria</th>
              <th rowSpan={2} className="px-2 py-2 font-semibold">Weight (%)</th>
              {m.map((manufacturer, index) => <th key={manufacturer.id} colSpan={3} className="border-l border-white/30 px-2 py-2 font-semibold">
                <div className="flex items-center gap-1">
                  <input aria-label={`Manufacturer ${index + 1} name`} list="rfq-shortlist" className="w-full min-w-[9rem] rounded border border-white/40 bg-white/10 px-1.5 py-1 text-xs text-white placeholder-white/60 disabled:border-transparent" maxLength={120} value={manufacturer.name} onChange={e => onChange({ ...matrix, manufacturers: m.map(item => item.id === manufacturer.id ? { ...item, name: e.target.value } : item) })} />
                  {result.recommended.includes(manufacturer.id) && <span className="flex shrink-0 items-center gap-0.5 rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-950"><Award className="h-3 w-3" /> Recommended</span>}
                  <button type="button" aria-label={`Remove ${manufacturer.name}`} disabled={m.length <= MIN_MANUFACTURERS} title={m.length <= MIN_MANUFACTURERS ? `At least ${MIN_MANUFACTURERS} manufacturers are required` : undefined} className="rfq-no-print shrink-0 rounded p-1 text-white/80 hover:bg-white/10 disabled:opacity-30" onClick={() => { if (window.confirm(`Remove ${manufacturer.name || "this manufacturer"} and all of its values and scores?`)) onChange(removeManufacturer(matrix, manufacturer.id)); }}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </th>)}
            </tr>
            <tr style={{ backgroundColor: green }} className="text-[11px] text-white/90">{m.map(manufacturer => [<th key={`${manufacturer.id}-v`} className="border-l border-white/30 px-2 py-1 font-medium">Value</th>, <th key={`${manufacturer.id}-s`} className="px-2 py-1 font-medium">Score</th>, <th key={`${manufacturer.id}-w`} className="px-2 py-1 text-right font-medium">Weighted</th>])}</tr>
          </thead>
          <tbody>
            {matrix.sections.map((section, index) => section.id === "offer" ? <SectionBody key={section.id}>
              {sectionHeader(section, index)}
              {matrix.items.map(item => <SectionBody key={item.id}>
                <tr className="bg-white"><td colSpan={columns} className={`${cell} sticky left-0`}><div className="flex items-center gap-2"><input aria-label="Item name" className={`${cellInput} max-w-xs font-semibold`} maxLength={120} value={item.name} onChange={e => onChange({ ...matrix, items: matrix.items.map(entry => entry.id === item.id ? { ...entry, name: e.target.value } : entry) })} />
                  {matrix.items.length > 1 && <button type="button" className="rfq-no-print flex items-center gap-1 text-[11px] text-red-700" onClick={() => { if (window.confirm(`Remove ${item.name} and its scores?`)) onChange({ ...matrix, items: matrix.items.filter(entry => entry.id !== item.id) }); }}><Trash2 className="h-3 w-3" /> Remove item</button>}</div></td></tr>
                {criterionRows(item.criteria, section.weight)}
                {summaryRow(`Evaluation Point – ${item.name}`, id => `${sectionPoints(item.criteria, id, section.weight).toFixed(1)} / ${section.weight}`)}
                <tr className="bg-white"><td className={`${cell} sticky left-0 bg-white text-xs font-semibold`} colSpan={2}>Evaluation Notes</td>{m.map(manufacturer => <td key={manufacturer.id} colSpan={3} className={`${cell} border-l border-slate-300`}><textarea aria-label={`${manufacturer.name} evaluation notes`} rows={2} maxLength={1000} className={`${cellInput} min-w-[14rem]`} value={item.notes[manufacturer.id] ?? ""} onChange={e => onChange({ ...matrix, items: matrix.items.map(entry => entry.id === item.id ? { ...entry, notes: { ...entry.notes, [manufacturer.id]: e.target.value } } : entry) })} /></td>)}</tr>
              </SectionBody>)}
              <tr className="rfq-no-print"><td colSpan={columns} className={`${cell} sticky left-0`}><button type="button" className="flex items-center gap-1 text-xs font-semibold" style={{ color: green }} onClick={() => onChange({ ...matrix, items: [...matrix.items, createOfferItem(matrix.items.length + 1)] })}><Plus className="h-3.5 w-3.5" /> Add Item</button></td></tr>
              {impactRow(section)}
            </SectionBody> : <SectionBody key={section.id}>{sectionHeader(section, index)}{criterionRows(section.criteria, section.weight)}{impactRow(section)}</SectionBody>)}
            {summaryRow(<span className="text-sm">TOTAL SCORE (/100){!weightsOk && <span className="ml-2 text-red-700">· weights total {total}%</span>}</span>, id => { const row = result.rows.find(entry => entry.id === id)!; return <span className={`text-sm ${result.recommended.includes(id) ? "text-emerald-800" : ""}`}>{row.total.toFixed(1)}</span>; }, true)}
          </tbody>
        </table>
      </div>
    </fieldset>
    <ol className="flex flex-wrap gap-2 text-xs">{result.ranking.map((row, index) => <li key={row.id} className={`rounded-lg px-3 py-1.5 ${result.recommended.includes(row.id) ? "bg-amber-100 font-semibold text-amber-950" : "bg-slate-100 text-slate-700"}`}>{index + 1}. {row.name || "Unnamed"} · {row.total.toFixed(1)}{result.recommended.includes(row.id) && " · Recommended"}</li>)}</ol>
  </section>;
}

// Groups rows without adding DOM (a <tbody> per section would break zebra striping and sticky behaviour).
function SectionBody({ children }: { children: ReactNode }) { return <>{children}</>; }
