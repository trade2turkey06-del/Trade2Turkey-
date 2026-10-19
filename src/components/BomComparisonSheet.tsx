import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, Plus, Printer, Star, Trash2, TriangleAlert } from "lucide-react";
import { useI18n } from "../i18n";
import CostBars from "./CostBars";
import { downloadCsv, printSheet, sheetPrintCss } from "../lib/sheetExport";
import { MAX_MANUFACTURERS, MIN_MANUFACTURERS, newId, type RfqMatrix } from "../domain/rfqMatrix";
import { lowestIds, parseAmount, type CogsSheet, type ShortlistEntry } from "../domain/cogsBreakdown";
import {
  analyseBomAll, BOM_GROUPS, bomCsv, bomLeaders, bomSettings, createBomLine, createBomSheet, highestIds, reconcileBom,
  type BomAnalysis, type BomCell, type BomGroup, type BomLine, type BomSheet,
} from "../domain/bomComparison";

const green = "#2f5d50";
const field = "rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-900 disabled:bg-transparent disabled:border-transparent";
const cellInput = `${field} w-full`;
// Dataviz palette slots 1, 3 and 2 (validated): packaging keeps the A.B.5 packaging colour.
const segmentColors: Record<string, string> = { main: "#2a78d6", other: "#1baf7a", packaging: "#eb6834" };
const COLUMNS = ["qty", "price", "origin", "recipe", "share", "cost", "sensitivity"] as const;
const css = `${sheetPrintCss("bom-sheet", "bom-printing")}
#bom-sheet table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
#bom-sheet th, #bom-sheet td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
#bom-sheet th { text-align: left; }
#bom-sheet thead th { background: ${green}; color: #fff; font-weight: 600; border-bottom: 1px solid #24493f; vertical-align: middle; }
#bom-sheet thead tr + tr th { color: #d5e8df; font-weight: 500; font-size: 11px; padding-top: 2px; }
#bom-sheet input, #bom-sheet select { min-height: 0; border-radius: 4px; line-height: 1.35; }
#bom-sheet .bom-c1 { position: sticky; left: 0; z-index: 1; width: 240px; min-width: 240px; max-width: 240px; box-shadow: inset -1px 0 #cbd5e1; }
#bom-sheet thead .bom-c1 { z-index: 3; }
@media (max-width: 640px) { #bom-sheet .bom-c1 { width: 150px; min-width: 150px; max-width: 150px; } }
#bom-sheet .bom-m-start { border-left: 1px solid #cbd5e1; }
#bom-sheet thead .bom-m-start { border-left-color: rgba(255,255,255,.3); }
#bom-sheet .bom-qty, #bom-sheet .bom-recipe, #bom-sheet .bom-share, #bom-sheet .bom-sensitivity { width: 68px; min-width: 68px; }
#bom-sheet .bom-price, #bom-sheet .bom-cost { width: 88px; min-width: 88px; }
#bom-sheet .bom-origin { width: 120px; min-width: 120px; }
#bom-sheet .text-right { text-align: right; }
#bom-sheet .bom-head-input { background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.55); color: #fff; }
#bom-sheet .bom-head-input::placeholder { color: rgba(255,255,255,.7); }
#bom-sheet .bom-head-input:disabled { border-color: transparent; background: transparent; }
#bom-sheet .bom-sticky-inline { position: sticky; left: 6px; display: inline-flex; }`;
const Printed = ({ text, className = "" }: { text: ReactNode; className?: string }) => <span className={`rfq-print-text ${className}`}>{text}</span>;
const lowCell = "bg-emerald-50 font-semibold text-emerald-800", highCell = "bg-red-50 text-red-800", warnCell = "bg-orange-100 text-orange-900";
const levelTone = { ok: "text-emerald-800", warn: "bg-amber-50 text-amber-900", alert: "bg-red-50 text-red-800" } as const;

