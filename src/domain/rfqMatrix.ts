// RFQ comparison matrix (A.B.6): template, scoring formulas and CSV export. Pure functions only — no network calls.
import { CodedError } from "../i18n/errors";

export type SectionId = "offer" | "technical" | "commercial" | "company" | "soft";
// Numeric criteria that get a suggested score: lower values are better for prices/lead time, higher for capacity/experience.
export type NumericKind = "unitPrice" | "logistics" | "leadTime" | "capacity" | "years";
// renamedAt: set when renamed here; the newer name wins when A.B.5 (COGS) and A.B.6 share their manufacturer list.
export interface Manufacturer { id: string; name: string; renamedAt?: number }
export interface Criterion {
  id: string; label: string; weight: number; kind?: NumericKind;
  // Row filled from the A.B.5 COGS sheet ("unitPrice", "logistics", "primary", "component1"…); optional, older matrices have none.
  cogsKey?: string;
  values: Record<string, string>;
  // Unscored manufacturers have no key (Firestore rejects undefined values).
  scores: Record<string, number>;
}
export interface OfferItem { id: string; name: string; criteria: Criterion[]; notes: Record<string, string> }
export interface Section { id: SectionId; title: string; weight: number; criteria: Criterion[] }
export interface RfqMatrix {
  brief: string; manufacturers: Manufacturer[]; sections: Section[]; items: OfferItem[]; isDemo?: boolean;
  // Manufacturers removed here are not re-added from the shortlist or the COGS sheet.
  removedIds?: string[];
}

export const MIN_MANUFACTURERS = 3, MAX_MANUFACTURERS = 6;
export const scoreLabels: Record<number, string> = { 1: "Poor", 2: "Below avg", 3: "Acceptable", 4: "Good", 5: "Excellent" };
const lowerIsBetter: NumericKind[] = ["unitPrice", "logistics", "leadTime"];

type Template = [string, NumericKind?, number?];
const offerCriteria: Template[] = [["Unit Price (EXW)", "unitPrice"], ["Sample Quality"], ["Primary Material"], ["Secondary Material"], ["Component 1"], ["Component 2"], ["Component 3"], ["Component 4"], ["Component 5"]];
const sectionTemplates: { id: Exclude<SectionId, "offer">; title: string; weight: number; criteria: Template[] }[] = [
  { id: "technical", title: "Technical & Quality Data", weight: 15, criteria: [["Quality Control System"], ["Certificates"], ["Warranty Terms"], ["Audit"]] },
  { id: "commercial", title: "Commercial Data", weight: 10, criteria: [["Import Taxes"], ["Logistics Unit Price per Box", "logistics"], ["Lead Time", "leadTime"], ["Payment Terms"], ["Monthly Capacity", "capacity"]] },
  { id: "company", title: "Company Information", weight: 15, criteria: [["Years in Industry", "years"], ["Number of Employees"], ["Average Yearly Revenue"], ["General Liability Insurance Coverage"], ["Number of Factories"], ["Vertical Manufacturing"], ["Retailer / Premium Private Label Experience"], ["Other Product Groups"],
    // Five differentiator lines together weigh as much as one regular criterion.
    ["Key Differentiator 1", undefined, 0.2], ["Key Differentiator 2", undefined, 0.2], ["Key Differentiator 3", undefined, 0.2], ["Key Differentiator 4", undefined, 0.2], ["Key Differentiator 5", undefined, 0.2]] },
  { id: "soft", title: "\"Soft\" Criteria (Our Assessment)", weight: 10, criteria: [["Communication Speed"], ["English Fluency"], ["Flexibility for Changes"]] },
];

let counter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const criterion = ([label, kind, weight]: Template): Criterion => ({ id: newId("c"), label, weight: weight ?? 1, ...(kind ? { kind } : {}), values: {}, scores: {} });
export const createOfferItem = (index: number): OfferItem => ({ id: newId("item"), name: `Item ${index}`, criteria: offerCriteria.map(criterion), notes: {} });
export function createMatrix(brief = ""): RfqMatrix {
  return {
    brief,
    manufacturers: [1, 2, 3].map(index => ({ id: newId("m"), name: `Manufacturer ${index}` })),
    sections: [{ id: "offer", title: "Offer & Specification", weight: 50, criteria: [] }, ...sectionTemplates.map(section => ({ id: section.id, title: section.title, weight: section.weight, criteria: section.criteria.map(criterion) }))],
    items: [createOfferItem(1)],
  };
}

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const validScore = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

