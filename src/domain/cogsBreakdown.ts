// COGS breakdown sheet (A.B.5): open-book cost model per manufacturer, its reconciliation with the quoted EXW price and
// the hand-over to the RFQ comparison matrix (A.B.6). Pure functions only — no network calls.
// Line labels are user data (written in the UI language at creation time); everything stored here is language-neutral.
import { CodedError } from "../i18n/errors";
import { MAX_MANUFACTURERS, MIN_MANUFACTURERS, newId, suggestedScores, type Criterion, type Manufacturer, type RfqMatrix } from "./rfqMatrix";

export const CURRENCIES = ["EUR", "USD", "GBP", "TRY"] as const;
export const BASES = ["unit", "kg", "carton"] as const;
export const INCOTERMS = ["EXW", "FCA", "FOB"] as const;
export const GROUPS = ["rm", "pkg", "conv"] as const;
export type Currency = typeof CURRENCIES[number];
export type CostBasis = typeof BASES[number];
export type Incoterm = typeof INCOTERMS[number];
export type GroupId = typeof GROUPS[number];
// COGS lines that feed a fixed criterion of RFQ item 1 (see offerCriteria in rfqMatrix.ts).
export const RFQ_LINE_KEYS = ["primary", "secondary", "component1", "component2", "component3", "component4", "component5"] as const;
export type RfqLineKey = typeof RFQ_LINE_KEYS[number];
export type CogsLink = "unitPrice" | "logistics" | RfqLineKey;

export interface CogsLine { id: string; group: GroupId; label: string; rfqKey?: RfqLineKey; values: Record<string, string> }
export interface CogsManufacturer {
  id: string; name: string;
  // Set when the name is edited in this sheet; the newer name wins when A.B.5 and A.B.6 are reconciled.
  renamedAt?: number;
  requestedDate: string; receivedDate: string;
  // Missing = not decided in A.B.5 yet; the A.A.5 "Open-book COGS agreed" tick is shown instead.
  openBook?: boolean;
  sourceUrl: string; incoterm: Incoterm;
  // Currency and basis the manufacturer quoted in; values are converted to the sheet's base currency and comparison basis.
  currency: Currency; basis: CostBasis; unitsPerCarton: string; unitWeightG: string;
  wastePct: string; marginPct: string; quotedExw: string;
  freightPerCarton: string; insurancePerCarton: string; exportDocsPerCarton: string;
}
export interface CogsSheet {
  brief: string; baseCurrency: Currency;
  // 1 unit of the currency = rate × base currency.
  rates: Partial<Record<Currency, string>>;
  compareBasis: CostBasis; showLogistics: boolean;
  manufacturers: CogsManufacturer[]; lines: CogsLine[];
  // Manufacturers removed here; reconciliation does not bring them back from the shortlist or the RFQ matrix.
  removedIds?: string[];
}
export interface ShortlistEntry { id: string; name: string; openBookAgreed?: boolean }
export interface LineLabels { primary: string; secondary: string; component: (n: number) => string; pkg: string[]; conv: string[] }

export const createCogsManufacturer = (id: string, name: string): CogsManufacturer => ({
  id, name, requestedDate: "", receivedDate: "", sourceUrl: "", incoterm: "EXW", currency: "EUR", basis: "unit", unitsPerCarton: "", unitWeightG: "",
  wastePct: "", marginPct: "", quotedExw: "", freightPerCarton: "", insurancePerCarton: "", exportDocsPerCarton: "",
});
export const createLine = (group: GroupId, label: string, rfqKey?: RfqLineKey): CogsLine => ({ id: newId("l"), group, label, ...(rfqKey ? { rfqKey } : {}), values: {} });
export function createCogsSheet(labels: LineLabels, brief = ""): CogsSheet {
  return {
    brief, baseCurrency: "EUR", rates: {}, compareBasis: "unit", showLogistics: false, manufacturers: [],
    lines: [
      createLine("rm", labels.primary, "primary"), createLine("rm", labels.secondary, "secondary"),
      ...[1, 2, 3, 4, 5].map(n => createLine("rm", labels.component(n), `component${n}` as RfqLineKey)),
      ...labels.pkg.map(label => createLine("pkg", label)), ...labels.conv.map(label => createLine("conv", label)),
    ],
  };
}