// cogs / rfq: saved A.B.5 and A.B.6 data. Manufacturers are the list shared with them (A.A.5 shortlist ids); currency,
// exchange rates and cost basis are read from A.B.5.
export default function BomComparisonSheet({ sheet: stored, onChange, disabled, shortlist, cogs, rfq }: {
  sheet?: BomSheet; onChange: (sheet: BomSheet) => void; disabled: boolean; shortlist: ShortlistEntry[]; cogs?: CogsSheet; rfq?: RfqMatrix;
}) {
  const { t, fmt } = useI18n();
  const b = t.bom;
  const [fallback] = useState(() => createBomSheet(cogs, t.cogs.defaults));
  const shortlistKey = JSON.stringify(shortlist);
  const sheet = useMemo(() => disabled && stored ? stored : reconcileBom(stored ?? fallback, shortlist, cogs, rfq, b.defaultManufacturer), [stored, fallback, cogs, rfq, shortlistKey, disabled]);
  // No dependency list on purpose (see CogsBreakdownSheet): re-checked after every render, stops once the draft matches.
  useEffect(() => { if (!disabled && sheet !== stored) onChange(sheet); });

  const settings = bomSettings(cogs, t.cogs.defaults), m = sheet.manufacturers, results = analyseBomAll(sheet, settings), leaders = bomLeaders(sheet, results);
  const columns = 1 + m.length * COLUMNS.length;
  const money = (value: number | null | undefined) => value === null || value === undefined ? "–" : fmt.currency(value, settings.baseCurrency, 2);
  const pct = (value: number | null | undefined) => value === null || value === undefined ? "–" : fmt.percent(value, 1, 1);
  const currencyOf = (id: string) => cogs?.manufacturers.find(item => item.id === id)?.currency ?? settings.baseCurrency;
  const share = (value: number | null, total: number | null) => value === null || !total ? null : value / total * 100;

  const set = (patch: Partial<BomSheet>) => onChange({ ...sheet, ...patch });
  const setLine = (id: string, patch: (line: BomLine) => Partial<BomLine>) => set({ lines: sheet.lines.map(line => line.id === id ? { ...line, ...patch(line) } : line) });
  const setCell = (line: BomLine, id: string, key: keyof BomCell, value: string) => setLine(line.id, current => ({ values: { ...current.values, [id]: { ...current.values[id], [key]: value } } }));
  const markMain = (id: string) => set({ lines: sheet.lines.map(line => { const { main: _main, ...rest } = line; return line.id === id ? { ...rest, main: true } : rest; }) });
  const removeManufacturer = (id: string) => set({
    manufacturers: m.filter(item => item.id !== id), removedIds: [...(sheet.removedIds ?? []).filter(item => item !== id), id].slice(-50),
    lines: sheet.lines.map(line => { const { [id]: _value, ...values } = line.values; return { ...line, values }; }),
  });
  // Lowest green / highest red across manufacturers.
  const tone = (pick: (result: BomAnalysis) => number | null, id: string) => {
    const values = Object.fromEntries(m.map(item => [item.id, pick(results[item.id])]));
    return lowestIds(values).includes(id) ? lowCell : highestIds(values).includes(id) ? highCell : "";
  };

  const textInput = (label: string, value: string, onValue: (value: string) => void, numeric = true) => {
    const invalid = numeric && !!value.trim() && parseAmount(value) === null;
    return <><input aria-label={label} inputMode={numeric ? "decimal" : undefined} maxLength={numeric ? 40 : 120} className={`${cellInput} ${numeric ? "text-right tabular-nums" : ""} ${invalid ? "border-red-500" : ""}`} value={value} onChange={e => onValue(e.target.value)} /><Printed className={numeric ? "text-right" : ""} text={value} /></>;
  };
  const groupHeader = (title: ReactNode) => <tr style={{ backgroundColor: "#e3eee9" }}><td colSpan={columns}><span className="bom-sticky-inline text-sm font-bold" style={{ color: green }}>{title}</span></td></tr>;
  const lineRows = (group: BomGroup) => sheet.lines.filter(line => line.group === group).map(line => {
    const flagged = m.some(item => results[item.id].lines[line.id].overweighted);
    return <tr key={line.id} className="odd:bg-white even:bg-slate-50">
      <th scope="row" className={`bom-c1 bg-inherit font-normal ${flagged ? "border-l-4 border-l-orange-400" : ""}`} title={flagged ? b.overweighted : undefined}>
        <div className="flex items-center gap-1">
          <input aria-label={b.lineName} className={`${cellInput} font-medium`} maxLength={120} value={line.label} onChange={e => setLine(line.id, () => ({ label: e.target.value }))} /><Printed className="font-medium" text={`${line.label}${line.main ? ` ★ ${b.mainIngredient}` : ""}`} />
          <select aria-label={`${line.label} ${b.unit}`} className={`${field} rfq-no-print w-[4.25rem] shrink-0 px-1`} value={line.unit} onChange={e => setLine(line.id, () => ({ unit: e.target.value as BomLine["unit"] }))}>{(["g", "pcs"] as const).map(unit => <option key={unit} value={unit}>{b.units[unit]}</option>)}</select>
          {group === "formulation" && <button type="button" aria-pressed={!!line.main} aria-label={b.markMain(line.label)} title={line.main ? b.mainIngredient : b.markMain(line.label)} className={`rfq-no-print shrink-0 rounded p-1 ${line.main ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}`} onClick={() => markMain(line.id)}><Star className="h-3.5 w-3.5" fill={line.main ? "currentColor" : "none"} /></button>}
          <button type="button" aria-label={b.deleteLine(line.label)} className="rfq-no-print shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700" onClick={() => { if (window.confirm(b.deleteLineConfirm(line.label || b.newLine))) set({ lines: sheet.lines.filter(item => item.id !== line.id) }); }}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </th>
      {m.map(item => {
        const cell = line.values[item.id] ?? {}, result = results[item.id].lines[line.id], warn = result.overweighted ? warnCell : "";
        return [
          <td key={`${item.id}-q`} className="bom-m-start bom-qty">{textInput(`${item.name} ${line.label} ${b.columns.qty}`, cell.qty ?? "", value => setCell(line, item.id, "qty", value))}<span className="mt-0.5 block text-right text-[10px] text-slate-500">{b.units[line.unit]}</span></td>,
          <td key={`${item.id}-p`} className="bom-price">{textInput(`${item.name} ${line.label} ${b.columns.price}`, cell.price ?? "", value => setCell(line, item.id, "price", value))}<span className="mt-0.5 block text-right text-[10px] text-slate-500">{b.priceUnit[line.unit](currencyOf(item.id))}</span></td>,
          <td key={`${item.id}-o`} className="bom-origin">{textInput(`${item.name} ${line.label} ${b.columns.origin}`, cell.origin ?? "", value => setCell(line, item.id, "origin", value), false)}</td>,
          <td key={`${item.id}-r`} className={`bom-recipe ${warn}`}>{group === "formulation" ? textInput(`${item.name} ${line.label} ${b.columns.recipe}`, cell.recipePct ?? "", value => setCell(line, item.id, "recipePct", value)) : <span className="block text-right text-slate-300">–</span>}</td>,
          <td key={`${item.id}-s`} title={result.overweighted ? b.overweighted : undefined} className={`bom-share text-right tabular-nums ${warn}`}>{result.overweighted && <TriangleAlert aria-label={b.overweighted} className="mr-0.5 inline h-3 w-3" />}{pct(result.share)}</td>,
          <td key={`${item.id}-c`} className={`bom-cost text-right tabular-nums ${tone(r => r.lines[line.id].cost, item.id)}`}>{money(result.cost)}</td>,
          <td key={`${item.id}-x`} title={b.sensitivityHelp} className="bom-sensitivity text-right tabular-nums text-slate-600">{result.sensitivity === null ? "–" : `+${fmt.percent(result.sensitivity, 2, 2)}`}</td>,
        ];
      })}
    </tr>;
  });
  // Subtotal / total rows: cost with lowest/highest colours and its share of the manufacturer's total BOM.
  const totalRow = (label: string, pick: (result: BomAnalysis) => number | null, strong = false) => <tr className={strong ? "bg-emerald-50/40 font-semibold" : "bg-slate-100 font-semibold"}>
    <th scope="row" className="bom-c1 bg-inherit">{label}</th>
    {m.map(item => <td key={item.id} colSpan={COLUMNS.length} className="bom-m-start"><div className="flex justify-end gap-3 tabular-nums">
      {!strong && <span className="text-slate-500">{pct(share(pick(results[item.id]), results[item.id].total))}</span>}
      <span className={`rounded px-1 ${tone(pick, item.id)}`}>{money(pick(results[item.id]))}</span></div></td>)}
  </tr>;
  const recipeRow = <tr className="bg-white">
    <th scope="row" className="bom-c1 bg-white font-medium">{b.recipeTotal}</th>
    {m.map(item => { const result = results[item.id]; return <td key={item.id} colSpan={COLUMNS.length} className={`bom-m-start tabular-nums ${result.recipeWarning ? "bg-amber-50 text-amber-900" : ""}`}>
      {result.recipeSum === null ? "–" : pct(result.recipeSum)}{result.recipeWarning && <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold"><TriangleAlert className="h-3.5 w-3.5" /> {b.recipeWarning}</span>}</td>; })}
  </tr>;

  return <section id="bom-sheet" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <style>{css}</style>
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="mr-auto font-semibold" style={{ color: green }}>{b.title}</h4>
      <div className="rfq-no-print flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => printSheet("bom-printing")} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Printer className="h-3.5 w-3.5" /> {b.print}</button>
        <button type="button" onClick={() => downloadCsv("bom-comparison", cogs?.brief ?? "", bomCsv(sheet, settings))} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Download className="h-3.5 w-3.5" /> {b.exportCsv}</button>
      </div>
    </div>
    <p className="text-xs text-slate-600">{b.help}</p>
    <p className="text-[11px] text-slate-500">{cogs ? b.settings(settings.baseCurrency, t.cogs.basisShort[settings.compareBasis]) : b.noCogs}</p>
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <section aria-label={b.summary} className="space-y-2">
        <h5 className="text-sm font-semibold text-slate-800">{b.summary}</h5>
        <CostBars title={b.chartTitle} empty={b.chartEmpty} money={money} pct={pct} legend={Object.keys(segmentColors).map(key => ({ key, label: b.segments[key], color: segmentColors[key] }))}
          rows={m.map(item => { const r = results[item.id]; return { id: item.id, name: item.name, total: r.total, segments: [{ key: "main", value: r.main ?? 0 }, { key: "other", value: r.otherMaterials ?? 0 }, { key: "packaging", value: r.subtotals.packaging ?? 0 }] }; })} />
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-700">{b.leaders(leaders.packaging?.name ?? "–", leaders.main?.name ?? "–", leaders.total?.name ?? "–")}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {m.map(item => { const r = results[item.id];
            const groupLine = (key: string, pick: (result: BomAnalysis) => number | null) => <li className="flex justify-between gap-2"><span className="flex items-center gap-1"><span aria-hidden className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: segmentColors[key] }} />{b.segments[key]}</span><span className="tabular-nums"><span className={`rounded px-1 ${tone(pick, item.id)}`}>{money(pick(r))}</span> <span className="text-slate-500">{pct(share(pick(r), r.total))}</span></span></li>;
            return <article key={item.id} className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs">
              <h6 className="flex justify-between gap-2 font-semibold text-slate-800"><span className="truncate">{item.name}</span><span className={`rounded px-1 tabular-nums ${tone(result => result.total, item.id)}`}>{money(r.total)}</span></h6>
              <ul className="space-y-1">{groupLine("main", result => result.main)}{groupLine("other", result => result.otherMaterials)}{groupLine("packaging", result => result.subtotals.packaging)}</ul>
              <div className="rounded bg-slate-50 p-2"><p className="font-semibold text-slate-700">★ {b.mainCard}{r.mainLine ? `: ${r.mainLine.label}` : ""}</p>
                {r.mainLine ? <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-600">
                  <dt>{b.columns.recipe}</dt><dd className="text-right tabular-nums">{pct(r.mainLine.recipe)}</dd>
                  <dt>{b.gramsPerUnit}</dt><dd className="text-right tabular-nums">{r.mainLine.grams === null ? "–" : `${fmt.number(r.mainLine.grams, 2)} g`}</dd>
                  <dt>{b.pricePerKg}</dt><dd className="text-right tabular-nums">{money(r.mainLine.pricePerKg)}</dd>
                  <dt>{b.contribution}</dt><dd className="text-right tabular-nums">{money(r.mainLine.cost)} · {pct(r.mainLine.share)}</dd>
                </dl> : <p className="text-slate-500">{b.noMain}</p>}</div>
              <div><p className="font-semibold text-slate-700">{b.topDrivers}</p><ol className="list-decimal pl-4 text-slate-600">{r.top.length ? r.top.map(entry => <li key={entry.id}>{entry.label} <span className="tabular-nums">+{fmt.percent(entry.sensitivity, 2, 2)}</span></li>) : <li className="list-none">–</li>}</ol></div>
              <div><p className="font-semibold text-slate-700">{b.reconciliation}</p><ul className="space-y-0.5">{BOM_GROUPS.map(group => { const rec = r.reconciliation[group];
                return <li key={group} className={`flex justify-between gap-2 rounded px-1 ${rec.level ? levelTone[rec.level] : ""}`}><span>{b.reconcileGroups[group]}</span><span className="tabular-nums">{rec.diffPct === null ? (rec.cogs === null ? b.noCogsFigure : "–") : <>{rec.level !== "ok" && <TriangleAlert className="mr-0.5 inline h-3 w-3" />}{rec.diffPct > 0 ? "+" : ""}{pct(rec.diffPct)}</>}</span></li>; })}</ul></div>
              {r.recipeWarning && <p className="flex items-center gap-1 rounded bg-amber-50 px-1 text-amber-900"><TriangleAlert className="h-3.5 w-3.5" /> {b.recipeWarning} ({pct(r.recipeSum)})</p>}
              {r.missingFactor && <p className="text-amber-700">{b.missingFactor}</p>}
            </article>; })}
        </div>
      </section>
      <div className="rfq-no-print flex flex-wrap items-center gap-3">
        <button type="button" disabled={m.length >= MAX_MANUFACTURERS} title={m.length >= MAX_MANUFACTURERS ? b.maxManufacturers(MAX_MANUFACTURERS) : undefined} onClick={() => set({ manufacturers: [...m, { id: newId("m"), name: b.defaultManufacturer(m.length + 1) }] })} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{ backgroundColor: green }}><Plus className="h-3.5 w-3.5" /> {b.addManufacturer}</button>
        <span className="text-[11px] text-slate-500">{b.legend}</span>
      </div>
      <div className="rfq-scroll overflow-x-auto rounded-lg border border-slate-200">
        <table>
          <thead>
            <tr>
              <th rowSpan={2} className="bom-c1 align-middle">{b.line}</th>
              {m.map((item, index) => <th key={item.id} colSpan={COLUMNS.length} className="bom-m-start">
                <div className="flex items-center gap-1">
                  <input aria-label={b.manufacturerN(index + 1)} title={item.name} placeholder={b.manufacturerName} className="bom-head-input w-full min-w-0 rounded px-1.5 py-1 text-xs font-semibold" maxLength={120} value={item.name} onChange={e => set({ manufacturers: m.map(entry => entry.id === item.id ? { ...entry, name: e.target.value, renamedAt: Date.now() } : entry) })} /><Printed text={item.name} />
                  <button type="button" aria-label={b.removeManufacturer(item.name)} disabled={m.length <= MIN_MANUFACTURERS} className="rfq-no-print shrink-0 rounded p-1 text-white/80 hover:bg-white/10 disabled:opacity-30" onClick={() => { if (window.confirm(b.removeManufacturerConfirm(item.name))) removeManufacturer(item.id); }}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </th>)}
            </tr>
            <tr>{m.map(item => COLUMNS.map((column, index) => <th key={`${item.id}-${column}`} title={column === "sensitivity" ? b.sensitivityHelp : undefined} className={`${index === 0 ? "bom-m-start" : ""} ${["share", "cost", "sensitivity"].includes(column) ? "text-right" : ""}`}>{b.columns[column]}</th>))}</tr>
          </thead>
          <tbody>
            {BOM_GROUPS.map((group, index) => <Rows key={group}>
              {groupHeader(`${index + 1}) ${b.groups[group]}`)}
              {lineRows(group)}
              <tr className="rfq-no-print bg-white"><td colSpan={columns}><button type="button" className="bom-sticky-inline items-center gap-1 text-xs font-semibold" style={{ color: green }} onClick={() => set({ lines: [...sheet.lines, createBomLine(group, b.newLine)] })}><Plus className="h-3.5 w-3.5" /> {b.addLine}</button></td></tr>
              {group === "formulation" && recipeRow}
              {totalRow(b.subtotal(b.groups[group]), result => result.subtotals[group])}
            </Rows>)}
            {totalRow(b.total, result => result.total, true)}
          </tbody>
        </table>
      </div>
    </fieldset>
  </section>;
}

function Rows({ children }: { children: ReactNode }) { return <>{children}</>; }
