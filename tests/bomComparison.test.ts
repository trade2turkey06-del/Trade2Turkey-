import test from "node:test";
import assert from "node:assert/strict";
import { en } from "../src/i18n/en";
import { createCogsSheet, reconcileCogs, type CogsSheet, type ShortlistEntry } from "../src/domain/cogsBreakdown";
import { analyseBom, analyseBomAll, bomCsv, bomLeaders, bomSettings, createBomSheet, hasBomData, highestIds, reconcileBom, type BomSheet } from "../src/domain/bomComparison";

const placeholder = (n: number) => `Manufacturer ${n}`;
const shortlist: ShortlistEntry[] = [{ id: "s1", name: "Anadolu Fırın" }, { id: "s2", name: "Ege Gıda" }, { id: "s3", name: "Marmara Unlu" }];
const near = (actual: number | null | undefined, expected: number, message?: string) => assert.ok(actual !== null && actual !== undefined && Math.abs(actual - expected) < 1e-9, `${message ?? ""} expected ${expected}, got ${actual}`);

// A.B.5: per-unit EUR figures. Raw Materials subtotal s1 0.55, s2 0.55, s3 0.60; Packaging 0.05 each.
function cogsSheet(): CogsSheet {
  const sheet = reconcileCogs(createCogsSheet(en.cogs.defaults, "Tortilla"), shortlist, undefined, placeholder);
  const line = (key: string) => sheet.lines.find(item => item.rfqKey === key || item.label === key)!;
  const rm: Record<string, [string, string, string]> = { s1: ["0.40", "0.10", "0.05"], s2: ["0.38", "0.12", "0.05"], s3: ["0.45", "0.10", "0.05"] };
  for (const [id, [primary, secondary, component]] of Object.entries(rm)) { line("primary").values[id] = primary; line("secondary").values[id] = secondary; line("component1").values[id] = component; line("Master carton").values[id] = "0.05"; }
  return sheet;
}
// A.B.9: [recipe %, grams, price per kg] for primary, secondary, component 1 and the master carton price per piece.
function bomSheet(cogs: CogsSheet) {
  const sheet = reconcileBom(createBomSheet(cogs, en.cogs.defaults), shortlist, cogs, undefined, placeholder);
  const line = (label: string) => sheet.lines.find(item => item.label === label)!;
  const data: Record<string, [string, string, string][]> = {
    s1: [["80", "500", "0,80"], ["17", "100", "1,00"], ["3", "10", "5"]], // recipe 100; component 1: 3% of recipe, 8.3% of cost
    s2: [["80", "500", "0.76"], ["15", "100", "1.20"], ["3", "10", "5"]], // recipe 98 → warning
    s3: [["80", "500", "1.10"], ["17", "100", "1.00"], ["3", "10", "5"]], // formulation 0.70 vs A.B.5 0.60 → +16.7%
  };
  for (const [id, rows] of Object.entries(data)) {
    ["Primary Material", "Secondary Material", "Component 1"].forEach((label, index) => { const [recipePct, qty, price] = rows[index]; line(label).values[id] = { recipePct, qty, price, origin: "TR" }; });
    line("Master carton").values[id] = { qty: "1", price: "0.05" };
  }
  return sheet;
}

test("BOM: lines start from the A.B.5 Raw Materials and Packaging lines; Primary Material is the main ingredient", () => {
  const cogs = cogsSheet();
  cogs.lines = cogs.lines.map(line => line.rfqKey === "component1" ? { ...line, label: "Vegetable oil" } : line);
  const sheet = createBomSheet(cogs, en.cogs.defaults);
  assert.equal(sheet.lines.filter(line => line.group === "formulation").length, 7);
  assert.equal(sheet.lines.filter(line => line.group === "packaging").length, 5);
  assert.ok(sheet.lines.some(line => line.label === "Vegetable oil"));
  assert.ok(!sheet.lines.some(line => line.label === "Direct labour"), "conversion lines are not part of the BOM");
  assert.deepEqual(sheet.lines.filter(line => line.main).map(line => line.label), ["Primary Material"]);
  assert.deepEqual(createBomSheet(undefined, en.cogs.defaults).lines.filter(line => line.main).map(line => line.label), ["Primary Material"]);
});