// Cost amounts: "0,45" and "0.45" are decimals; a separator repeated ("1.250.000") or both kinds ("1.250,50") mark thousands.
export function parseAmount(value: string | undefined) {
  const text = (value ?? "").replace(/[\s€$£₺]/g, "").replace(/(EUR|USD|GBP|TRY|TL)$/i, "");
  if (!/^-?\d[\d.,]*$/.test(text)) return null;
  let digits = text;
  const dots = (text.match(/\./g) ?? []).length, commas = (text.match(/,/g) ?? []).length;
  if (dots && commas) { const decimal = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : "."; digits = text.split(decimal === "," ? "." : ",").join("").replace(",", "."); }
  else if (commas > 1 || dots > 1) digits = text.replace(/[.,]/g, "");
  else digits = text.replace(",", ".");
  const number = Number(digits);
  return Number.isFinite(number) ? number : null;
}
const positive = (value: string | undefined) => { const number = parseAmount(value); return number !== null && number > 0 ? number : null; };

export function rateOf(sheet: CogsSheet, currency: Currency) { return currency === sheet.baseCurrency ? 1 : positive(sheet.rates[currency]); }
// Converts an amount between per-unit, per-kg and per-carton; null when the conversion factor is missing.
export function convertBasis(value: number, from: CostBasis, to: CostBasis, m: CogsManufacturer) {
  if (from === to) return value;
  const kg = (positive(m.unitWeightG) ?? NaN) / 1000, carton = positive(m.unitsPerCarton) ?? NaN;
  const perUnit = from === "unit" ? value : from === "kg" ? value * kg : value / carton;
  const result = to === "unit" ? perUnit : to === "kg" ? perUnit / kg : perUnit * carton;
  return Number.isFinite(result) ? result : null;
}
// Raw amount in the manufacturer's currency and basis → base currency per comparison basis.
export function normalise(sheet: CogsSheet, m: CogsManufacturer, raw: string | undefined, from: CostBasis = m.basis) {
  const value = parseAmount(raw), rate = rateOf(sheet, m.currency);
  if (value === null) return null;
  if (rate === null) return null;
  return convertBasis(value * rate, from, sheet.compareBasis, m);
}

export type VarianceLevel = "ok" | "warn" | "alert";
export interface CogsAnalysis {
  lines: Record<string, number | null>; subtotals: Record<GroupId, number>; base: number | null;
  waste: number | null; margin: number | null; calculated: number | null; quoted: number | null;
  variance: number | null; variancePct: number | null; level: VarianceLevel | null;
  // In base currency: per comparison basis, and per carton for the RFQ "Logistics Unit Price per Box" row.
  logistics: number | null; logisticsPerCarton: number | null; landed: number | null;
  // A value was entered but could not be converted (exchange rate, units per carton or net weight missing).
  missingFactor: boolean; hasData: boolean;
}
const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0);
export const varianceLevel = (pct: number | null): VarianceLevel | null => pct === null ? null : Math.abs(pct) > 10 ? "alert" : Math.abs(pct) > 5 ? "warn" : "ok";

