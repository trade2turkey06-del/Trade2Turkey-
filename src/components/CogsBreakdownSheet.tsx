import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRightLeft, Download, Link2, Paperclip, Plus, Printer, Trash2, TriangleAlert } from "lucide-react";
import { useI18n } from "../i18n";
import CostBars from "./CostBars";
import { downloadCsv, printSheet, sheetPrintCss } from "../lib/sheetExport";
import { MAX_MANUFACTURERS, MIN_MANUFACTURERS, newId, type RfqMatrix } from "../domain/rfqMatrix";
import {
  analyseAll, BASES, cogsCsv, createCogsManufacturer, createCogsSheet, createLine, CURRENCIES, GROUPS, INCOTERMS, lowestIds, openBookOf, parseAmount,
  reconcileCogs, shareOfExw, summary, type CogsAnalysis, type CogsLine, type CogsManufacturer, type CogsSheet, type Currency, type GroupId, type ShortlistEntry,
} from "../domain/cogsBreakdown";

const green = "#2f5d50";
const field = "rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-900 disabled:bg-transparent disabled:border-transparent";
const cellInput = `${field} w-full`;
// Validated categorical order (dataviz palette slots 1–5): raw materials, packaging, conversion, waste, margin.
const segmentColors: Record<string, string> = { rm: "#2a78d6", pkg: "#eb6834", conv: "#1baf7a", waste: "#eda100", margin: "#e87ba4" };
const css = `${sheetPrintCss("cogs-sheet", "cogs-printing")}
#cogs-sheet table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
#cogs-sheet th, #cogs-sheet td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
#cogs-sheet th { text-align: left; }
#cogs-sheet thead th { background: ${green}; color: #fff; font-weight: 600; border-bottom: 1px solid #24493f; vertical-align: middle; }
#cogs-sheet thead tr + tr th { color: #d5e8df; font-weight: 500; font-size: 11px; padding-top: 2px; }
#cogs-sheet input, #cogs-sheet select { min-height: 0; border-radius: 4px; line-height: 1.35; }
#cogs-sheet .cogs-c1 { position: sticky; left: 0; z-index: 1; width: 220px; min-width: 220px; max-width: 220px; box-shadow: inset -1px 0 #cbd5e1; }
#cogs-sheet thead .cogs-c1 { z-index: 3; }
@media (max-width: 640px) { #cogs-sheet .cogs-c1 { width: 140px; min-width: 140px; max-width: 140px; } }
#cogs-sheet .cogs-m-start { border-left: 1px solid #cbd5e1; }
#cogs-sheet thead .cogs-m-start { border-left-color: rgba(255,255,255,.3); }
#cogs-sheet .cogs-value { width: 112px; min-width: 112px; }
#cogs-sheet .cogs-share { width: 64px; min-width: 64px; text-align: right; }
#cogs-sheet .text-right { text-align: right; }
#cogs-sheet .cogs-head-input { background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.55); color: #fff; }
#cogs-sheet .cogs-head-input::placeholder { color: rgba(255,255,255,.7); }
#cogs-sheet .cogs-head-input:disabled { border-color: transparent; background: transparent; }
#cogs-sheet .cogs-sticky-inline { position: sticky; left: 6px; display: inline-flex; }`;
const Printed = ({ text, className = "" }: { text: ReactNode; className?: string }) => <span className={`rfq-print-text ${className}`}>{text}</span>;
const lowestCell = "bg-emerald-50 font-semibold text-emerald-800";

