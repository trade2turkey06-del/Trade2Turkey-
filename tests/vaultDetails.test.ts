import test from "node:test";
import assert from "node:assert/strict";
import { emptyVaultDetails, normalizeVaultDetails, NOT_SPECIFIED, shown } from "../src/domain/vaultDetails";

// Ekranın okuduğu her iç içe alan: bölüm eksik olsa bile metin olmalı (önceden ilk okumada Tedarik sekmesi çöküyordu).
const nestedStrings = (details: ReturnType<typeof normalizeVaultDetails>) => [
  details.pricingCapacity.exwPriceList, details.pricingCapacity.moq, details.pricingCapacity.monthlyCapacity,
  details.productionTransit.productionFirstOrder, details.productionTransit.productionRepeatOrder, details.productionTransit.shipmentTransitTime,
  details.storageShelfLife.frozenProducts, details.storageShelfLife.ambientProducts, details.certifications.coa,
  details.palletContainerConfig.boxDimensions, details.palletContainerConfig.palletConfig, details.palletContainerConfig.containerCapacity40HC,
  ...Object.values(details.nutritionalValues), details.marketingSamples,
];

test("kasa: eksik bölümlü üretici kaydı güvenli varsayılanlarla tamamlanır", () => {
  for (const raw of [undefined, null, {}, [], "bozuk", { nutritionalValues: { protein: "20 g" }, productClaims: ["Vegan"] }]) {
    const details = normalizeVaultDetails(raw);
    for (const value of nestedStrings(details)) assert.equal(typeof value, "string");
    for (const list of [details.certifications.certificates, details.variations, details.exportMarkets, details.productClaims]) assert.ok(Array.isArray(list));
  }
  const partial = normalizeVaultDetails({ nutritionalValues: { protein: "20 g" }, productClaims: ["Vegan"] });
  assert.equal(partial.nutritionalValues.protein, "20 g"); assert.equal(partial.nutritionalValues.salt, ""); assert.deepEqual(partial.productClaims, ["Vegan"]);
  assert.equal(shown(partial.pricingCapacity.moq), NOT_SPECIFIED); assert.equal(shown("   "), NOT_SPECIFIED); assert.equal(shown("1x 40' HC"), "1x 40' HC");
  assert.deepEqual(emptyVaultDetails(), normalizeVaultDetails(undefined));
});
test("kasa: yanlış türdeki değerler okunur metne çevrilir, geçersiz liste öğeleri atılır", () => {
  const details = normalizeVaultDetails({
    pricingCapacity: { moq: 1200, monthlyCapacity: null, exwPriceList: { url: "x" } },
    certifications: "BRC", variations: ["Sade", 3, null, "  "],
    exportMarkets: [{ name: "Almanya", flag: "🇩🇪" }, { flag: "🏳️" }, "Fransa", null],
    productClaims: "Vegan",
  });
  assert.equal(details.pricingCapacity.moq, "1200"); assert.equal(details.pricingCapacity.monthlyCapacity, ""); assert.equal(details.pricingCapacity.exwPriceList, "");
  assert.deepEqual(details.certifications, { coa: "", certificates: [] });
  assert.deepEqual(details.variations, ["Sade", "3"]);
  assert.deepEqual(details.exportMarkets, [{ name: "Almanya", flag: "🇩🇪" }]);
  assert.deepEqual(details.productClaims, []);
});
test("kasa: eksiksiz kayıt değişmeden korunur", () => {
  const full = {
    pricingCapacity: { exwPriceList: "https://example.com/fiyat.pdf", moq: "1x 40' HC", monthlyCapacity: "45 konteyner" },
    productionTransit: { productionFirstOrder: "4-6 hafta", productionRepeatOrder: "2-4 hafta", shipmentTransitTime: "8-10 gün" },
    storageShelfLife: { frozenProducts: "-18°C 18 ay", ambientProducts: "12 ay" },
    certifications: { coa: "CoA", certificates: ["BRC", "Helal"] },
    palletContainerConfig: { boxDimensions: "52x29,5x20 cm", palletConfig: "72 koli", containerCapacity40HC: "25 palet" },
    nutritionalValues: { energy: "1108 kJ / 263 kcal", fat: "5,87g", fatSaturated: "3,19g", carbohydrates: "32g", sugar: "6,18g", protein: "20g", fiber: "3,87g", salt: "1,96g" },
    variations: ["Sade"], marketingSamples: "Hazırlanıyor", exportMarkets: [{ name: "Almanya", flag: "🇩🇪" }], productClaims: ["Vegan"],
  };
  assert.deepEqual(normalizeVaultDetails(full), full);
});