// Weighted average of scored criteria (1–5); unscored or zero-weight criteria are ignored. null when nothing is scored.
export function weightedAverage(criteria: Criterion[], manufacturerId: string) {
  let sum = 0, weights = 0;
  for (const item of criteria) { const score = item.scores[manufacturerId]; if (validScore(score) && item.weight > 0) { sum += item.weight * score; weights += item.weight; } }
  return weights ? sum / weights : null;
}
// (weighted average / 5) × section weight.
export function sectionPoints(criteria: Criterion[], manufacturerId: string, sectionWeight: number) {
  const average = weightedAverage(criteria, manufacturerId);
  return average === null ? 0 : average / 5 * sectionWeight;
}
// Share of the total (in %) carried by one criterion inside its section.
export function criterionShare(criteria: Criterion[], target: Criterion, sectionWeight: number) {
  const total = criteria.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  return total ? Math.max(0, target.weight) / total * sectionWeight : 0;
}
// Points one criterion contributes: its share × score / 5, normalised over the criteria that are scored for this manufacturer.
export function criterionPoints(criteria: Criterion[], target: Criterion, manufacturerId: string, sectionWeight: number) {
  const score = target.scores[manufacturerId];
  if (!validScore(score) || target.weight <= 0) return null;
  const scoredWeight = criteria.reduce((sum, item) => sum + (validScore(item.scores[manufacturerId]) && item.weight > 0 ? item.weight : 0), 0);
  return target.weight / scoredWeight * (score / 5) * sectionWeight;
}
// Offer impact = mean of the item evaluation points over items that have at least one score.
export function offerImpact(matrix: RfqMatrix, manufacturerId: string) {
  const weight = matrix.sections.find(section => section.id === "offer")?.weight ?? 0;
  const scored = matrix.items.filter(item => weightedAverage(item.criteria, manufacturerId) !== null);
  return scored.length ? scored.reduce((sum, item) => sum + sectionPoints(item.criteria, manufacturerId, weight), 0) / scored.length : 0;
}
export function sectionImpact(matrix: RfqMatrix, section: Section, manufacturerId: string) {
  return section.id === "offer" ? offerImpact(matrix, manufacturerId) : sectionPoints(section.criteria, manufacturerId, section.weight);
}
export function totals(matrix: RfqMatrix) {
  const rows = matrix.manufacturers.map(manufacturer => {
    const impacts = Object.fromEntries(matrix.sections.map(section => [section.id, round(sectionImpact(matrix, section, manufacturer.id))])) as Record<SectionId, number>;
    return { id: manufacturer.id, name: manufacturer.name, impacts, total: round(Object.values(impacts).reduce((sum, value) => sum + value, 0)) };
  });
  const ranking = [...rows].sort((a, b) => b.total - a.total);
  const best = ranking[0]?.total ?? 0;
  return { rows, ranking, recommended: best > 0 ? ranking.filter(row => row.total === best).map(row => row.id) : [] };
}
export const weightTotal = (matrix: RfqMatrix) => round(matrix.sections.reduce((sum, section) => sum + (Number(section.weight) || 0), 0), 4);
export const weightsValid = (matrix: RfqMatrix) => Math.abs(weightTotal(matrix) - 100) < 0.001 && matrix.sections.every(section => section.weight >= 0);