export function analyse(sheet: CogsSheet, m: CogsManufacturer): CogsAnalysis {
  let missingFactor = false;
  const value = (raw: string | undefined, from?: CostBasis) => { const result = normalise(sheet, m, raw, from); if (result === null && parseAmount(raw) !== null) missingFactor = true; return result; };
  const lines = Object.fromEntries(sheet.lines.map(line => [line.id, value(line.values[m.id])]));
  const subtotals = Object.fromEntries(GROUPS.map(group => [group, sum(sheet.lines.filter(line => line.group === group).map(line => lines[line.id]))])) as Record<GroupId, number>;
  const entered = sheet.lines.some(line => lines[line.id] !== null);
  const base = entered ? subtotals.rm + subtotals.pkg + subtotals.conv : null;
  const wastePct = parseAmount(m.wastePct) ?? 0, marginPct = parseAmount(m.marginPct) ?? 0;
  const waste = base === null ? null : base * wastePct / 100;
  const margin = base === null ? null : base * (1 + wastePct / 100) * marginPct / 100;
  const calculated = base === null ? null : base * (1 + wastePct / 100) * (1 + marginPct / 100);
  const quoted = value(m.quotedExw);
  const variance = quoted !== null && calculated !== null ? quoted - calculated : null;
  const variancePct = variance !== null && calculated ? variance / calculated * 100 : null;
  const perCartonRaw = [m.freightPerCarton, m.insurancePerCarton, m.exportDocsPerCarton].map(parseAmount);
  const rate = rateOf(sheet, m.currency);
  const logisticsPerCarton = perCartonRaw.some(item => item !== null) && rate !== null ? sum(perCartonRaw) * rate : null;
  const logistics = logisticsPerCarton === null ? null : convertBasis(logisticsPerCarton, "carton", sheet.compareBasis, m);
  if (perCartonRaw.some(item => item !== null) && logistics === null) missingFactor = true;
  const landed = quoted !== null && logistics !== null ? quoted + logistics : null;
  return { lines, subtotals, base, waste, margin, calculated, quoted, variance, variancePct, level: varianceLevel(variancePct), logistics, logisticsPerCarton, landed, missingFactor, hasData: entered || quoted !== null };
}
export const analyseAll = (sheet: CogsSheet) => Object.fromEntries(sheet.manufacturers.map(m => [m.id, analyse(sheet, m)])) as Record<string, CogsAnalysis>;
// Share of the calculated EXW cost (in %).
export const shareOfExw = (value: number | null, analysis: CogsAnalysis) => value === null || !analysis.calculated ? null : value / analysis.calculated * 100;
// Ids holding the lowest value of a row (ties all highlighted); needs at least two values.
export function lowestIds(values: Record<string, number | null>) {
  const entries = Object.entries(values).filter((entry): entry is [string, number] => entry[1] !== null);
  if (entries.length < 2) return [];
  const min = Math.min(...entries.map(([, value]) => value));
  return entries.filter(([, value]) => Math.abs(value - min) < 1e-9).map(([id]) => id);
}
export const openBookOf = (m: CogsManufacturer, shortlist: ShortlistEntry[]) => m.openBook ?? !!shortlist.find(entry => entry.id === m.id)?.openBookAgreed;
export const hasCogsData = (sheet?: CogsSheet | null) => !!sheet && sheet.manufacturers.some(m => analyse(sheet, m).hasData);

export function summary(sheet: CogsSheet) {
  const results = analyseAll(sheet);
  const best = (key: "calculated" | "landed") => {
    const ids = lowestIds(Object.fromEntries(sheet.manufacturers.map(m => [m.id, results[m.id][key]])));
    const id = ids[0] ?? sheet.manufacturers.find(m => results[m.id][key] !== null)?.id;
    return id ? { id, value: results[id][key]! } : null;
  };
  return { lowestCalculated: best("calculated"), lowestLanded: best("landed"), received: sheet.manufacturers.filter(m => m.receivedDate).length, total: sheet.manufacturers.length };
}
// Manufacturers still missing a received date, the open-book confirmation or the quoted EXW price.
export function incompleteManufacturers(sheet: CogsSheet, shortlist: ShortlistEntry[]) {
  return sheet.manufacturers.filter(m => !m.receivedDate || !openBookOf(m, shortlist) || parseAmount(m.quotedExw) === null);
}
export function validateCogs(sheet: CogsSheet) {
  if (sheet.manufacturers.length > MAX_MANUFACTURERS) throw new CodedError("matrixManufacturers", { min: String(MIN_MANUFACTURERS), max: String(MAX_MANUFACTURERS) });
  if (sheet.manufacturers.some(m => !m.name.trim())) throw new CodedError("matrixNames");
  if (sheet.manufacturers.some(m => m.sourceUrl && !/^https:\/\/\S+$/.test(m.sourceUrl))) throw new CodedError("cogsSourceUrl");
}

