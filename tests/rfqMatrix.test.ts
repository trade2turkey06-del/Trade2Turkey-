import test from "node:test";
import assert from "node:assert/strict";
import { applySuggestions, createMatrix, createOfferItem, criterionPoints, criterionShare, offerImpact, parseNumber, priceOutliers, removeManufacturer, sectionPoints, suggestedScores, toCsv, totals, validateMatrix, weightTotal, weightedAverage, type Criterion, type RfqMatrix } from "../src/domain/rfqMatrix";
import { createDemoMatrix } from "../src/data/rfqMatrixDemo";

const crit = (weight: number, scores: Record<string, number>, kind?: Criterion["kind"], values: Record<string, string> = {}): Criterion => ({ id: Math.random().toString(36), label: "c", weight, kind, values, scores });
const section = (matrix: RfqMatrix, id: string) => matrix.sections.find(item => item.id === id)!;

test("RFQ: weighted average and section points follow (avg / 5) × section weight", () => {
  const criteria = [crit(1, { a: 5 }), crit(1, { a: 3 }), crit(1, {}), crit(2, { a: 4 })];
  assert.equal(weightedAverage(criteria, "a"), (5 + 3 + 8) / 4);
  assert.equal(sectionPoints(criteria, "a", 15), 4 / 5 * 15);
  assert.equal(weightedAverage(criteria, "b"), null);
  assert.equal(sectionPoints(criteria, "b", 15), 0);
  // Per-criterion contributions add up to the section points; share is the criterion's % of the total.
  const sum = criteria.reduce((total, item) => total + (criterionPoints(criteria, item, "a", 15) ?? 0), 0);
  assert.ok(Math.abs(sum - 12) < 1e-9);
  assert.equal(criterionShare(criteria, criteria[3], 15), 6);
});

test("RFQ: key differentiators weigh 0.2 each, together one criterion", () => {
  const company = section(createMatrix(), "company").criteria;
  const differentiators = company.filter(item => item.label.startsWith("Key Differentiator"));
  assert.equal(differentiators.length, 5);
  assert.ok(differentiators.every(item => item.weight === 0.2));
  assert.ok(Math.abs(differentiators.reduce((sum, item) => sum + item.weight, 0) - 1) < 1e-9);
});

test("RFQ: offer impact is the mean of item evaluation points; total is out of 100", () => {
  const matrix = createMatrix("x");
  const [a] = matrix.manufacturers.map(item => item.id);
  matrix.items = [createOfferItem(1), createOfferItem(2)];
  matrix.items[0].criteria[0].scores[a] = 5;
  matrix.items[1].criteria[0].scores[a] = 3;
  assert.equal(offerImpact(matrix, a), (50 + 30) / 2);
  for (const item of matrix.sections.flatMap(entry => entry.criteria)) item.scores[a] = 5;
  matrix.items.forEach(item => item.criteria.forEach(criterion => { criterion.scores[a] = 5; }));
  assert.equal(totals(matrix).rows[0].total, 100);
  assert.deepEqual(totals(matrix).recommended, [a]);
});

test("RFQ: section weights must total 100 and manufacturers must be 3–6", () => {
  const matrix = createMatrix();
  assert.equal(weightTotal(matrix), 100);
  assert.doesNotThrow(() => validateMatrix(matrix));
  section(matrix, "soft").weight = 15;
  assert.throws(() => validateMatrix(matrix), /add up to 100/);
  section(matrix, "soft").weight = 10;
  assert.throws(() => validateMatrix(removeManufacturer(matrix, matrix.manufacturers[0].id)), /3–6/);
  matrix.items[0].criteria[1].scores[matrix.manufacturers[0].id] = 7;
  assert.throws(() => validateMatrix(matrix), /1 to 5/);
});

