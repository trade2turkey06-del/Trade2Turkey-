// BOM comparison (A.B.9): formulation and packaging lines per shortlisted manufacturer, their cost impact and the
// reconciliation with the A.B.5 COGS sheet. Currency, exchange rates and the cost basis come from A.B.5.
// Pure functions only — no network calls. Line labels are user data; everything stored here is language-neutral.
import { CodedError } from "../i18n/errors";
import { MAX_MANUFACTURERS, newId, type RfqMatrix } from "./rfqMatrix";
import {
  analyse, convertBasis, createCogsManufacturer, createCogsSheet, lowestIds, parseAmount, planRoster, rateOf, varianceLevel,
  type CogsManufacturer, type CogsSheet, type LineLabels, type RosterMember, type ShortlistEntry, type VarianceLevel,
} from "./cogsBreakdown";

export const BOM_GROUPS = ["formulation", "packaging"] as const;
export type BomGroup = typeof BOM_GROUPS[number];
// Quantity per unit (pack): grams priced per kg, or pieces priced per piece.
export type BomUnit = "g" | "pcs";
export interface BomCell { recipePct?: string; qty?: string; price?: string; origin?: string }
export interface BomLine { id: string; group: BomGroup; label: string; unit: BomUnit; main?: boolean; values: Record<string, BomCell> }
export interface BomSheet { manufacturers: RosterMember[]; lines: BomLine[]; removedIds?: string[] }

export const createBomLine = (group: BomGroup, label: string): BomLine => ({ id: newId("b"), group, label, unit: group === "formulation" ? "g" : "pcs", values: {} });
// First lines come from the A.B.5 Raw Materials and Packaging lines; Primary Material is the main ingredient.
export function createBomSheet(cogs: CogsSheet | undefined, labels: LineLabels): BomSheet {
  const source = cogs ?? createCogsSheet(labels);
  const lines = source.lines.filter(line => line.group !== "conv").map(line => ({ ...createBomLine(line.group === "rm" ? "formulation" : "packaging", line.label), ...(line.rfqKey === "primary" ? { main: true } : {}) }));
  if (!lines.some(line => line.main)) { const first = lines.find(line => line.group === "formulation"); if (first) first.main = true; }
  return { manufacturers: [], lines };
}

const rekeyRecord = <T,>(record: Record<string, T>, rekey: Record<string, string>) => Object.fromEntries(Object.entries(record).map(([key, value]) => [rekey[key] ?? key, value]));
// Same shared list as A.B.5/A.B.6: A.A.5 shortlist ids first, then manufacturers added in A.B.5 or A.B.6 (newest name wins).
export function reconcileBom(sheet: BomSheet, shortlist: ShortlistEntry[], cogs: CogsSheet | undefined, rfq: RfqMatrix | undefined, placeholder: (n: number) => string): BomSheet {
  const others = new Map<string, RosterMember>();
  for (const member of [...(cogs?.manufacturers ?? []), ...(rfq && !rfq.isDemo ? rfq.manufacturers : [])]) {
    const known = others.get(member.id);
    if (!known || (member.renamedAt ?? 0) > (known.renamedAt ?? 0)) others.set(member.id, { id: member.id, name: member.name, ...(member.renamedAt ? { renamedAt: member.renamedAt } : {}) });
  }
  const blank = (id: string) => sheet.lines.every(line => !Object.values(line.values[id] ?? {}).some(value => value?.trim()));
  const { members, rekey } = planRoster(sheet.manufacturers, shortlist, [...others.values()], sheet.removedIds ?? [], blank, placeholder);
  const next = { ...sheet, manufacturers: members, lines: sheet.lines.map(line => ({ ...line, values: rekeyRecord(line.values, rekey) })) };
  return JSON.stringify(next) === JSON.stringify(sheet) ? sheet : next;
}

export interface BomSettings { baseCurrency: CogsSheet["baseCurrency"]; compareBasis: CogsSheet["compareBasis"]; sheet: CogsSheet }
// Settings from A.B.5; without a COGS sheet: EUR per unit and no conversion factors.
export const bomSettings = (cogs: CogsSheet | undefined, labels: LineLabels): BomSettings => { const sheet = cogs ?? createCogsSheet(labels); return { baseCurrency: sheet.baseCurrency, compareBasis: sheet.compareBasis, sheet }; };
const cogsManufacturer = (settings: BomSettings, member: RosterMember): CogsManufacturer => settings.sheet.manufacturers.find(m => m.id === member.id) ?? { ...createCogsManufacturer(member.id, member.name), currency: settings.baseCurrency };