// ---- Shared manufacturer list (A.A.5 shortlist → A.B.5 ⇄ A.B.6) ----
export interface RosterMember { id: string; name: string; renamedAt?: number }
const normal = (name: string) => name.trim().toLocaleLowerCase("tr");
// Default names such as "Manufacturer 2" / "Üretici 2" (or empty) mark a placeholder column.
export const isPlaceholderName = (name: string) => !name.trim() || /^(manufacturer|üretici)\s*\d+$/i.test(name.trim());
// Works out one sheet's manufacturer list: the A.A.5 shortlist and the other sheet are the shared sources, matched by id
// (or by name for older records). Nothing in this sheet is dropped; empty placeholder columns are taken over first.
export function planRoster(own: RosterMember[], shortlist: { id: string; name: string }[], other: RosterMember[], removed: string[], isBlank: (id: string) => boolean, placeholder: (n: number) => string) {
  const candidates = new Map<string, RosterMember>();
  for (const entry of shortlist) if (entry.name.trim()) candidates.set(entry.id, { id: entry.id, name: entry.name, renamedAt: 0 });
  for (const entry of other) {
    const known = candidates.get(entry.id);
    if (!known) candidates.set(entry.id, { ...entry });
    else if ((entry.renamedAt ?? 0) > (known.renamedAt ?? 0)) candidates.set(entry.id, { ...known, name: entry.name, renamedAt: entry.renamedAt });
  }
  for (const id of removed) candidates.delete(id);
  const rekey: Record<string, string> = {}, used = new Set<string>();
  const members: RosterMember[] = own.map(entry => {
    let match = candidates.get(entry.id);
    if (!match) match = [...candidates.values()].find(item => !used.has(item.id) && !own.some(o => o.id === item.id) && normal(item.name) === normal(entry.name) && entry.name.trim());
    if (!match) return { ...entry };
    used.add(match.id);
    if (match.id !== entry.id) rekey[entry.id] = match.id;
    const ownWins = (entry.renamedAt ?? 0) > 0 && (entry.renamedAt ?? 0) >= (match.renamedAt ?? 0);
    return ownWins ? { ...entry, id: match.id } : { id: match.id, name: match.name, ...(match.renamedAt ? { renamedAt: match.renamedAt } : {}) };
  });
  const missing = [...candidates.values()].filter(item => !used.has(item.id));
  // Real names first, so they take the free placeholder columns; the other sheet's placeholders only fill empty columns
  // (keeping ids aligned) and are never appended.
  for (const item of [...missing.filter(entry => !isPlaceholderName(entry.name)), ...missing.filter(entry => isPlaceholderName(entry.name))]) {
    const slot = members.findIndex(entry => !used.has(entry.id) && isPlaceholderName(entry.name) && isBlank(entry.id));
    const next = { id: item.id, name: item.name, ...(item.renamedAt ? { renamedAt: item.renamedAt } : {}) };
    if (slot >= 0) { rekey[members[slot].id] = item.id; members[slot] = next; used.add(item.id); }
    else if (!isPlaceholderName(item.name) && members.length < MAX_MANUFACTURERS) { members.push(next); used.add(item.id); }
  }
  while (members.length < MIN_MANUFACTURERS) members.push({ id: newId("m"), name: placeholder(members.length + 1) });
  return { members, rekey };
}
const rekeyRecord = <T,>(record: Record<string, T>, rekey: Record<string, string>) => Object.fromEntries(Object.entries(record).map(([key, value]) => [rekey[key] ?? key, value]));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function reconcileCogs(sheet: CogsSheet, shortlist: ShortlistEntry[], rfq: RfqMatrix | undefined, placeholder: (n: number) => string): CogsSheet {
  const blank = (id: string) => { const m = sheet.manufacturers.find(item => item.id === id); return !!m && !analyse(sheet, m).hasData && !m.requestedDate && !m.receivedDate; };
  const { members, rekey } = planRoster(sheet.manufacturers, shortlist, rfq && !rfq.isDemo ? rfq.manufacturers : [], sheet.removedIds ?? [], blank, placeholder);
  const byId = new Map(sheet.manufacturers.map(m => [rekey[m.id] ?? m.id, m]));
  const manufacturers = members.map(member => {
    const previous = byId.get(member.id), base = previous ? { ...previous, id: member.id } : createCogsManufacturer(member.id, member.name);
    const { renamedAt: _r, ...rest } = base;
    return { ...rest, name: member.name, ...(member.renamedAt ? { renamedAt: member.renamedAt } : {}) };
  });
  const brief = sheet.brief || rfq?.brief || "";
  const next = { ...sheet, brief, manufacturers, lines: sheet.lines.map(line => ({ ...line, values: rekeyRecord(line.values, rekey) })) };
  return same(next, sheet) ? sheet : next;
}
export function reconcileMatrix(matrix: RfqMatrix, shortlist: ShortlistEntry[], cogs: CogsSheet | undefined, placeholder: (n: number) => string): RfqMatrix {
  if (matrix.isDemo) return matrix;
  const criteria = [...matrix.items.flatMap(item => item.criteria), ...matrix.sections.flatMap(section => section.criteria)];
  const blank = (id: string) => criteria.every(item => !item.values[id] && item.scores[id] === undefined) && matrix.items.every(item => !item.notes[id]);
  const { members, rekey } = planRoster(matrix.manufacturers, shortlist, cogs?.manufacturers ?? [], matrix.removedIds ?? [], blank, placeholder);
  const rekeyCriterion = (item: Criterion) => ({ ...item, values: rekeyRecord(item.values, rekey), scores: rekeyRecord(item.scores, rekey) });
  const next: RfqMatrix = {
    ...matrix, brief: matrix.brief || cogs?.brief || "", manufacturers: members.map(member => ({ id: member.id, name: member.name, ...(member.renamedAt ? { renamedAt: member.renamedAt } : {}) })),
    items: matrix.items.map(item => ({ ...item, notes: rekeyRecord(item.notes, rekey), criteria: item.criteria.map(rekeyCriterion) })),
    sections: matrix.sections.map(section => ({ ...section, criteria: section.criteria.map(rekeyCriterion) })),
  };
  return same(next, matrix) ? matrix : next;
}