// rfq: saved A.B.6 matrix — manufacturers are shared with it and with the A.A.5 shortlist (matched by id).
export default function CogsBreakdownSheet({ sheet: stored, onChange, disabled, isAdmin, shortlist, rfq, onSend, onOpenDocuments }: {
  sheet?: CogsSheet; onChange: (sheet: CogsSheet) => void; disabled: boolean; isAdmin: boolean; shortlist: ShortlistEntry[]; rfq?: RfqMatrix;
  onSend?: (sheet: CogsSheet) => void; onOpenDocuments?: () => void;
}) {
  const { t, fmt } = useI18n();
  const c = t.cogs;
  const [fallback] = useState(() => createCogsSheet(c.defaults));
  // The shared manufacturer list is derived on every render, so the sheet is right even before the draft holds it.
  const shortlistKey = JSON.stringify(shortlist);
  const sheet = useMemo(() => disabled && stored ? stored : reconcileCogs(stored ?? fallback, shortlist, rfq, c.defaultManufacturer), [stored, fallback, rfq, shortlistKey, disabled]);
  // No dependency list on purpose: TaskEditor may reset its draft to the stored record after this ran, so it re-checks
  // after every render. Reconciliation is idempotent, so this stops once the draft holds the reconciled sheet.
  useEffect(() => { if (!disabled && sheet !== stored) onChange(sheet); });

  const m = sheet.manufacturers, results = analyseAll(sheet), overview = summary(sheet), columns = 1 + m.length * 2;
  const money = (value: number | null) => value === null ? "–" : fmt.currency(value, sheet.baseCurrency, 2);
  const pct = (value: number | null) => value === null ? "" : fmt.percent(value, 1, 1);
  const nameOf = (id: string) => m.find(item => item.id === id)?.name || "–";
  const unitLabel = c.basisShort[sheet.compareBasis];
  const usedCurrencies = CURRENCIES.filter(currency => currency !== sheet.baseCurrency && m.some(item => item.currency === currency));

  const set = (patch: Partial<CogsSheet>) => onChange({ ...sheet, ...patch });
  const setManufacturer = (id: string, patch: Partial<CogsManufacturer>) => set({ manufacturers: m.map(item => item.id === id ? { ...item, ...patch } : item) });
  const setLine = (id: string, patch: (line: CogsLine) => Partial<CogsLine>) => set({ lines: sheet.lines.map(line => line.id === id ? { ...line, ...patch(line) } : line) });
  const setValue = (line: CogsLine, id: string, value: string) => setLine(line.id, current => ({ values: { ...current.values, [id]: value } }));
  const addManufacturer = () => set({ manufacturers: [...m, createCogsManufacturer(newId("m"), c.defaultManufacturer(m.length + 1))] });
  const removeManufacturer = (id: string) => set({
    manufacturers: m.filter(item => item.id !== id), removedIds: [...(sheet.removedIds ?? []).filter(item => item !== id), id].slice(-50),
    lines: sheet.lines.map(line => { const { [id]: _value, ...values } = line.values; return { ...line, values }; }),
  });
  const exportCsv = () => downloadCsv("cogs-breakdown", sheet.brief, cogsCsv(sheet, shortlist));

  // Lowest of a row across manufacturers, compared in base currency per comparison basis.
  const lowest = (pick: (result: CogsAnalysis) => number | null) => lowestIds(Object.fromEntries(m.map(item => [item.id, pick(results[item.id])])));
  const amountInput = (label: string, value: string, onValue: (value: string) => void, extra = "") => {
    const invalid = !!value.trim() && parseAmount(value) === null;
    return <><input aria-label={label} inputMode="decimal" maxLength={40} className={`${cellInput} text-right tabular-nums ${invalid ? "border-red-500" : ""} ${extra}`} value={value} onChange={e => onValue(e.target.value)} /><Printed className="text-right" text={value} /></>;
  };
  const statusRow = (label: string, cell: (item: CogsManufacturer) => ReactNode) => <tr className="odd:bg-white even:bg-slate-50">
    <th scope="row" className="cogs-c1 bg-inherit font-medium text-slate-700">{label}</th>
    {m.map(item => <td key={item.id} colSpan={2} className="cogs-m-start">{cell(item)}</td>)}
  </tr>;
  const select = <T extends string>(label: string, value: T, options: readonly T[], onValue: (value: T) => void, text: (value: T) => string = value => value) => <><select aria-label={label} className={cellInput} value={value} onChange={e => onValue(e.target.value as T)}>{options.map(option => <option key={option} value={option}>{text(option)}</option>)}</select><Printed text={text(value)} /></>;
  const groupHeader = (title: string) => <tr style={{ backgroundColor: "#e3eee9" }}><td colSpan={columns}><span className="cogs-sticky-inline text-sm font-bold" style={{ color: green }}>{title}</span></td></tr>;
  // Calculated row: one formatted amount per manufacturer, lowest highlighted.
  const computedRow = (label: ReactNode, pick: (result: CogsAnalysis) => number | null, share?: (result: CogsAnalysis) => number | null, strong = false) => {
    const best = lowest(pick);
    return <tr className={strong ? "bg-emerald-50/40 font-semibold" : "bg-slate-100 font-semibold"}>
      <th scope="row" className="cogs-c1 bg-inherit">{label}</th>
      {m.map(item => [
        <td key={`${item.id}-v`} className={`cogs-m-start text-right tabular-nums ${best.includes(item.id) ? lowestCell : ""}`}>{money(pick(results[item.id]))}</td>,
        <td key={`${item.id}-s`} className="cogs-share tabular-nums text-slate-600">{share ? pct(share(results[item.id])) : ""}</td>,
      ])}
    </tr>;
  };
  const lineRows = (group: GroupId) => sheet.lines.filter(line => line.group === group).map(line => {
    const best = lowest(result => result.lines[line.id]);
    return <tr key={line.id} className="odd:bg-white even:bg-slate-50">
      <th scope="row" className="cogs-c1 bg-inherit font-normal"><div className="flex items-center gap-1">
        <input aria-label={c.lineName} className={`${cellInput} font-medium`} maxLength={120} value={line.label} onChange={e => setLine(line.id, () => ({ label: e.target.value }))} /><Printed className="font-medium" text={line.label} />
        {line.rfqKey && <span title={c.linkedToRfq} className="shrink-0 text-sky-700"><Link2 className="h-3.5 w-3.5" aria-label={c.linkedToRfq} /></span>}
        <button type="button" aria-label={c.deleteLine(line.label)} className="rfq-no-print shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700" onClick={() => { if (window.confirm(c.deleteLineConfirm(line.label || c.newLine))) set({ lines: sheet.lines.filter(item => item.id !== line.id) }); }}><Trash2 className="h-3.5 w-3.5" /></button>
      </div></th>
      {m.map(item => [
        <td key={`${item.id}-v`} className={`cogs-m-start cogs-value ${best.includes(item.id) ? lowestCell : ""}`}>{amountInput(`${item.name} ${line.label}`, line.values[item.id] ?? "", value => setValue(line, item.id, value))}</td>,
        <td key={`${item.id}-s`} className="cogs-share tabular-nums text-slate-500">{pct(shareOfExw(results[item.id].lines[line.id], results[item.id]))}</td>,
      ])}
    </tr>;
  });
  const percentRow = (label: string, key: "wastePct" | "marginPct", pick: (result: CogsAnalysis) => number | null) => <tr className="odd:bg-white even:bg-slate-50">
    <th scope="row" className="cogs-c1 bg-inherit font-medium">{label}</th>
    {m.map(item => [
      <td key={`${item.id}-v`} className="cogs-m-start cogs-value">{amountInput(`${item.name} ${label}`, item[key], value => setManufacturer(item.id, { [key]: value }))}<span className="mt-0.5 block text-right text-[10px] text-slate-500 tabular-nums">{pick(results[item.id]) === null ? "" : money(pick(results[item.id]))}</span></td>,
      <td key={`${item.id}-s`} className="cogs-share tabular-nums text-slate-500">{pct(shareOfExw(pick(results[item.id]), results[item.id]))}</td>,
    ])}
  </tr>;
  const manufacturerInputRow = (label: string, key: "quotedExw" | "freightPerCarton" | "insurancePerCarton" | "exportDocsPerCarton", normalised?: (result: CogsAnalysis) => number | null) => {
    const best = normalised ? lowest(normalised) : [];
    return <tr className="odd:bg-white even:bg-slate-50">
      <th scope="row" className="cogs-c1 bg-inherit font-medium">{label}</th>
      {m.map(item => [
        <td key={`${item.id}-v`} className={`cogs-m-start cogs-value ${best.includes(item.id) ? lowestCell : ""}`}>{amountInput(`${item.name} ${label}`, item[key], value => setManufacturer(item.id, { [key]: value }))}</td>,
        <td key={`${item.id}-s`} className="cogs-share tabular-nums text-slate-600">{normalised ? money(normalised(results[item.id])) : item.currency}</td>,
      ])}
    </tr>;
  };

  return <section id="cogs-sheet" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <style>{css}</style>
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="mr-auto font-semibold" style={{ color: green }}>{c.title}</h4>
      <div className="rfq-no-print flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => printSheet("cogs-printing")} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Printer className="h-3.5 w-3.5" /> {c.print}</button>
        <button type="button" onClick={exportCsv} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"><Download className="h-3.5 w-3.5" /> {c.exportCsv}</button>
        {isAdmin && onSend && <button type="button" disabled={disabled} title={c.sendHelp} onClick={() => { if (window.confirm(c.sendConfirm)) onSend(sheet); }} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{ backgroundColor: green }}><ArrowRightLeft className="h-3.5 w-3.5" /> {c.sendToRfq}</button>}
      </div>
    </div>
    <p className="rfq-no-print text-xs text-slate-600">{c.help}</p>
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs text-slate-600 sm:col-span-2">{c.brief}<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:bg-slate-50" maxLength={300} placeholder={c.briefPlaceholder} value={sheet.brief} onChange={e => set({ brief: e.target.value })} /><Printed className="mt-1 text-sm font-semibold text-slate-900" text={sheet.brief} /></label>
        <label className="block text-xs text-slate-600">{c.baseCurrency}<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900" value={sheet.baseCurrency} onChange={e => set({ baseCurrency: e.target.value as Currency })}>{CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select><Printed text={sheet.baseCurrency} /></label>
        <label className="block text-xs text-slate-600">{c.compareBasis}<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900" value={sheet.compareBasis} onChange={e => set({ compareBasis: e.target.value as CogsSheet["compareBasis"] })}>{BASES.map(basis => <option key={basis} value={basis}>{c.bases[basis]}</option>)}</select><Printed text={c.bases[sheet.compareBasis]} /></label>
        {usedCurrencies.map(currency => <label key={currency} className="block text-xs text-slate-600">{c.rate(currency, sheet.baseCurrency)}<input inputMode="decimal" maxLength={20} className={`mt-1 w-full rounded-lg border bg-white p-2 text-sm text-slate-900 ${sheet.rates[currency] && parseAmount(sheet.rates[currency]) ? "border-slate-300" : "border-amber-400"}`} value={sheet.rates[currency] ?? ""} onChange={e => set({ rates: { ...sheet.rates, [currency]: e.target.value } })} />{!parseAmount(sheet.rates[currency]) && <span className="mt-0.5 block text-[10px] text-amber-700">{c.rateMissing(currency)}</span>}<Printed text={sheet.rates[currency] ?? ""} /></label>)}
      </div>
      <div className="rfq-no-print flex flex-wrap items-center gap-3">
        <button type="button" disabled={m.length >= MAX_MANUFACTURERS} title={m.length >= MAX_MANUFACTURERS ? c.maxManufacturers(MAX_MANUFACTURERS) : undefined} onClick={addManufacturer} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{ backgroundColor: green }}><Plus className="h-3.5 w-3.5" /> {c.addManufacturer}</button>
        <label className="flex items-center gap-1.5 text-xs text-slate-700"><input type="checkbox" checked={sheet.showLogistics} onChange={e => set({ showLogistics: e.target.checked })} /> {c.showLogistics}</label>
        <span className="text-[11px] text-slate-500">{c.valuesIn(sheet.baseCurrency, unitLabel)}</span>
      </div>
      <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs sm:grid-cols-3" aria-label={c.summary}>
        <p><span className="block text-slate-500">{c.lowestCalculated}</span><strong className="tabular-nums">{overview.lowestCalculated ? `${nameOf(overview.lowestCalculated.id)} · ${money(overview.lowestCalculated.value)}` : "–"}</strong></p>
        <p><span className="block text-slate-500">{c.lowestLanded}</span><strong className="tabular-nums">{overview.lowestLanded ? `${nameOf(overview.lowestLanded.id)} · ${money(overview.lowestLanded.value)}` : "–"}</strong></p>
        <p><span className="block text-slate-500">{c.summary}</span><strong>{c.receivedCount(overview.received, overview.total)}</strong></p>
      </div>
      <CostBars title={c.chartTitle} empty={c.chartEmpty} money={money} pct={pct} legend={Object.keys(segmentColors).map(key => ({ key, label: c.segments[key], color: segmentColors[key] }))}
        rows={m.map(item => { const r = results[item.id]; return { id: item.id, name: item.name, total: r.calculated, segments: r.base === null ? [] : [{ key: "rm", value: r.subtotals.rm }, { key: "pkg", value: r.subtotals.pkg }, { key: "conv", value: r.subtotals.conv }, { key: "waste", value: r.waste ?? 0 }, { key: "margin", value: r.margin ?? 0 }] }; })} />
      <div className="rfq-scroll overflow-x-auto rounded-lg border border-slate-200">
        <table>
          <thead>
            <tr>
              <th rowSpan={2} className="cogs-c1 align-middle">{c.line}</th>
              {m.map((item, index) => <th key={item.id} colSpan={2} className="cogs-m-start">
                <div className="flex items-center gap-1">
                  <input aria-label={c.manufacturerN(index + 1)} title={item.name} placeholder={c.manufacturerName} className="cogs-head-input w-full min-w-0 rounded px-1.5 py-1 text-xs font-semibold" maxLength={120} value={item.name} onChange={e => setManufacturer(item.id, { name: e.target.value, renamedAt: Date.now() })} /><Printed text={item.name} />
                  <button type="button" aria-label={c.removeManufacturer(item.name)} disabled={m.length <= MIN_MANUFACTURERS} className="rfq-no-print shrink-0 rounded p-1 text-white/80 hover:bg-white/10 disabled:opacity-30" onClick={() => { if (window.confirm(c.removeManufacturerConfirm(item.name))) removeManufacturer(item.id); }}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </th>)}
            </tr>
            <tr>{m.map(item => [<th key={`${item.id}-v`} className="cogs-m-start">{c.entered}</th>, <th key={`${item.id}-s`} className="cogs-share">{c.share}</th>])}</tr>
          </thead>
          <tbody>
            {groupHeader(c.statusHeading)}
            {statusRow(c.requested, item => <><input type="date" aria-label={`${item.name} ${c.requested}`} className={cellInput} value={item.requestedDate} onChange={e => setManufacturer(item.id, { requestedDate: e.target.value })} /><Printed text={item.requestedDate ? fmt.date(item.requestedDate) : ""} /></>)}
            {statusRow(c.received, item => <><input type="date" aria-label={`${item.name} ${c.received}`} className={cellInput} value={item.receivedDate} onChange={e => setManufacturer(item.id, { receivedDate: e.target.value })} /><Printed text={item.receivedDate ? fmt.date(item.receivedDate) : ""} /></>)}
            {statusRow(c.openBook, item => <label className="flex items-center gap-1.5"><input type="checkbox" aria-label={`${item.name} ${c.openBook}`} checked={openBookOf(item, shortlist)} onChange={e => setManufacturer(item.id, { openBook: e.target.checked })} /><Printed className="inline" text={openBookOf(item, shortlist) ? c.yes : c.no} />{item.openBook === undefined && openBookOf(item, shortlist) && <span className="text-[10px] text-slate-500">{c.openBookFromShortlist}</span>}</label>)}
            {statusRow(c.sourceUrl, item => <div className="flex items-center gap-1"><input type="url" aria-label={`${item.name} ${c.sourceUrl}`} placeholder="https://" maxLength={2000} title={item.sourceUrl && !/^https:\/\/\S+$/.test(item.sourceUrl) ? c.sourceUrlInvalid : item.sourceUrl || undefined} className={`${cellInput} ${item.sourceUrl && !/^https:\/\/\S+$/.test(item.sourceUrl) ? "border-red-500" : ""}`} value={item.sourceUrl} onChange={e => setManufacturer(item.id, { sourceUrl: e.target.value.trim() })} /><Printed text={item.sourceUrl} />{onOpenDocuments && <button type="button" title={c.uploadArea} aria-label={c.uploadArea} onClick={onOpenDocuments} className="rfq-no-print shrink-0 rounded p-1 text-teal-700 hover:bg-teal-50"><Paperclip className="h-3.5 w-3.5" /></button>}</div>)}
            {statusRow(c.incoterm, item => select(`${item.name} ${c.incoterm}`, item.incoterm, INCOTERMS, value => setManufacturer(item.id, { incoterm: value })))}
            {statusRow(c.currency, item => select(`${item.name} ${c.currency}`, item.currency, CURRENCIES, value => setManufacturer(item.id, { currency: value })))}
            {statusRow(c.basis, item => select(`${item.name} ${c.basis}`, item.basis, BASES, value => setManufacturer(item.id, { basis: value }), value => c.bases[value]))}
            {statusRow(c.unitsPerCarton, item => amountInput(`${item.name} ${c.unitsPerCarton}`, item.unitsPerCarton, value => setManufacturer(item.id, { unitsPerCarton: value })))}
            {statusRow(c.unitWeight, item => amountInput(`${item.name} ${c.unitWeight}`, item.unitWeightG, value => setManufacturer(item.id, { unitWeightG: value })))}
            {GROUPS.map((group, index) => <Rows key={group}>
              {groupHeader(`${index + 1}) ${c.groups[group]}`)}
              {lineRows(group)}
              <tr className="rfq-no-print bg-white"><td colSpan={columns}><button type="button" className="cogs-sticky-inline items-center gap-1 text-xs font-semibold" style={{ color: green }} onClick={() => set({ lines: [...sheet.lines, createLine(group, c.newLine)] })}><Plus className="h-3.5 w-3.5" /> {c.addLine}</button></td></tr>
              {computedRow(c.subtotal(c.groups[group]), result => result.base === null ? null : result.subtotals[group], result => shareOfExw(result.base === null ? null : result.subtotals[group], result))}
            </Rows>)}
            {groupHeader(`4) ${c.waste} · 5) ${c.margin}`)}
            {percentRow(c.waste, "wastePct", result => result.waste)}
            {percentRow(c.margin, "marginPct", result => result.margin)}
            {computedRow(<span title={c.formula}>{c.calculated}<span className="block text-[10px] font-normal text-slate-500">{c.formula}</span></span>, result => result.calculated, undefined, true)}
            {manufacturerInputRow(c.quoted, "quotedExw", result => result.quoted)}
            <tr className="bg-white font-semibold">
              <th scope="row" className="cogs-c1 bg-white">{c.variance}</th>
              {m.map(item => { const result = results[item.id]; const tone = result.level === "alert" ? "bg-red-50 text-red-800" : result.level === "warn" ? "bg-amber-50 text-amber-900" : "";
                return <td key={item.id} colSpan={2} className={`cogs-m-start tabular-nums ${tone}`}>{result.variance === null ? "–" : <>{(result.variance > 0 ? "+" : "") + money(result.variance)} ({(result.variancePct ?? 0) > 0 ? "+" : ""}{pct(result.variancePct)}){result.level && result.level !== "ok" && <span className="mt-0.5 flex items-center gap-1 text-[11px]"><TriangleAlert className="h-3.5 w-3.5" /> {c.mismatch}</span>}</>}
                  {result.missingFactor && <span className="mt-0.5 block text-[10px] font-normal text-amber-700">{c.missingFactor}</span>}</td>; })}
            </tr>
            {sheet.showLogistics && <Rows>
              {groupHeader(c.logisticsHeading)}
              {manufacturerInputRow(c.freight, "freightPerCarton")}
              {manufacturerInputRow(c.insurance, "insurancePerCarton")}
              {manufacturerInputRow(c.exportDocs, "exportDocsPerCarton")}
              {computedRow(c.logisticsCost, result => result.logistics)}
              {computedRow(c.landed, result => result.landed, undefined, true)}
            </Rows>}
          </tbody>
        </table>
      </div>
    </fieldset>
  </section>;
}

function Rows({ children }: { children: ReactNode }) { return <>{children}</>; }