// Reads the first number in free text: "4.10 USD" → 4.1, "80k pcs" → 80000, "3,000" → 3000, "1.250,50" → 1250.5.
export function parseNumber(value: string | undefined) {
  const match = (value ?? "").replace(/\s/g, "").match(/(\d+(?:[.,]\d+)*)([kKmM])?/);
  if (!match) return null;
  let digits = match[1];
  if (/^\d{1,3}([.,]\d{3})+$/.test(digits)) digits = digits.replace(/[.,]/g, "");
  else if (/,\d{1,2}$/.test(digits)) digits = digits.replace(/\./g, "").replace(",", ".");
  else digits = digits.replace(/,/g, "");
  const number = Number(digits);
  if (!Number.isFinite(number)) return null;
  return number * ({ k: 1e3, m: 1e6 }[match[2]?.toLowerCase() as "k" | "m"] ?? 1);
}
// Suggested 1–5 score for numeric criteria: best value = 5, worst = 1, linear in between. Needs at least two numeric values.
export function suggestedScores(target: Criterion, manufacturers: Manufacturer[]) {
  if (!target.kind) return {};
  const numbers = manufacturers.map(manufacturer => [manufacturer.id, parseNumber(target.values[manufacturer.id])] as const).filter((entry): entry is readonly [string, number] => entry[1] !== null);
  if (numbers.length < 2) return {};
  const values = numbers.map(([, value]) => value), min = Math.min(...values), max = Math.max(...values);
  const lower = lowerIsBetter.includes(target.kind);
  return Object.fromEntries(numbers.map(([id, value]) => [id, max === min ? 5 : Math.round(1 + 4 * (lower ? max - value : value - min) / (max - min))])) as Record<string, number>;
}
// Unit price more than 15% above the average of the other manufacturers' prices.
export function priceOutliers(target: Criterion, manufacturers: Manufacturer[]) {
  const prices = manufacturers.map(manufacturer => [manufacturer.id, parseNumber(target.values[manufacturer.id])] as const).filter((entry): entry is readonly [string, number] => entry[1] !== null);
  return prices.filter(([id, price]) => { const others = prices.filter(([other]) => other !== id); return others.length > 0 && price > 1.15 * others.reduce((sum, [, value]) => sum + value, 0) / others.length; }).map(([id]) => id);
}
export const allCriteria = (matrix: RfqMatrix) => [...matrix.items.flatMap(item => item.criteria), ...matrix.sections.flatMap(section => section.criteria)];
// Fills only empty scores with suggestions; scores the user picked are never overwritten.
export function applySuggestions(matrix: RfqMatrix): RfqMatrix {
  const fill = (item: Criterion) => { const suggested = suggestedScores(item, matrix.manufacturers); return { ...item, scores: { ...suggested, ...item.scores } }; };
  return { ...matrix, items: matrix.items.map(item => ({ ...item, criteria: item.criteria.map(fill) })), sections: matrix.sections.map(section => ({ ...section, criteria: section.criteria.map(fill) })) };
}
// Removes a manufacturer and every value, score and note stored for it.
export function removeManufacturer(matrix: RfqMatrix, id: string): RfqMatrix {
  const strip = (item: Criterion) => { const { [id]: _value, ...values } = item.values; const { [id]: _score, ...scores } = item.scores; return { ...item, values, scores }; };
  return { ...matrix, manufacturers: matrix.manufacturers.filter(manufacturer => manufacturer.id !== id), removedIds: [...(matrix.removedIds ?? []).filter(item => item !== id), id].slice(-50),
    items: matrix.items.map(item => { const { [id]: _note, ...notes } = item.notes; return { ...item, notes, criteria: item.criteria.map(strip) }; }),
    sections: matrix.sections.map(section => ({ ...section, criteria: section.criteria.map(strip) })) };
}
export function validateMatrix(matrix: RfqMatrix) {
  if (matrix.manufacturers.length < MIN_MANUFACTURERS || matrix.manufacturers.length > MAX_MANUFACTURERS) throw new CodedError("matrixManufacturers", { min: String(MIN_MANUFACTURERS), max: String(MAX_MANUFACTURERS) });
  if (matrix.manufacturers.some(manufacturer => !manufacturer.name.trim())) throw new CodedError("matrixNames");
  if (!weightsValid(matrix)) throw new CodedError("matrixWeights", { total: String(weightTotal(matrix)) });
  if (allCriteria(matrix).some(item => !Number.isFinite(item.weight) || item.weight < 0)) throw new CodedError("matrixCriterionWeights");
  if (allCriteria(matrix).some(item => Object.values(item.scores).some(score => !validScore(score)))) throw new CodedError("matrixScores");
}

const csvCell = (value: unknown) => { const text = String(value ?? ""); return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
export function toCsv(matrix: RfqMatrix) {
  const result = totals(matrix), m = matrix.manufacturers;
  const lines: unknown[][] = [["Brief", matrix.brief], [], ["Section", "Criteria", "Weight (%)", ...m.flatMap(item => [`${item.name} – Value`, `${item.name} – Score`, `${item.name} – Weighted`])]];
  const rows = (section: string, criteria: Criterion[], weight: number) => criteria.forEach(item => lines.push([section, item.label, round(criterionShare(criteria, item, weight)), ...m.flatMap(manufacturer => { const points = criterionPoints(criteria, item, manufacturer.id, weight); return [item.values[manufacturer.id] ?? "", item.scores[manufacturer.id] ?? "", points === null ? "" : round(points)]; })]));
  for (const section of matrix.sections) {
    if (section.id === "offer") for (const item of matrix.items) {
      rows(`${section.title} – ${item.name}`, item.criteria, section.weight);
      lines.push([`${section.title} – ${item.name}`, "Evaluation Point", section.weight, ...m.flatMap(manufacturer => ["", "", round(sectionPoints(item.criteria, manufacturer.id, section.weight))])]);
      lines.push([`${section.title} – ${item.name}`, "Evaluation Notes", "", ...m.flatMap(manufacturer => [item.notes[manufacturer.id] ?? "", "", ""])]);
    }
    else rows(section.title, section.criteria, section.weight);
    lines.push([section.title, `${section.title} Impact (${section.weight}%)`, section.weight, ...result.rows.flatMap(row => ["", "", row.impacts[section.id]])]);
  }
  lines.push(["", "TOTAL SCORE (/100)", 100, ...result.rows.flatMap(row => ["", "", row.total])]);
  lines.push(["", "Recommended", "", ...m.flatMap(manufacturer => [result.recommended.includes(manufacturer.id) ? "Recommended" : "", "", ""])]);
  return lines.map(line => line.map(csvCell).join(",")).join("\r\n");
}