export interface BomLineResult { cost: number | null; share: number | null; recipe: number | null; sensitivity: number | null; overweighted: boolean }
export interface Reconciliation { bom: number | null; cogs: number | null; diffPct: number | null; level: VarianceLevel | null }
export interface BomAnalysis {
  lines: Record<string, BomLineResult>; total: number | null;
  subtotals: Record<BomGroup, number | null>; main: number | null; otherMaterials: number | null;
  recipeSum: number | null; recipeWarning: boolean; missingFactor: boolean;
  mainLine: { id: string; label: string; recipe: number | null; grams: number | null; pricePerKg: number | null; cost: number | null; share: number | null } | null;
  top: { id: string; label: string; sensitivity: number }[];
  reconciliation: Record<BomGroup, Reconciliation>;
}
const sumOrNull = (values: (number | null)[]) => values.some(value => value !== null) ? values.reduce<number>((total, value) => total + (value ?? 0), 0) : null;
const pctOf = (value: number | null, total: number | null) => value === null || !total ? null : value / total * 100;

export function analyseBom(sheet: BomSheet, settings: BomSettings, member: RosterMember): BomAnalysis {
  const cm = cogsManufacturer(settings, member), rate = rateOf(settings.sheet, cm.currency);
  let missingFactor = false;
  // Cost per unit (pack) in the manufacturer's currency → base currency per comparison basis.
  const costOf = (line: BomLine) => {
    const cell = line.values[member.id] ?? {}, qty = parseAmount(cell.qty), price = parseAmount(cell.price);
    if (qty === null || price === null) return null;
    const perUnit = (line.unit === "g" ? qty / 1000 : qty) * price;
    const converted = rate === null ? null : convertBasis(perUnit * rate, "unit", settings.compareBasis, cm);
    if (converted === null) missingFactor = true;
    return converted;
  };
  const costs = Object.fromEntries(sheet.lines.map(line => [line.id, costOf(line)]));
  const total = sumOrNull(sheet.lines.map(line => costs[line.id]));
  const subtotals = Object.fromEntries(BOM_GROUPS.map(group => [group, sumOrNull(sheet.lines.filter(line => line.group === group).map(line => costs[line.id]))])) as Record<BomGroup, number | null>;
  const formulation = sheet.lines.filter(line => line.group === "formulation");
  const main = sumOrNull(formulation.filter(line => line.main).map(line => costs[line.id]));
  const otherMaterials = sumOrNull(formulation.filter(line => !line.main).map(line => costs[line.id]));
  const lines = Object.fromEntries(sheet.lines.map(line => {
    const share = pctOf(costs[line.id], total), recipe = line.group === "formulation" ? parseAmount(line.values[member.id]?.recipePct) : null;
    return [line.id, { cost: costs[line.id], share, recipe, sensitivity: share === null ? null : share * 0.1, overweighted: share !== null && recipe !== null && recipe > 0 && share > 2 * recipe }];
  })) as Record<string, BomLineResult>;
  const recipes = formulation.map(line => lines[line.id].recipe);
  const recipeSum = sumOrNull(recipes);
  const mainSource = formulation.find(line => line.main);
  const mainLine = mainSource ? (() => {
    const cell = mainSource.values[member.id] ?? {}, qty = parseAmount(cell.qty), price = parseAmount(cell.price);
    return { id: mainSource.id, label: mainSource.label, recipe: lines[mainSource.id].recipe, grams: mainSource.unit === "g" ? qty : null,
      pricePerKg: mainSource.unit === "g" && price !== null && rate !== null ? price * rate : null, cost: costs[mainSource.id], share: lines[mainSource.id].share };
  })() : null;
  const top = sheet.lines.filter(line => lines[line.id].sensitivity !== null).sort((a, b) => lines[b.id].sensitivity! - lines[a.id].sensitivity!).slice(0, 3).map(line => ({ id: line.id, label: line.label, sensitivity: lines[line.id].sensitivity! }));
  const cogsResult = settings.sheet.manufacturers.some(m => m.id === member.id) ? analyse(settings.sheet, cm) : null;
  const reconcile = (bom: number | null, cogs: number | null): Reconciliation => { const diffPct = bom !== null && cogs ? (bom - cogs) / cogs * 100 : null; return { bom, cogs, diffPct, level: varianceLevel(diffPct) }; };
  const cogsSubtotal = (group: "rm" | "pkg") => cogsResult && settings.sheet.lines.some(line => line.group === group && cogsResult.lines[line.id] !== null) ? cogsResult.subtotals[group] : null;
  return {
    lines, total, subtotals, main, otherMaterials, recipeSum, missingFactor,
    recipeWarning: recipeSum !== null && Math.abs(recipeSum - 100) > 0.5,
    mainLine, top,
    reconciliation: { formulation: reconcile(subtotals.formulation, cogsSubtotal("rm")), packaging: reconcile(subtotals.packaging, cogsSubtotal("pkg")) },
  };
}
export const analyseBomAll = (sheet: BomSheet, settings: BomSettings) => Object.fromEntries(sheet.manufacturers.map(m => [m.id, analyseBom(sheet, settings, m)])) as Record<string, BomAnalysis>;
// Ids holding the highest value of a row (ties all marked); needs two different values so a single figure is not "highest".
export function highestIds(values: Record<string, number | null>) {
  const entries = Object.entries(values).filter((entry): entry is [string, number] => entry[1] !== null);
  if (entries.length < 2) return [];
  const max = Math.max(...entries.map(([, value]) => value)), min = Math.min(...entries.map(([, value]) => value));
  return max - min < 1e-9 ? [] : entries.filter(([, value]) => Math.abs(value - max) < 1e-9).map(([id]) => id);
}
export { lowestIds };
// "Lowest packaging / main ingredient / total BOM" for the comparison sentence; null when no manufacturer has a value.
export function bomLeaders(sheet: BomSheet, results: Record<string, BomAnalysis>) {
  const leader = (pick: (result: BomAnalysis) => number | null) => {
    const values = sheet.manufacturers.map(m => [m.id, pick(results[m.id])] as const).filter((entry): entry is readonly [string, number] => entry[1] !== null);
    if (!values.length) return null;
    const [id] = values.reduce((best, entry) => entry[1] < best[1] ? entry : best);
    return sheet.manufacturers.find(m => m.id === id)!;
  };
  return { packaging: leader(result => result.subtotals.packaging), main: leader(result => result.main), total: leader(result => result.total) };
}
export const hasBomData = (sheet?: BomSheet | null) => !!sheet && sheet.lines.some(line => Object.values(line.values).some(cell => Object.values(cell).some(value => value?.trim())));
export function validateBom(sheet: BomSheet) {
  if (sheet.manufacturers.length > MAX_MANUFACTURERS) throw new CodedError("matrixManufacturers", { min: "3", max: String(MAX_MANUFACTURERS) });
  if (sheet.manufacturers.some(m => !m.name.trim())) throw new CodedError("matrixNames");
}

