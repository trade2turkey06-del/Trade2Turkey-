import test from "node:test";
import assert from "node:assert/strict";
import { createMatrix, type RfqMatrix } from "../src/domain/rfqMatrix";
import { createDemoMatrix } from "../src/data/rfqMatrixDemo";
import { tr } from "../src/i18n/tr";
import { en } from "../src/i18n/en";
import {
  analyse, applyCogsSuggestions, cogsCsv, cogsScores, convertBasis, createCogsSheet, fromCogs, cogsFigures, hasCogsData, incompleteManufacturers,
  linkedCriterion, parseAmount, reconcileCogs, reconcileMatrix, summary, syncMatrixFromCogs, type CogsSheet, type ShortlistEntry,
} from "../src/domain/cogsBreakdown";

const placeholder = (n: number) => `Manufacturer ${n}`;
const shortlist: ShortlistEntry[] = [{ id: "s1", name: "Anadolu Fırın", openBookAgreed: true }, { id: "s2", name: "Ege Gıda", openBookAgreed: true }, { id: "s3", name: "Marmara Unlu" }];
const line = (sheet: CogsSheet, key: string) => sheet.lines.find(item => item.rfqKey === key || item.label === key)!;

// Three manufacturers, per-unit quotes in EUR. Ege Gıda's quote is 20% above its own breakdown (red variance).
function scenario() {
  const sheet = reconcileCogs(createCogsSheet(en.cogs.defaults, "Frozen tortilla 25 cm, 8-pack"), shortlist, undefined, placeholder);
  const values: Record<string, [string, string, string, string, string, string]> = {
    // primary, secondary, component1, master carton, direct labour, quoted
    s1: ["0,40", "0,10", "0,05", "0,05", "0,20", "1,00"],
    s2: ["0.38", "0.12", "0.05", "0.05", "0.20", "1.20"],
    s3: ["0.45", "0.10", "0.05", "0.05", "0.25", "1.07"],
  };
  for (const [id, [primary, secondary, component1, carton, labour]] of Object.entries(values)) {
    line(sheet, "primary").values[id] = primary; line(sheet, "secondary").values[id] = secondary; line(sheet, "component1").values[id] = component1;
    line(sheet, "Master carton").values[id] = carton; line(sheet, "Direct labour").values[id] = labour;
  }
  sheet.showLogistics = true;
  sheet.manufacturers = sheet.manufacturers.map(m => ({ ...m, wastePct: "2", marginPct: "8", quotedExw: values[m.id][5], unitsPerCarton: "12", freightPerCarton: "1.20", insurancePerCarton: "0.06", exportDocsPerCarton: "0.18", receivedDate: m.id === "s3" ? "" : "2026-10-15" }));
  return sheet;
}

test("COGS: amounts parse in TR and EN notation", () => {
  assert.equal(parseAmount("0,45"), 0.45);
  assert.equal(parseAmount("0.450"), 0.45);
  assert.equal(parseAmount("1.250,50"), 1250.5);
  assert.equal(parseAmount("1,250.50"), 1250.5);
  assert.equal(parseAmount("1.250.000"), 1250000);
  assert.equal(parseAmount("€ 4,10"), 4.1);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount(""), null);
});

test("COGS: calculated EXW = (RM + PKG + CONV) × (1 + waste) × (1 + margin); variance levels", () => {
  const sheet = scenario();
  const a = analyse(sheet, sheet.manufacturers[0]);
  assert.ok(Math.abs(a.subtotals.rm - 0.55) < 1e-9 && Math.abs(a.subtotals.pkg - 0.05) < 1e-9 && Math.abs(a.subtotals.conv - 0.2) < 1e-9);
  assert.ok(Math.abs(a.calculated! - 0.8 * 1.02 * 1.08) < 1e-9);
  assert.equal(a.level, "alert"); // 1.00 vs 0.8813 → +13.5%
  const b = analyse(sheet, sheet.manufacturers[1]);
  assert.equal(b.level, "alert"); // 1.20 vs 0.8813 → +36%
  const c = analyse(sheet, sheet.manufacturers[2]);
  assert.ok(Math.abs(c.calculated! - 0.9 * 1.02 * 1.08) < 1e-9);
  assert.equal(c.level, "warn"); // 1.07 vs 0.9914 → +7.9%
  // Logistics: (1.20 + 0.06 + 0.18) / 12 per unit; landed = quote + logistics.
  assert.ok(Math.abs(a.logisticsPerCarton! - 1.44) < 1e-9 && Math.abs(a.logistics! - 0.12) < 1e-9 && Math.abs(a.landed! - 1.12) < 1e-9);
  const overview = summary(sheet);
  assert.equal(overview.lowestCalculated!.id, "s1");
  assert.equal(overview.lowestLanded!.id, "s1");
  assert.deepEqual([overview.received, overview.total], [2, 3]);
});