test("BOM scenario: cost per unit, shares, sensitivity, recipe warning and A.B.5 reconciliation", () => {
  const cogs = cogsSheet(), sheet = bomSheet(cogs), settings = bomSettings(cogs, en.cogs.defaults), results = analyseBomAll(sheet, settings);
  const id = (label: string) => sheet.lines.find(line => line.label === label)!.id;
  const a = results.s1;
  near(a.lines[id("Primary Material")].cost, 0.4, "500 g × 0.80/kg");
  near(a.lines[id("Master carton")].cost, 0.05, "1 pc × 0.05");
  near(a.total, 0.6); near(a.subtotals.formulation, 0.55); near(a.subtotals.packaging, 0.05);
  near(a.main, 0.4); near(a.otherMaterials, 0.15);
  near(a.lines[id("Primary Material")].share, 0.4 / 0.6 * 100);
  near(a.lines[id("Primary Material")].sensitivity, 0.4 / 0.6 * 10, "+10% price → share × 0.10");
  assert.equal(a.lines[id("Component 1")].overweighted, true, "8.3% of cost vs 3% of recipe");
  assert.equal(a.lines[id("Primary Material")].overweighted, false);
  assert.deepEqual(a.top.map(item => item.label).slice(0, 2), ["Primary Material", "Secondary Material"]);
  assert.equal(a.top.length, 3);
  assert.deepEqual({ ...a.mainLine!, cost: Number(a.mainLine!.cost!.toFixed(4)), share: Number(a.mainLine!.share!.toFixed(2)) }, { id: id("Primary Material"), label: "Primary Material", recipe: 80, grams: 500, pricePerKg: 0.8, cost: 0.4, share: 66.67 });
  assert.equal(a.recipeWarning, false); near(a.recipeSum, 100);
  assert.equal(a.reconciliation.formulation.level, "ok"); near(a.reconciliation.formulation.diffPct, 0);

  // s2: recipe adds up to 98.
  assert.equal(results.s2.recipeWarning, true); near(results.s2.recipeSum, 98);
  assert.equal(results.s2.reconciliation.formulation.level, "ok");
  // s3: BOM formulation 0.70 vs A.B.5 Raw Materials 0.60 → +16.7% (red); packaging matches.
  near(results.s3.reconciliation.formulation.diffPct, (0.7 - 0.6) / 0.6 * 100);
  assert.equal(results.s3.reconciliation.formulation.level, "alert");
  assert.equal(results.s3.reconciliation.packaging.level, "ok");

  const leaders = bomLeaders(sheet, results);
  assert.deepEqual([leaders.packaging?.name, leaders.main?.name, leaders.total?.name], ["Anadolu Fırın", "Ege Gıda", "Anadolu Fırın"]);
  // Lowest/highest per row: main ingredient cost 0.40 / 0.38 / 0.55.
  assert.deepEqual(highestIds({ s1: a.main, s2: results.s2.main, s3: results.s3.main }), ["s3"]);
  assert.deepEqual(highestIds({ s1: 0.05, s2: 0.05 }), [], "equal values are not marked as highest");
});

test("BOM: amber reconciliation between 5% and 10%; no A.B.5 figure → no level", () => {
  const cogs = cogsSheet(), sheet = bomSheet(cogs), settings = bomSettings(cogs, en.cogs.defaults);
  sheet.lines.find(line => line.label === "Master carton")!.values.s1 = { qty: "1", price: "0.054" };
  assert.equal(analyseBom(sheet, settings, sheet.manufacturers[0]).reconciliation.packaging.level, "warn");
  const noCogs = analyseBom(sheet, bomSettings(undefined, en.cogs.defaults), sheet.manufacturers[0]);
  assert.equal(noCogs.reconciliation.formulation.cogs, null);
  assert.equal(noCogs.reconciliation.formulation.level, null);
});

test("BOM: currency, rate and basis come from A.B.5", () => {
  const cogs = cogsSheet(), sheet = bomSheet(cogs);
  cogs.manufacturers[0] = { ...cogs.manufacturers[0], currency: "TRY" };
  assert.equal(analyseBom(sheet, bomSettings(cogs, en.cogs.defaults), sheet.manufacturers[0]).missingFactor, true, "no TRY rate yet");
  cogs.rates.TRY = "0,025";
  const converted = analyseBom(sheet, bomSettings(cogs, en.cogs.defaults), sheet.manufacturers[0]);
  near(converted.total, 0.6 * 0.025);
  near(converted.mainLine!.pricePerKg, 0.8 * 0.025);
  cogs.compareBasis = "carton"; cogs.manufacturers[0].unitsPerCarton = "12";
  near(analyseBom(sheet, bomSettings(cogs, en.cogs.defaults), sheet.manufacturers[0]).total, 0.6 * 0.025 * 12);
});

test("BOM: shared manufacturer list, removed ids, CSV with the summary", () => {
  const cogs = cogsSheet();
  const legacy: BomSheet = { manufacturers: [{ id: "m-old", name: "Ege Gıda" }], lines: [{ id: "l1", group: "formulation", label: "Flour", unit: "g", main: true, values: { "m-old": { qty: "500", price: "1" } } }] };
  const reconciled = reconcileBom(legacy, shortlist, cogs, undefined, placeholder);
  assert.deepEqual(reconciled.manufacturers.map(m => m.id), ["s2", "s1", "s3"], "older record matched by name keeps its column");
  assert.equal(reconciled.lines[0].values.s2?.qty, "500");
  assert.equal(reconcileBom(reconciled, shortlist, cogs, undefined, placeholder), reconciled, "idempotent");
  assert.equal(reconcileBom({ ...reconciled, manufacturers: reconciled.manufacturers.filter(m => m.id !== "s3"), removedIds: ["s3"] }, shortlist, cogs, undefined, placeholder).manufacturers.some(m => m.id === "s3"), false);
  assert.equal(hasBomData(createBomSheet(cogs, en.cogs.defaults)), false);
  const sheet = bomSheet(cogs), csv = bomCsv(sheet, bomSettings(cogs, en.cogs.defaults));
  assert.match(csv, /COST IMPACT SUMMARY/);
  assert.match(csv, /Lowest packaging cost: Anadolu Fırın · Lowest main ingredient cost: Ege Gıda · Lowest total BOM: Anadolu Fırın/);
  assert.match(csv, /Top 3 cost drivers/);
  assert.match(csv, /Anadolu Fırın – Cost share %/);
});