export function bomCsv(sheet: BomSheet, settings: BomSettings) {
  const results = analyseBomAll(sheet, settings), m = sheet.manufacturers, unit = `${settings.baseCurrency}/${settings.compareBasis}`;
  const cell = (value: unknown) => { const text = String(value ?? ""); return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
  const n = (value: number | null | undefined) => value === null || value === undefined ? "" : Number(value.toFixed(4));
  const rows: unknown[][] = [["Base currency", settings.baseCurrency], ["Comparison basis", settings.compareBasis], [], ["COST IMPACT SUMMARY", "", ...m.map(item => item.name)]];
  const summary = (label: string, value: (result: BomAnalysis) => unknown) => rows.push(["Summary", label, ...m.map(item => value(results[item.id]))]);
  summary(`Total BOM (${unit})`, r => n(r.total));
  summary(`Main ingredient (${unit})`, r => n(r.main)); summary("Main ingredient (% of total)", r => n(pctOf(r.main, r.total)));
  summary(`Other raw materials (${unit})`, r => n(r.otherMaterials)); summary("Other raw materials (% of total)", r => n(pctOf(r.otherMaterials, r.total)));
  summary(`Packaging (${unit})`, r => n(r.subtotals.packaging)); summary("Packaging (% of total)", r => n(pctOf(r.subtotals.packaging, r.total)));
  summary("Main ingredient – recipe %", r => n(r.mainLine?.recipe)); summary("Main ingredient – g per unit", r => n(r.mainLine?.grams));
  summary(`Main ingredient – price per kg (${settings.baseCurrency})`, r => n(r.mainLine?.pricePerKg));
  summary("Top 3 cost drivers (+10% price → unit cost)", r => r.top.map(item => `${item.label} +${item.sensitivity.toFixed(2)}%`).join(" | "));
  summary("Recipe % total", r => n(r.recipeSum));
  summary("Formulation vs A.B.5 Raw Materials (%)", r => n(r.reconciliation.formulation.diffPct));
  summary("Packaging vs A.B.5 Packaging (%)", r => n(r.reconciliation.packaging.diffPct));
  const leaders = bomLeaders(sheet, results);
  rows.push(["Summary", `Lowest packaging cost: ${leaders.packaging?.name ?? "–"} · Lowest main ingredient cost: ${leaders.main?.name ?? "–"} · Lowest total BOM: ${leaders.total?.name ?? "–"}`]);
  rows.push([], ["Group", "Line", "Unit", "Main ingredient", ...m.flatMap(item => ["Recipe %", "Qty per unit", "Price", "Supplier / origin", `Cost (${unit})`, "Cost share %", "+10% price → unit cost %"].map(column => `${item.name} – ${column}`))]);
  for (const group of BOM_GROUPS) {
    for (const line of sheet.lines.filter(item => item.group === group)) rows.push([group, line.label, line.unit, line.main ? "Yes" : "", ...m.flatMap(item => {
      const value = line.values[item.id] ?? {}, result = results[item.id].lines[line.id];
      return [value.recipePct ?? "", value.qty ?? "", value.price ?? "", value.origin ?? "", n(result.cost), n(result.share), n(result.sensitivity)];
    })]);
    rows.push([group, "Subtotal", "", "", ...m.flatMap(item => ["", "", "", "", n(results[item.id].subtotals[group]), n(pctOf(results[item.id].subtotals[group], results[item.id].total)), ""])]);
  }
  return rows.map(row => row.map(cell).join(",")).join("\r\n");
}