test("COGS: currency rates and cost basis conversion", () => {
  const sheet = scenario();
  sheet.manufacturers[1] = { ...sheet.manufacturers[1], currency: "TRY", basis: "kg", unitWeightG: "500" };
  const missing = analyse(sheet, sheet.manufacturers[1]);
  assert.equal(missing.calculated, null);
  assert.equal(missing.missingFactor, true);
  sheet.rates.TRY = "0,025";
  const converted = analyse(sheet, sheet.manufacturers[1]);
  // 0.38 TRY/kg × 0.025 × 0.5 kg per unit
  assert.ok(Math.abs(converted.lines[line(sheet, "primary").id]! - 0.38 * 0.025 * 0.5) < 1e-12);
  assert.equal(convertBasis(1, "unit", "carton", sheet.manufacturers[0]), 12);
  assert.equal(convertBasis(1, "unit", "kg", sheet.manufacturers[0]), null);
});

test("COGS: completion check lists manufacturers without received date, open-book or quote", () => {
  const sheet = scenario();
  assert.deepEqual(incompleteManufacturers(sheet, shortlist).map(m => m.id), ["s3"]);
  sheet.manufacturers[2] = { ...sheet.manufacturers[2], receivedDate: "2026-10-16", openBook: true };
  assert.deepEqual(incompleteManufacturers(sheet, shortlist), []);
});

test("COGS ⇄ RFQ: manufacturers follow the shortlist by id; placeholders are taken over, data is never dropped", () => {
  const matrix = createMatrix();
  const firstId = matrix.manufacturers[0].id;
  matrix.items[0].criteria[1].values[firstId] = "keep me";
  matrix.manufacturers[0].name = "Anadolu Fırın"; // older record: matched by name, re-keyed to the shortlist id
  const reconciled = reconcileMatrix(matrix, shortlist, undefined, placeholder);
  assert.deepEqual(reconciled.manufacturers.map(m => [m.id, m.name]), [["s1", "Anadolu Fırın"], ["s2", "Ege Gıda"], ["s3", "Marmara Unlu"]]);
  assert.equal(reconciled.items[0].criteria[1].values.s1, "keep me");
  assert.equal(reconcileMatrix(reconciled, shortlist, undefined, placeholder), reconciled, "idempotent");
  // A rename in A.B.6 (newer) reaches A.B.5; a manufacturer added in A.B.6 appears in A.B.5 too.
  const renamed: RfqMatrix = { ...reconciled, manufacturers: [...reconciled.manufacturers.map(m => m.id === "s2" ? { ...m, name: "Ege Gıda A.Ş.", renamedAt: 10 } : m), { id: "x4", name: "Trakya Bakery" }] };
  const sheet = reconcileCogs(scenario(), shortlist, renamed, placeholder);
  assert.deepEqual(sheet.manufacturers.map(m => m.name), ["Anadolu Fırın", "Ege Gıda A.Ş.", "Marmara Unlu", "Trakya Bakery"]);
  // Removed manufacturers stay removed; demo matrices are never touched.
  assert.equal(reconcileCogs({ ...sheet, manufacturers: sheet.manufacturers.filter(m => m.id !== "x4"), removedIds: ["x4"] }, shortlist, renamed, placeholder).manufacturers.length, 3);
  const demo = createDemoMatrix();
  assert.equal(reconcileMatrix(demo, shortlist, sheet, placeholder), demo);
});