// ---- Hand-over to the RFQ matrix ----
// Position of each linked criterion in the default offer item template (rfqMatrix.ts → offerCriteria).
const templateIndex: Record<Exclude<CogsLink, "logistics">, number> = { unitPrice: 0, primary: 2, secondary: 3, component1: 4, component2: 5, component3: 6, component4: 7, component5: 8 };
const money = (value: number) => value.toFixed(Math.abs(value) < 0.1 && value !== 0 ? 4 : 2);
// Language-neutral cell text, readable by parseNumber: "4.10 EUR", "3.85 EUR/kg".
export const cogsCellText = (value: number, sheet: CogsSheet, perBasis = true) => `${money(value)} ${sheet.baseCurrency}${perBasis && sheet.compareBasis !== "unit" ? `/${sheet.compareBasis}` : ""}`;
// Cells we may overwrite on an explicit send: empty or a plain amount; descriptive text typed in A.B.6 is kept.
const plainAmount = (text: string | undefined) => !text?.trim() || /^-?[\d.,]+\s*[A-Z]{3}(\/(unit|kg|carton))?$/.test(text.trim());

// Numbers A.B.5 provides for each linked RFQ row, in base currency, keyed by link then manufacturer id.
export function cogsFigures(sheet: CogsSheet) {
  const results = analyseAll(sheet), figures: Partial<Record<CogsLink, Record<string, number>>> = {};
  const put = (link: CogsLink, id: string, value: number | null) => { if (value !== null) (figures[link] ??= {})[id] = value; };
  for (const m of sheet.manufacturers) {
    const result = results[m.id];
    put("unitPrice", m.id, result.quoted);
    if (sheet.showLogistics) put("logistics", m.id, result.logisticsPerCarton);
    for (const line of sheet.lines) if (line.rfqKey) put(line.rfqKey, m.id, result.lines[line.id]);
  }
  return figures;
}
export const cellTextFor = (link: CogsLink, value: number, sheet: CogsSheet) => cogsCellText(value, sheet, link !== "logistics");
export function linkedCriterion(matrix: RfqMatrix, link: CogsLink): Criterion | undefined {
  if (link === "logistics") { const list = matrix.sections.find(section => section.id === "commercial")?.criteria ?? []; return list.find(item => item.cogsKey === link) ?? list.find(item => !item.cogsKey && item.kind === "logistics"); }
  const list = matrix.items[0]?.criteria ?? [];
  const candidate = list[templateIndex[link]];
  return list.find(item => item.cogsKey === link) ?? (candidate && !candidate.cogsKey && (link === "unitPrice" ? candidate.kind === "unitPrice" : !candidate.kind) ? candidate : undefined);
}
// Writes A.B.5 figures into the RFQ matrix. Automatic sync (overwrite=false) only fills empty cells; "Send to RFQ Matrix"
// also replaces earlier amounts but never descriptive text. Linked material rows take the COGS line names.
export function syncMatrixFromCogs(matrix: RfqMatrix, sheet: CogsSheet, overwrite: boolean): RfqMatrix {
  if (matrix.isDemo || !matrix.items.length) return matrix;
  const figures = cogsFigures(sheet), ids = new Set(matrix.manufacturers.map(m => m.id));
  const links: CogsLink[] = ["unitPrice", ...RFQ_LINE_KEYS, ...(sheet.showLogistics ? ["logistics" as const] : [])];
  const patches = new Map<string, Criterion>();
  for (const link of links) {
    const target = linkedCriterion(matrix, link);
    if (!target) continue;
    const line = sheet.lines.find(item => item.rfqKey === link);
    const values = { ...target.values };
    for (const [id, value] of Object.entries(figures[link] ?? {})) if (ids.has(id) && (overwrite ? plainAmount(values[id]) : !values[id]?.trim())) values[id] = cellTextFor(link, value, sheet);
    patches.set(target.id, { ...target, cogsKey: link, ...(line?.label.trim() ? { label: line.label } : {}), values });
  }
  const apply = (item: Criterion) => patches.get(item.id) ?? item;
  const next = { ...matrix, brief: matrix.brief || sheet.brief, items: matrix.items.map(item => ({ ...item, criteria: item.criteria.map(apply) })), sections: matrix.sections.map(section => ({ ...section, criteria: section.criteria.map(apply) })) };
  return same(next, matrix) ? matrix : next;
}
// True when the cell still shows the figure taken from A.B.5 (drives the "from COGS" tag).
export function fromCogs(criterion: Criterion, manufacturerId: string, sheet: CogsSheet | undefined, figures: ReturnType<typeof cogsFigures>) {
  if (!sheet || !criterion.cogsKey) return false;
  const value = figures[criterion.cogsKey as CogsLink]?.[manufacturerId];
  return value !== undefined && criterion.values[manufacturerId] === cellTextFor(criterion.cogsKey as CogsLink, value, sheet);
}
// Price rows scored from COGS: lowest cost = 5, others 5 × lowest / value (min 1). Needs at least two figures.
export function cogsScores(values: Record<string, number>) {
  const entries = Object.entries(values);
  if (entries.length < 2) return {};
  const min = Math.min(...entries.map(([, value]) => value));
  return Object.fromEntries(entries.map(([id, value]) => [id, value <= min ? 5 : Math.max(1, Math.round(5 * Math.max(min, 0) / value))])) as Record<string, number>;
}
export const varianceAlerts = (sheet: CogsSheet) => { const results = analyseAll(sheet); return sheet.manufacturers.filter(m => results[m.id].level === "alert").map(m => m.id); };
// Suggested scores of a linked row from A.B.5 figures; a red variance costs one Unit Price point (min 1). null = no COGS basis.
export function cogsSuggestions(criterion: Criterion, manufacturers: Manufacturer[], sheet: CogsSheet | undefined, figures = sheet ? cogsFigures(sheet) : {}, alerts = sheet ? varianceAlerts(sheet) : []) {
  if (!sheet || !criterion.cogsKey) return null;
  const values = Object.fromEntries(Object.entries(figures[criterion.cogsKey as CogsLink] ?? {}).filter(([id]) => manufacturers.some(m => m.id === id)));
  const scores = cogsScores(values);
  if (!Object.keys(scores).length) return null;
  if (criterion.cogsKey === "unitPrice") for (const id of alerts) if (scores[id]) scores[id] = Math.max(1, scores[id] - 1);
  return scores;
}
// "Apply suggested scores" with A.B.5 data: COGS-based rows use cogsSuggestions, the others the usual numeric suggestions.
// Only empty scores are filled; manufacturers with a red variance get the note on item 1 (once).
export function applyCogsSuggestions(matrix: RfqMatrix, sheet: CogsSheet | undefined, note: string): RfqMatrix {
  const figures = sheet ? cogsFigures(sheet) : {}, alerts = sheet ? varianceAlerts(sheet).filter(id => matrix.manufacturers.some(m => m.id === id)) : [];
  const fill = (item: Criterion) => ({ ...item, scores: { ...(cogsSuggestions(item, matrix.manufacturers, sheet, figures, alerts) ?? suggestedScores(item, matrix.manufacturers)), ...item.scores } });
  return {
    ...matrix,
    items: matrix.items.map((item, index) => ({ ...item, criteria: item.criteria.map(fill),
      notes: index ? item.notes : { ...item.notes, ...Object.fromEntries(alerts.filter(id => !(item.notes[id] ?? "").includes(note)).map(id => [id, item.notes[id]?.trim() ? `${item.notes[id].trim()}\n${note}` : note])) } })),
    sections: matrix.sections.map(section => ({ ...section, criteria: section.criteria.map(fill) })),
  };
}

