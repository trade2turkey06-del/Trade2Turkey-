import { useState, type ReactNode } from "react";
import { Award, Download, MoreHorizontal, Plus, Printer, Trash2, Wand2 } from "lucide-react";
import { createDemoMatrix } from "../data/rfqMatrixDemo";
import { useI18n } from "../i18n";
import {
  applySuggestions, createMatrix, createOfferItem, criterionPoints, criterionShare, MAX_MANUFACTURERS, MIN_MANUFACTURERS, newId, priceOutliers,
  removeManufacturer, sectionPoints, suggestedScores, toCsv, totals, weightTotal, weightsValid, type Criterion, type RfqMatrix, type Section,
} from "../domain/rfqMatrix";

const green = "#2f5d50";
const field = "rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-900 disabled:bg-transparent disabled:border-transparent";
const cellInput = `${field} w-full`;
const numberInput = `${field} w-12`;
const points = (value: number | null) => value === null ? "–" : value.toFixed(2);
// Print only the matrix, landscape; the rest of the page is hidden while printing.
const printCss = `@media print {
  body.rfq-printing * { visibility: hidden !important; }
  body.rfq-printing #rfq-matrix, body.rfq-printing #rfq-matrix * { visibility: visible !important; }
  body.rfq-printing #rfq-matrix { position: absolute; left: 0; top: 0; width: 100%; border: 0; }
  body.rfq-printing #rfq-matrix .rfq-no-print { display: none !important; }
  body.rfq-printing #rfq-matrix .rfq-scroll { overflow: visible !important; }
  body.rfq-printing #rfq-matrix tr { break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Form controls cannot wrap text, so print shows their values as wrapping text instead. */
  body.rfq-printing #rfq-matrix input, body.rfq-printing #rfq-matrix select, body.rfq-printing #rfq-matrix textarea { display: none !important; }
  body.rfq-printing #rfq-matrix .rfq-print-text { display: block !important; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
  body.rfq-printing #rfq-matrix table { table-layout: fixed; width: 100%; }
  body.rfq-printing #rfq-matrix th, body.rfq-printing #rfq-matrix td { position: static !important; min-width: 0 !important; overflow-wrap: anywhere; }
  @page { size: landscape; margin: 8mm; }
}
#rfq-matrix .rfq-print-text { display: none; }
/* Scoped screen styles: the id selector outranks the app-wide table/input rules in index.css. */
#rfq-matrix table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
#rfq-matrix th, #rfq-matrix td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
#rfq-matrix th { text-align: left; }
#rfq-matrix .text-right { text-align: right; }
#rfq-matrix thead th { background: ${green}; color: #fff; font-weight: 600; border-bottom: 1px solid #24493f; vertical-align: middle; }
#rfq-matrix thead tr + tr th { color: #d5e8df; font-weight: 500; font-size: 11px; padding-top: 2px; }
#rfq-matrix input, #rfq-matrix select, #rfq-matrix textarea { min-height: 0; border-radius: 4px; line-height: 1.35; }
#rfq-matrix .rfq-m-start { border-left: 1px solid #cbd5e1; }
#rfq-matrix thead .rfq-m-start { border-left-color: rgba(255,255,255,.3); }
#rfq-matrix .rfq-c1 { position: sticky; left: 0; z-index: 1; width: 150px; min-width: 150px; max-width: 150px; }
#rfq-matrix .rfq-c2 { position: sticky; left: 150px; z-index: 1; width: 90px; min-width: 90px; max-width: 90px; box-shadow: inset -1px 0 #cbd5e1; }
#rfq-matrix .rfq-c12 { position: sticky; left: 0; z-index: 1; width: 240px; min-width: 240px; max-width: 240px; box-shadow: inset -1px 0 #cbd5e1; }
#rfq-matrix thead .rfq-c1, #rfq-matrix thead .rfq-c2 { z-index: 3; }
#rfq-matrix .rfq-value { width: 104px; min-width: 104px; }
#rfq-matrix .rfq-score { width: 52px; min-width: 52px; }
#rfq-matrix .rfq-weighted { width: 40px; min-width: 40px; text-align: right; }
#rfq-matrix .rfq-head-input { background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.55); color: #fff; }
#rfq-matrix .rfq-head-input::placeholder { color: rgba(255,255,255,.7); }
#rfq-matrix .rfq-head-input:focus { background: rgba(255,255,255,.22); border-color: #fff; }
#rfq-matrix .rfq-head-input:disabled { border-color: transparent; background: transparent; }
#rfq-matrix .rfq-sticky-inline { position: sticky; left: 6px; display: inline-flex; }`;
// Printed copy of a form control's value (see printCss).
const Printed = ({ text, className = "" }: { text: ReactNode; className?: string }) => <span className={`rfq-print-text ${className}`}>{text}</span>;