test("Scenario: A.B.5 → Send to RFQ → A.B.6 values and suggested scores", () => {
  const sheet = scenario();
  sheet.lines = sheet.lines.map(item => item.rfqKey === "component1" ? { ...item, label: "Vegetable oil" } : item);
  let matrix = reconcileMatrix(createMatrix(), shortlist, sheet, placeholder);
  matrix.items[0].criteria[2].values.s1 = "100% wheat flour, T550"; // descriptive text typed in A.B.6 survives a send
  matrix = syncMatrixFromCogs(matrix, sheet, true);
  const unit = linkedCriterion(matrix, "unitPrice")!, primary = linkedCriterion(matrix, "primary")!, oil = linkedCriterion(matrix, "component1")!, logistics = linkedCriterion(matrix, "logistics")!;
  assert.deepEqual(unit.values, { s1: "1.00 EUR", s2: "1.20 EUR", s3: "1.07 EUR" });
  assert.deepEqual(primary.values, { s1: "100% wheat flour, T550", s2: "0.38 EUR", s3: "0.45 EUR" });
  assert.equal(oil.label, "Vegetable oil");
  assert.equal(oil.values.s1, "0.0500 EUR");
  assert.deepEqual(logistics.values, { s1: "1.44 EUR", s2: "1.44 EUR", s3: "1.44 EUR" });
  const figures = cogsFigures(sheet);
  assert.equal(fromCogs(unit, "s1", sheet, figures), true);
  assert.equal(fromCogs(primary, "s1", sheet, figures), false);
  // Automatic sync never overwrites a user's value.
  matrix.items[0].criteria[0].values.s3 = "1.05 EUR";
  assert.equal(linkedCriterion(syncMatrixFromCogs(matrix, sheet, false), "unitPrice")!.values.s3, "1.05 EUR");
  matrix = syncMatrixFromCogs(matrix, sheet, true);

  const scored = applyCogsSuggestions(matrix, sheet, en.rfqMatrix.inconsistentNote);
  const scores = linkedCriterion(scored, "unitPrice")!.scores;
  // Lowest quote 1.00 → 5; 1.20 → round(5 × 1.00 / 1.20) = 4; 1.07 → round(4.67) = 5. Red variance (s1, s2) costs one point.
  assert.deepEqual(scores, { s1: 4, s2: 3, s3: 5 });
  // Scores use the COGS figures even where A.B.6 shows descriptive text: 0.38 → 5, 0.40 → round(4.75) = 5, 0.45 → round(4.22) = 4.
  assert.deepEqual(linkedCriterion(scored, "primary")!.scores, { s1: 5, s2: 5, s3: 4 });
  assert.equal(scored.items[0].notes.s2, "Cost breakdown inconsistent with quote");
  assert.equal(scored.items[0].notes.s3, undefined);
  // Applying again keeps user scores and does not duplicate the note.
  const again = applyCogsSuggestions({ ...scored, items: scored.items.map((item, i) => i ? item : { ...item, criteria: item.criteria.map(c => c.cogsKey === "unitPrice" ? { ...c, scores: { ...c.scores, s3: 2 } } : c) }) }, sheet, en.rfqMatrix.inconsistentNote);
  assert.equal(linkedCriterion(again, "unitPrice")!.scores.s3, 2);
  assert.equal(again.items[0].notes.s2, "Cost breakdown inconsistent with quote");
});

test("COGS: helpers for empty sheets, ratio scores and CSV", () => {
  assert.equal(hasCogsData(undefined), false);
  assert.equal(hasCogsData(createCogsSheet(tr.cogs.defaults)), false);
  assert.equal(hasCogsData(scenario()), true);
  assert.deepEqual(cogsScores({ a: 2 }), {});
  assert.deepEqual(cogsScores({ a: 2, b: 4, c: 20 }), { a: 5, b: 3, c: 1 });
  const csv = cogsCsv(scenario(), shortlist);
  assert.match(csv, /Calculated EXW cost/);
  assert.match(csv, /Anadolu Fırın – EUR\/unit/);
  // Defaults are written in the UI language at creation time.
  assert.equal(createCogsSheet(tr.cogs.defaults).lines[0].label, "Ana hammadde");
});