export function cogsCsv(sheet: CogsSheet, shortlist: ShortlistEntry[]) {
  const results = analyseAll(sheet), m = sheet.manufacturers, unit = `${sheet.baseCurrency}/${sheet.compareBasis}`;
  const cell = (value: unknown) => { const text = String(value ?? ""); return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
  const n = (value: number | null) => value === null ? "" : Number(value.toFixed(4));
  const lines: unknown[][] = [["Brief", sheet.brief], ["Base currency", sheet.baseCurrency], ["Comparison basis", sheet.compareBasis], [], ["Group", "Line", ...m.flatMap(item => [`${item.name} – Entered`, `${item.name} – ${unit}`, `${item.name} – % of EXW`])]];
  const info = (label: string, value: (item: CogsManufacturer) => unknown) => lines.push(["Status", label, ...m.flatMap(item => [value(item), "", ""])]);
  info("Requested date", item => item.requestedDate); info("Received date", item => item.receivedDate); info("Open-book confirmed", item => openBookOf(item, shortlist) ? "Yes" : "No");
  info("Source document", item => item.sourceUrl); info("Incoterm", item => item.incoterm); info("Quote currency", item => item.currency); info("Quote basis", item => item.basis);
  info("Units per carton", item => item.unitsPerCarton); info("Unit net weight (g)", item => item.unitWeightG);
  for (const group of GROUPS) {
    for (const line of sheet.lines.filter(item => item.group === group)) lines.push([group, line.label, ...m.flatMap(item => [line.values[item.id] ?? "", n(results[item.id].lines[line.id]), n(shareOfExw(results[item.id].lines[line.id], results[item.id]))])]);
    lines.push([group, "Subtotal", ...m.flatMap(item => ["", n(results[item.id].subtotals[group]), n(shareOfExw(results[item.id].subtotals[group], results[item.id]))])]);
  }
  lines.push(["", "Waste / yield loss (%)", ...m.flatMap(item => [item.wastePct, n(results[item.id].waste), n(shareOfExw(results[item.id].waste, results[item.id]))])]);
  lines.push(["", "Factory margin (%)", ...m.flatMap(item => [item.marginPct, n(results[item.id].margin), n(shareOfExw(results[item.id].margin, results[item.id]))])]);
  lines.push(["", "Calculated EXW cost", ...m.flatMap(item => ["", n(results[item.id].calculated), ""])]);
  lines.push(["", "Quoted EXW price", ...m.flatMap(item => [item.quotedExw, n(results[item.id].quoted), ""])]);
  lines.push(["", "Variance (quoted − calculated)", ...m.flatMap(item => ["", n(results[item.id].variance), n(results[item.id].variancePct)])]);
  if (sheet.showLogistics) {
    lines.push(["Logistics", "Freight per carton", ...m.flatMap(item => [item.freightPerCarton, "", ""])]);
    lines.push(["Logistics", "Insurance per carton", ...m.flatMap(item => [item.insurancePerCarton, "", ""])]);
    lines.push(["Logistics", "Export docs per carton", ...m.flatMap(item => [item.exportDocsPerCarton, "", ""])]);
    lines.push(["Logistics", "Logistics cost", ...m.flatMap(item => ["", n(results[item.id].logistics), ""])]);
    lines.push(["Logistics", "Landed cost", ...m.flatMap(item => ["", n(results[item.id].landed), ""])]);
  }
  return lines.map(line => line.map(cell).join(",")).join("\r\n");
}