export default function RfqComparisonMatrix({ matrix: stored, onChange, disabled, isAdmin, shortlist = [] }: { matrix?: RfqMatrix; onChange: (matrix: RfqMatrix) => void; disabled: boolean; isAdmin: boolean; shortlist?: string[] }) {
  const [fallback] = useState(createMatrix);
  const r = useI18n().t.rfqMatrix, scoreLabels = r.scores;
  const matrix = stored ?? fallback;
  const result = totals(matrix), m = matrix.manufacturers, columns = 2 + m.length * 3;
  const total = weightTotal(matrix), weightsOk = weightsValid(matrix);

  const mapCriteria = (fn: (item: Criterion) => Criterion) => ({ items: matrix.items.map(item => ({ ...item, criteria: item.criteria.map(fn) })), sections: matrix.sections.map(section => ({ ...section, criteria: section.criteria.map(fn) })) });
  const setCriterion = (id: string, patch: (item: Criterion) => Partial<Criterion>) => onChange({ ...matrix, ...mapCriteria(item => item.id === id ? { ...item, ...patch(item) } : item) });
  const setScore = (item: Criterion, manufacturerId: string, value: string) => setCriterion(item.id, current => { const { [manufacturerId]: _old, ...scores } = current.scores; return { scores: value ? { ...scores, [manufacturerId]: Number(value) } : scores }; });
  const setSection = (id: string, patch: Partial<Section>) => onChange({ ...matrix, sections: matrix.sections.map(section => section.id === id ? { ...section, ...patch } : section) });
  const addManufacturer = () => onChange({ ...matrix, manufacturers: [...m, { id: newId("m"), name: r.defaultManufacturer(m.length + 1) }] });
  const print = () => { document.body.classList.add("rfq-printing"); const done = () => { document.body.classList.remove("rfq-printing"); window.removeEventListener("afterprint", done); }; window.addEventListener("afterprint", done); window.print(); };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + toCsv(matrix)], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `rfq-comparison-matrix-${(matrix.brief || "export").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.csv` });
    link.click(); URL.revokeObjectURL(url);
  };

  const criterionRows = (criteria: Criterion[], weight: number) => criteria.map(item => {
    const suggested = suggestedScores(item, m), outliers = item.kind === "unitPrice" ? priceOutliers(item, m) : [];
    return <tr key={item.id} className="odd:bg-white even:bg-slate-50">
      <td className="rfq-c1 bg-inherit"><input aria-label={r.criterion} className={`${cellInput} font-medium`} maxLength={120} value={item.label} onChange={e => setCriterion(item.id, () => ({ label: e.target.value }))} /><Printed className="font-medium" text={item.label} /></td>
      <td className="rfq-c2 bg-inherit"><div className="flex items-center gap-1"><input aria-label={`${item.label} ${r.relativeWeight}`} title={r.relativeWeight} className={numberInput} type="number" min={0} step={0.1} value={item.weight} onChange={e => setCriterion(item.id, () => ({ weight: Math.max(0, Number(e.target.value) || 0) }))} /><Printed text={`×${item.weight}`} /><span className="whitespace-nowrap text-[10px] text-slate-500">{criterionShare(criteria, item, weight).toFixed(1)}%</span></div></td>
      {m.map(manufacturer => {
        const score = item.scores[manufacturer.id], hint = suggested[manufacturer.id];
        return [
          <td key={`${manufacturer.id}-v`} className="rfq-m-start rfq-value"><input title={item.values[manufacturer.id] || undefined} aria-label={r.valueFor(manufacturer.name, item.label)} className={cellInput} maxLength={300} value={item.values[manufacturer.id] ?? ""} onChange={e => setCriterion(item.id, current => ({ values: { ...current.values, [manufacturer.id]: e.target.value } }))} /><Printed text={item.values[manufacturer.id] ?? ""} />
            {outliers.includes(manufacturer.id) && <span className="mt-1 inline-block whitespace-nowrap rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{r.priceOutlier}</span>}</td>,
          <td key={`${manufacturer.id}-s`} className="rfq-score"><select aria-label={r.scoreFor(manufacturer.name, item.label)} title={score ? `${score} · ${scoreLabels[score]}` : hint ? r.suggested(hint, scoreLabels[hint]) : r.notScored} className={`${field} w-full px-1 ${score ? "" : "text-slate-400"}`} value={score ?? ""} onChange={e => setScore(item, manufacturer.id, e.target.value)}>
            <option value="">{hint ? `(${hint})` : "–"}</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value} title={scoreLabels[value]}>{value}</option>)}</select><Printed text={score ? `${score} · ${scoreLabels[score]}` : "–"} /></td>,
          <td key={`${manufacturer.id}-w`} className="rfq-weighted tabular-nums">{points(criterionPoints(criteria, item, manufacturer.id, weight))}</td>,
        ];
      })}
    </tr>;
  });
  const summaryRow = (label: ReactNode, values: (manufacturerId: string) => ReactNode, strong = false) => <tr className={strong ? "bg-emerald-50 font-semibold" : "bg-slate-100 font-semibold"}>
    <td className="rfq-c12 bg-inherit" colSpan={2}>{label}</td>
    {m.map(manufacturer => <td key={manufacturer.id} colSpan={3} className="rfq-m-start text-right tabular-nums">{values(manufacturer.id)}</td>)}
  </tr>;
  const sectionHeader = (section: Section, index: number) => <tr style={{ backgroundColor: "#e3eee9" }}>
    <td colSpan={columns}><div className="rfq-sticky-inline items-center gap-3 whitespace-nowrap text-sm font-bold" style={{ color: green }}>{index + 1}) {section.title}
      <label className="flex items-center gap-1 text-xs font-medium text-slate-600">{r.weightShort}<input aria-label={r.sectionWeight(section.title)} className={numberInput} type="number" min={0} max={100} step={1} value={section.weight} onChange={e => setSection(section.id, { weight: Math.max(0, Number(e.target.value) || 0) })} /><Printed className="inline" text={section.weight} />%</label></div></td>
  </tr>;
  const impactRow = (section: Section) => summaryRow(r.impact(section.title, section.weight), id => `${result.rows.find(row => row.id === id)!.impacts[section.id].toFixed(1)} / ${section.weight}`);

  return <section id="rfq-matrix" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <style>{printCss}</style>
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="mr-auto flex items-center gap-2 font-semibold" style={{ color: green }}>{r.title}{matrix.isDemo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">{r.demo}</span>}</h4>
      <div className="rfq-no-print flex flex-wrap items-center gap-2">
        <button type="button" onClick={print} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Printer className="h-3.5 w-3.5" /> {r.print}</button>
        <button type="button" onClick={exportCsv} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Download className="h-3.5 w-3.5" /> {r.exportCsv}</button>
        {isAdmin && <details className="relative"><summary aria-label={r.moreActions} className="flex cursor-pointer list-none items-center rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" /></summary>
          <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-lg">
            <button type="button" disabled={disabled} className="block w-full rounded px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40" onClick={() => { if (window.confirm(r.loadDemoConfirm)) onChange(createDemoMatrix()); }}>{r.loadDemo}</button>
            {matrix.isDemo && <button type="button" disabled={disabled} className="block w-full rounded px-3 py-2 text-left text-red-700 hover:bg-red-50 disabled:opacity-40" onClick={() => { if (window.confirm(r.removeDemoConfirm)) onChange(createMatrix()); }}>{r.removeDemo}</button>}
          </div></details>}
      </div>
    </div>
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <label className="block text-xs text-slate-600">{r.brief}<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:bg-slate-50" maxLength={300} placeholder={r.briefPlaceholder} value={matrix.brief} onChange={e => onChange({ ...matrix, brief: e.target.value })} /><Printed className="mt-1 text-sm font-semibold text-slate-900" text={matrix.brief} /></label>
      <div className="rfq-no-print flex flex-wrap items-center gap-2">
        <button type="button" disabled={m.length >= MAX_MANUFACTURERS} title={m.length >= MAX_MANUFACTURERS ? r.maxManufacturers(MAX_MANUFACTURERS) : undefined} onClick={addManufacturer} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{ backgroundColor: green }}><Plus className="h-3.5 w-3.5" /> {r.addManufacturer}</button>
        <button type="button" onClick={() => onChange(applySuggestions(matrix))} title={r.applySuggestionsHelp} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Wand2 className="h-3.5 w-3.5" /> {r.applySuggestions}</button>
        <span className="text-[11px] text-slate-500">{r.scoreLegend}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs" aria-label={r.summary}>
        <span className="font-semibold text-slate-600">{r.ranking}</span>
        {result.ranking.map((row, index) => <span key={row.id} className={`flex items-center gap-1 rounded-md px-2 py-1 ${result.recommended.includes(row.id) ? "bg-amber-100 font-semibold text-amber-950 ring-1 ring-amber-300" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{index + 1}. {row.name || r.unnamed} <strong className="tabular-nums">{row.total.toFixed(1)}</strong>{result.recommended.includes(row.id) && <><Award className="h-3.5 w-3.5" /> {r.recommended}</>}</span>)}
        {!result.recommended.length && <span className="text-slate-500">{r.scoreToSee}</span>}
      </div>
      {!weightsOk && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{r.weightsInvalid(String(total))}</p>}
      <datalist id="rfq-shortlist">{shortlist.map(name => <option key={name} value={name} />)}</datalist>
      <div className="rfq-scroll overflow-x-auto rounded-lg border border-slate-200">
        <table>
          <thead>
            <tr>
              <th rowSpan={2} className="rfq-c1 align-middle">{r.criteria}</th>
              <th rowSpan={2} className="rfq-c2 align-middle">{r.weight}</th>
              {m.map((manufacturer, index) => <th key={manufacturer.id} colSpan={3} className="rfq-m-start">
                <div className="flex items-center gap-1">
                  <input aria-label={r.manufacturerN(index + 1)} list="rfq-shortlist" title={manufacturer.name} placeholder={r.manufacturerName} className="rfq-head-input w-full min-w-0 rounded px-1.5 py-1 text-xs font-semibold" maxLength={120} value={manufacturer.name} onChange={e => onChange({ ...matrix, manufacturers: m.map(item => item.id === manufacturer.id ? { ...item, name: e.target.value } : item) })} /><Printed text={manufacturer.name} />
                  {result.recommended.includes(manufacturer.id) && <span title={r.recommended} className="flex shrink-0 items-center gap-0.5 rounded bg-amber-300 px-1 py-0.5 text-[10px] font-bold text-amber-950"><Award className="h-3 w-3" /> {r.best}</span>}
                  <button type="button" aria-label={r.removeManufacturer(manufacturer.name)} disabled={m.length <= MIN_MANUFACTURERS} title={m.length <= MIN_MANUFACTURERS ? r.minManufacturers(MIN_MANUFACTURERS) : undefined} className="rfq-no-print shrink-0 rounded p-1 text-white/80 hover:bg-white/10 disabled:opacity-30" onClick={() => { if (window.confirm(r.removeManufacturerConfirm(manufacturer.name))) onChange(removeManufacturer(matrix, manufacturer.id)); }}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </th>)}
            </tr>
            <tr>{m.map(manufacturer => [<th key={`${manufacturer.id}-v`} className="rfq-m-start">{r.value}</th>, <th key={`${manufacturer.id}-s`} title={r.scoreLegend}>{r.score}</th>, <th key={`${manufacturer.id}-w`} className="rfq-weighted">{r.weighted}</th>])}</tr>
          </thead>
          <tbody>
            {matrix.sections.map((section, index) => section.id === "offer" ? <SectionBody key={section.id}>
              {sectionHeader(section, index)}
              {matrix.items.map(item => <SectionBody key={item.id}>
                <tr className="bg-white"><td colSpan={columns}><div className="rfq-sticky-inline items-center gap-2"><input aria-label={r.itemName} className={`${field} w-72 font-semibold`} maxLength={120} value={item.name} onChange={e => onChange({ ...matrix, items: matrix.items.map(entry => entry.id === item.id ? { ...entry, name: e.target.value } : entry) })} /><Printed className="font-semibold" text={item.name} />
                  {matrix.items.length > 1 && <button type="button" className="rfq-no-print flex items-center gap-1 text-[11px] text-red-700" onClick={() => { if (window.confirm(r.removeItemConfirm(item.name))) onChange({ ...matrix, items: matrix.items.filter(entry => entry.id !== item.id) }); }}><Trash2 className="h-3 w-3" /> {r.removeItem}</button>}</div></td></tr>
                {criterionRows(item.criteria, section.weight)}
                {summaryRow(r.evaluationPoint(item.name), id => `${sectionPoints(item.criteria, id, section.weight).toFixed(1)} / ${section.weight}`)}
                <tr className="bg-white"><td className="rfq-c12 bg-white font-semibold" colSpan={2}>{r.evaluationNotes}</td>{m.map(manufacturer => <td key={manufacturer.id} colSpan={3} className="rfq-m-start"><textarea aria-label={r.notesFor(manufacturer.name)} rows={2} maxLength={1000} className={cellInput} value={item.notes[manufacturer.id] ?? ""} onChange={e => onChange({ ...matrix, items: matrix.items.map(entry => entry.id === item.id ? { ...entry, notes: { ...entry.notes, [manufacturer.id]: e.target.value } } : entry) })} /><Printed text={item.notes[manufacturer.id] ?? ""} /></td>)}</tr>
              </SectionBody>)}
              <tr className="rfq-no-print bg-white"><td colSpan={columns}><button type="button" className="rfq-sticky-inline items-center gap-1 text-xs font-semibold" style={{ color: green }} onClick={() => onChange({ ...matrix, items: [...matrix.items, createOfferItem(matrix.items.length + 1)] })}><Plus className="h-3.5 w-3.5" /> {r.addItem}</button></td></tr>
              {impactRow(section)}
            </SectionBody> : <SectionBody key={section.id}>{sectionHeader(section, index)}{criterionRows(section.criteria, section.weight)}{impactRow(section)}</SectionBody>)}
            {summaryRow(<span className="text-sm">{r.total}{!weightsOk && <span className="ml-2 text-red-700">{r.weightsTotal(String(total))}</span>}</span>, id => { const row = result.rows.find(entry => entry.id === id)!; return <span className={`text-sm ${result.recommended.includes(id) ? "text-emerald-800" : ""}`}>{row.total.toFixed(1)}</span>; }, true)}
          </tbody>
        </table>
      </div>
    </fieldset>
  </section>;
}

// Groups rows without adding DOM (a <tbody> per section would break zebra striping and sticky behaviour).
function SectionBody({ children }: { children: ReactNode }) { return <>{children}</>; }