test("RFQ: numbers are read from free text", () => {
  assert.equal(parseNumber("4.10 USD"), 4.1);
  assert.equal(parseNumber("80k pcs"), 80000);
  assert.equal(parseNumber("3,000 pcs"), 3000);
  assert.equal(parseNumber("1.250,50"), 1250.5);
  assert.equal(parseNumber("45 days"), 45);
  assert.equal(parseNumber("None"), null);
});

test("RFQ: suggested scores — lowest price/lead time = 5, highest capacity/years = 5, linear in between", () => {
  const ms = ["a", "b", "c"].map(id => ({ id, name: id }));
  assert.deepEqual(suggestedScores(crit(1, {}, "unitPrice", { a: "4.10", b: "3.65", c: "4.80" }), ms), { a: 3, b: 5, c: 1 });
  assert.deepEqual(suggestedScores(crit(1, {}, "leadTime", { a: "45 days", b: "60 days", c: "35 days" }), ms), { a: 3, b: 1, c: 5 });
  assert.deepEqual(suggestedScores(crit(1, {}, "capacity", { a: "80k", b: "40k", c: "120k" }), ms), { a: 3, b: 1, c: 5 });
  assert.deepEqual(suggestedScores(crit(1, {}, "years", { a: "10", b: "10" }), ms), { a: 5, b: 5 });
  assert.deepEqual(suggestedScores(crit(1, {}, "unitPrice", { a: "4.10" }), ms), {});
  assert.deepEqual(suggestedScores(crit(1, {}), ms), {});
});

test("RFQ: applying suggestions never overwrites a chosen score", () => {
  const matrix = createMatrix();
  const [a, b, c] = matrix.manufacturers.map(item => item.id);
  Object.assign(matrix.items[0].criteria[0].values, { [a]: "4.10", [b]: "3.65", [c]: "4.80" });
  matrix.items[0].criteria[0].scores[a] = 1;
  assert.deepEqual(applySuggestions(matrix).items[0].criteria[0].scores, { [a]: 1, [b]: 5, [c]: 1 });
});

test("RFQ: price outlier when more than 15% above the average of the other offers", () => {
  const ms = ["a", "b", "c"].map(id => ({ id, name: id }));
  assert.deepEqual(priceOutliers(crit(1, {}, "unitPrice", { a: "4.10", b: "3.65", c: "4.80" }), ms), ["c"]);
  assert.deepEqual(priceOutliers(crit(1, {}, "unitPrice", { a: "4.00", b: "4.20", c: "4.40" }), ms), []);
});

test("RFQ: removing a manufacturer drops its values, scores and notes", () => {
  const matrix = createDemoMatrix(), id = matrix.manufacturers[1].id;
  const next = removeManufacturer(matrix, id);
  const text = JSON.stringify(next);
  assert.equal(next.manufacturers.length, 2);
  assert.ok(!text.includes(id));
});

test("RFQ demo: valid, flagged, fictional names, all three scored and a recommendation", () => {
  const matrix = createDemoMatrix();
  assert.doesNotThrow(() => validateMatrix(matrix));
  assert.equal(matrix.isDemo, true);
  assert.ok(matrix.manufacturers.every(item => item.name.endsWith("(demo)")));
  const result = totals(matrix);
  assert.ok(result.rows.every(row => row.total > 0 && row.total <= 100));
  assert.equal(result.recommended.length, 1);
  assert.equal(result.ranking[0].name, "Bursa Terry Mills (demo)");
  assert.deepEqual(priceOutliers(matrix.items[0].criteria[0], matrix.manufacturers), [matrix.manufacturers[2].id]);
  // Firestore rejects undefined anywhere in the document.
  assert.ok(!JSON.stringify(matrix, (_key, value) => value === undefined ? "__undefined__" : value).includes("__undefined__"));
  const csv = toCsv(matrix);
  assert.ok(csv.includes("TOTAL SCORE (/100)") && csv.includes("\"Hotel-grade bath towel 600 GSM, 70x140 cm – UK brand, 3,000 pcs\""));
  console.log("  demo totals:", result.ranking.map(row => `${row.name} ${row.total}`).join(" | "));
});
