import test from "node:test";
import assert from "node:assert/strict";
import {
  approvalErrors, applyVaultNutrition, claimStatus, costLinesFromSpec, createSpec, DEFAULT_THRESHOLDS, emptyFormulationRow, formulationTotal, level, newVersionFrom,
  nextVersion, nutritionDiff, packagingDiff, applyVaultPackaging, parseDecimal, parseEnergy, parseGrams, parseVaultNutrition, proteinEnergyPct, requiredManufacturerId,
  specLinkValid, totalIsComplete, UNIT_WEIGHT_ROW, withinTolerance, type ProductSpec,
} from "../src/domain/productSpec";

const base = () => createSpec({ projectId: "p", manufacturerId: "m1", manufacturerName: "Üretici", productName: "Tortilla", preparedBy: "Test", createdBy: "u" });
const withWeight = (spec: ProductSpec, grams: string) => ({ ...spec, physical: spec.physical.map(row => row.id === UNIT_WEIGHT_ROW ? { ...row, target: grams } : row) });
const EU = DEFAULT_THRESHOLDS.find(item => item.id === "EU")!, UK = DEFAULT_THRESHOLDS.find(item => item.id === "UK")!;

test("reçete: Türkçe ve İngilizce ondalıklar ile birimler doğru okunur", () => {
  assert.equal(parseDecimal("5,87"), 5.87); assert.equal(parseDecimal("5.87"), 5.87); assert.equal(parseDecimal("1.108,5"), 1108.5); assert.equal(parseDecimal("abc"), null); assert.equal(parseDecimal("1,2,3"), null);
  assert.equal(parseGrams("5,87g"), 5.87); assert.equal(parseGrams("32.00g"), 32); assert.equal(parseGrams("350 mg"), 0.35); assert.equal(parseGrams("5,87 g / 100 g"), 5.87); assert.equal(parseGrams("6"), 6);
  assert.equal(parseGrams("5 oz"), null); assert.equal(parseGrams("yaklaşık 5"), null); assert.equal(parseGrams("<0,5 g"), null);
  assert.deepEqual(parseEnergy("1108 kJ / 263 kcal"), { kj: 1108, kcal: 263 }); assert.deepEqual(parseEnergy("1.108 kJ / 263,5 kcal"), { kj: 1108, kcal: 263.5 }); assert.deepEqual(parseEnergy("263 kcal"), { kj: null, kcal: 263 });
});
test("reçete: okunamayan kasa değeri 0 olmaz, boş kalır ve uyarı verir", () => {
  const { values, issues } = parseVaultNutrition({ energy: "1108 kJ / 263 kcal", fat: "5,87g", fatSaturated: "3.19g", carbohydrates: "32.00g", sugar: "6.18g", protein: "20.00g", fiber: "bilinmiyor", salt: "" });
  assert.equal(values.fat, 5.87); assert.equal(values.energyKcal, 263); assert.equal(values.fiber, undefined); assert.equal(values.salt, undefined);
  assert.deepEqual(issues.map(issue => [issue.key, issue.kind]), [["fiber", "unreadable"], ["salt", "missing"]]);
  const filled = applyVaultNutrition(base().nutrition, values);
  assert.equal(filled.fat.actual, 5.87); assert.equal(filled.fiber.actual, null); assert.equal(filled.salt.actual, null);
  assert.deepEqual(nutritionDiff({ ...filled, fat: { ...filled.fat, actual: 6 } }, values).map(item => item.key), ["fat"]);
});
test("reçete: oran toplamı, tolerans ve protein enerji oranı", () => {
  const rows = [50, 30, 19.5].map(ratio => ({ ...emptyFormulationRow(), name: "x", ratio }));
  assert.equal(formulationTotal(rows), 99.5); assert.equal(totalIsComplete(99.5), false);
  assert.equal(totalIsComplete(formulationTotal([33.33, 33.33, 33.34].map(ratio => ({ ...emptyFormulationRow(), ratio })))), true);
  assert.equal(withinTolerance({ target: 20, actual: 21, tolerance: 5 }), true); assert.equal(withinTolerance({ target: 20, actual: 22, tolerance: 5 }), false); assert.equal(withinTolerance({ target: 20, actual: null, tolerance: 5 }), null);
  const spec = base(); spec.nutrition.protein.actual = 20; spec.nutrition.energyKcal.actual = 263;
  assert.equal(proteinEnergyPct(spec.nutrition), 30.4);
  spec.nutrition.energyKcal = { target: 300, actual: null, tolerance: null };
  assert.equal(proteinEnergyPct(spec.nutrition), 26.7, "gerçekleşen yoksa hedef kullanılır");
});
test("reçete: pazar eşikleri ile seviye ve iddia durumu", () => {
  assert.equal(level(1.96, UK.levels.salt), "high"); assert.equal(level(0.2, UK.levels.salt), "low"); assert.equal(level(1, UK.levels.salt), "medium"); assert.equal(level(null, UK.levels.salt), "unknown");
  const spec = base(); spec.nutrition.protein.actual = 20; spec.nutrition.energyKcal.actual = 263;
  spec.formulation = [{ ...emptyFormulationRow(), name: "Un", vegan: true, halal: true }, { ...emptyFormulationRow(), name: "Yumurta", vegan: false, halal: true }];
  assert.equal(claimStatus("Yüksek Protein", spec, EU).status, "ok"); assert.equal(claimStatus("high protein", spec, EU).status, "ok");
  assert.equal(claimStatus("Vegan", spec, EU).status, "fail"); assert.equal(claimStatus("Helal", spec, EU).status, "ok");
  assert.equal(claimStatus("Katkısız", spec, EU).status, "check"); assert.equal(claimStatus("Glutensiz", spec, EU).status, "check");
  spec.nutrition.protein.actual = 6;
  assert.equal(claimStatus("Protein Kaynağı", spec, EU).status, "fail");
  const custom = { ...EU, claims: EU.claims.map(rule => rule.id === "source-protein" ? { ...rule, value: 9 } : rule) };
  assert.equal(claimStatus("Protein Kaynağı", spec, custom).status, "ok", "eşik ayardan okunur");
});
test("reçete: A.B.9 maliyet satırları oran × birim gramajdan hesaplanır, fiyat alanları boş gelir", () => {
  const spec = withWeight(base(), "400");
  spec.formulation = [{ ...emptyFormulationRow(), name: "Un", ratio: 50 }, { ...emptyFormulationRow(), name: "Su", ratio: null }, { ...emptyFormulationRow(), name: "  " }];
  spec.packaging = spec.packaging.map(row => row.level === "primary" ? { ...row, material: "PP poşet", quantity: 1, perUnits: 1 } : row.level === "secondary" ? { ...row, material: "Koli", quantity: 1, perUnits: 12 } : row);
  const { lines, source } = costLinesFromSpec(spec);
  assert.deepEqual(lines.map(line => [line.source, line.materialName, line.quantityPerUnit, line.unit]), [["formulation", "Un", 0.2, "kg"], ["formulation", "Su", null, "kg"], ["packaging", "PP poşet", 1, "pcs"], ["packaging", "Koli", 0.083333, "pcs"]]);
  for (const line of lines) assert.deepEqual([line.unitPrice, line.currency, line.fxRate, line.wastePct, line.priceSource, line.priceDate], [null, "", null, null, "", ""]);
  assert.equal(source.unitWeightG, 400); assert.equal(source.version, "v1.0");
  assert.equal(costLinesFromSpec(base()).lines.length, 0);
});
test("reçete: versiyonlama, onay koşulları ve A.B.8 bağlantısı", () => {
  const fresh = base();
  assert.deepEqual(fresh.physical.map(row => [row.key, row.name]), [["unitWeight", ""], ["diameter", ""], ["thickness", ""], ["color", ""], ["moisture", ""]], "varsayılan satırlar dilden bağımsız anahtarla saklanır");
  assert.equal(nextVersion("v1.0"), "v1.1"); assert.equal(nextVersion("v1.9"), "v1.10");
  const spec = base();
  assert.deepEqual(approvalErrors(spec), ["t2t", "manufacturer"]);
  spec.approval = { trade2turkey: { name: "A", date: "2026-10-18" }, manufacturer: { name: "B", date: "2026-10-18" }, signedDocName: "", signedDocUrl: "http://x" };
  assert.deepEqual(approvalErrors(spec), ["signedDocUrl"]);
  spec.formulation = [{ ...emptyFormulationRow(), name: "Un", ratio: 99 }];
  assert.deepEqual(approvalErrors(spec), ["formulationTotal", "signedDocUrl"]);
  spec.formulation = [{ ...emptyFormulationRow(), name: "Un", ratio: 100 }];
  const next = newVersionFrom({ ...spec, status: "approved", approvedBy: "u" }, "u2");
  assert.equal(next.version, "v1.1"); assert.equal(next.status, "draft"); assert.equal(next.previousVersionId, spec.id); assert.equal(next.lineageId, spec.lineageId);
  assert.notEqual(next.id, spec.id); assert.equal(next.approval.trade2turkey.name, ""); assert.equal(next.formulation[0].name, "Un"); assert.equal("approvedBy" in next, false);
  assert.equal(requiredManufacturerId({ highPotentialManufacturerId: "m1" }, { specManufacturerId: "m2" }), "m1");
  assert.equal(requiredManufacturerId({}, { specManufacturerId: "m2" }), "m2");
  assert.equal(specLinkValid({ status: "approved", manufacturerId: "m1" }, "m1"), true);
  assert.equal(specLinkValid({ status: "review", manufacturerId: "m1" }, "m1"), false);
  assert.equal(specLinkValid({ status: "approved", manufacturerId: "m2" }, "m1"), false);
  assert.equal(specLinkValid(undefined, "m1"), false);
});
test("reçete: ambalaj kasadan tek yönlü dolar ve farklar listelenir (kasa ağırlığı kg → reçete g)", () => {
  const config = { packagingStyle: "PP poşet", singleWeight: 0.4, masterCartonCount: 12, palletCartonCount: 72, cartonDimensions: "52x29.5x20 cm" };
  const filled = applyVaultPackaging(base(), config);
  assert.deepEqual(filled.packaging.map(row => [row.level, row.material, row.quantity, row.perUnits]), [["primary", "PP poşet", 1, 1], ["secondary", "Koli", 1, 12], ["pallet", "Palet", 1, 864], ["label", "", null, null]]);
  assert.equal(filled.physical.find(row => row.id === UNIT_WEIGHT_ROW)!.target, "400");
  assert.deepEqual(packagingDiff(filled, config), []);
  const changed = { ...filled, packaging: filled.packaging.map(row => row.level === "secondary" ? { ...row, perUnits: 10 } : row) };
  assert.deepEqual(packagingDiff(changed, config).map(item => [item.level, item.field]), [["secondary", "perUnits"]]);
  assert.deepEqual(packagingDiff(base(), undefined), []);
  const english = applyVaultPackaging(base(), config, { carton: "Carton", pallet: "Pallet" });
  assert.deepEqual(english.packaging.map(row => row.material), ["PP poşet", "Carton", "Pallet", ""]);
  assert.equal(english.packaging[0].size, "400 g");
});
