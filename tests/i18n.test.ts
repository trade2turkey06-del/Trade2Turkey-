import test from "node:test";
import assert from "node:assert/strict";
import { tr } from "../src/i18n/tr";
import { en } from "../src/i18n/en";
import { errorMessage, formatters, messagesFor, withFallback, CodedError } from "../src/i18n";
import { sourcingWorkflow } from "../src/data/sourcingWorkflow";
import { workflowStatuses } from "../src/domain/workflow";
import { eventText } from "../src/lib/eventText";

// Her yaprak: [yol, tür, fonksiyon ise parametre sayısı]
function leaves(value: unknown, path = ""): [string, string, number][] {
  if (typeof value === "function") return [[path, "function", value.length]];
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  return [[path, typeof value, 0]];
}

test("i18n: tr ve en anahtarları, türleri ve fonksiyon parametreleri birebir eşleşir", () => {
  const trLeaves = leaves(tr), enLeaves = leaves(en);
  const trKeys = new Set(trLeaves.map(([path]) => path)), enKeys = new Set(enLeaves.map(([path]) => path));
  assert.deepEqual([...trKeys].filter(key => !enKeys.has(key)), [], "İngilizcesi olmayan anahtarlar");
  assert.deepEqual([...enKeys].filter(key => !trKeys.has(key)), [], "Türkçesi olmayan anahtarlar");
  const byPath = new Map(enLeaves.map(([path, kind, arity]) => [path, `${kind}/${arity}`]));
  assert.deepEqual(trLeaves.filter(([path, kind, arity]) => byPath.get(path) !== `${kind}/${arity}`).map(([path]) => path), []);
});
test("i18n: İngilizce metinler boş değil ve yasaklı terim içermiyor", () => {
  const collect = (value: unknown, path = ""): [string, string][] => typeof value === "string" ? [[path, value]] : value && typeof value === "object" ? Object.entries(value).flatMap(([key, child]) => collect(child, `${path}/${key}`)) : [];
  const strings = collect(en);
  assert.deepEqual(strings.filter(([, text]) => !text.trim()).map(([path]) => path), []);
  // Gıda alıcısı "Critical Control Point" ifadesini HACCP terimi olarak okur; A.B.12 için "Final Approval Gate" kullanılır.
  assert.deepEqual(strings.filter(([, text]) => /critical control point/i.test(text)).map(([path]) => path), []);
  assert.equal(en.steps["A.B.12"].name, "Final Approval Gate");
});
test("i18n: 21 tedarik adımı ve tüm durumlar iki dilde tanımlı; adım kodları dile göre değişmez", () => {
  const ids = sourcingWorkflow.map(step => step.id);
  assert.equal(ids.length, 21);
  for (const catalog of [tr, en]) {
    assert.deepEqual(Object.keys(catalog.steps).sort(), [...ids].sort());
    for (const id of ids) for (const field of ["name", "kpi", "output"] as const) assert.ok(catalog.steps[id][field].trim(), `${id}.${field}`);
    assert.deepEqual(Object.keys(catalog.status.workflow).sort(), Object.keys(workflowStatuses).sort());
    assert.deepEqual(Object.keys(catalog.sourcing.groups).sort(), ["A.A.", "A.B."]);
  }
  assert.equal(en.status.workflow.incomplete, "Returned for revision");
});
test("i18n: eksik İngilizce metinde Türkçesi gösterilir", () => {
  const proxied = withFallback({ a: "", nested: { b: undefined as unknown as string, c: "C" } }, { a: "A-tr", nested: { b: "B-tr", c: "C-tr" } }, "", new Map());
  assert.equal(proxied.a, "A-tr"); assert.equal(proxied.nested.b, "B-tr"); assert.equal(proxied.nested.c, "C");
  assert.equal(messagesFor("en").steps["A.A.1"].name, "Project Brief Approval");
});
test("i18n: sayı, para ve tarih biçimi dile göre değişir", () => {
  assert.equal(formatters("tr").number(1.96), "1,96"); assert.equal(formatters("en").number(1.96), "1.96");
  assert.match(formatters("tr").currency(1250.5, "USD"), /1\.250,50/); assert.match(formatters("en").currency(1250.5, "USD"), /1,250\.50/);
  assert.equal(formatters("tr").date("2026-10-18T12:00:00Z"), "18 Ekim 2026"); assert.equal(formatters("en").date("2026-10-18T12:00:00Z"), "18 October 2026");
});
test("i18n: domain hata kodları ve olay kayıtları seçili dilde gösterilir", () => {
  assert.equal(errorMessage(tr, new CodedError("prerequisites", { ids: "A.B.7" }), "x"), "Önce şu adımlar tamamlanıp onaylanmalı: A.B.7");
  assert.equal(errorMessage(en, new CodedError("prerequisites", { ids: "A.B.7" }), "x"), "These steps must be completed and approved first: A.B.7");
  assert.equal(errorMessage(en, new CodedError("conflict"), "x"), en.errors.conflict);
  assert.equal(errorMessage(en, new Error("raw"), "x"), "raw"); assert.equal(errorMessage(en, "?", "fallback"), "fallback");
  assert.equal(eventText(en, { statusKey: "completed", detail: "completed" }), "Completed");
  assert.equal(eventText(tr, { statusKey: "approved", detail: "approved" }), "Onaylandı");
  assert.equal(eventText(en, { detailKey: "shortlisted", detailParams: { name: "Acme" }, detail: "Acme" }), "Acme added to the shortlist (A.A.3)");
  assert.equal(eventText(en, { detail: "Tamamlandı" }), "Tamamlandı", "eski olaylardaki metin olduğu gibi gösterilir");
});
test("ülkeler: kasadaki adlar ISO koduna tam eşleşir, iki dilde gösterilir; bilinmeyen ad olduğu gibi kalır", async () => {
  const { COUNTRY_CODES, countryCode, countryFlag, marketFromName, marketLabel } = await import("../src/domain/countries");
  // Canlıdaki "Bakker" kaydının 16 pazarı (Türkçe adla saklı): hepsi tanınmalı.
  const live = ["Almanya", "KKTC", "Hollanda", "Gürcistan", "Fransa", "Azerbaycan", "Irak", "Bulgaristan", "Kuveyt", "İtalya", "İspanya", "Ukrayna", "Suudi Arabistan", "BAE", "Katar", "Bahreyn"];
  assert.deepEqual(live.filter(name => !countryCode(name)), []);
  assert.equal(countryCode("Ukrayna"), "UA", "eski eşleştirme 'uk' parçası yüzünden Ukrayna'ya İngiltere bayrağı veriyordu");
  assert.equal(countryCode("UK"), "GB"); assert.equal(countryCode("Italy"), "IT"); assert.equal(countryCode("U.A.E."), "AE"); assert.equal(countryCode("  germany "), "DE");
  assert.equal(countryCode("Türkmenistan"), "TM"); assert.equal(countryCode("Mars"), null);
  assert.equal(countryFlag("DE"), "🇩🇪"); assert.equal(countryFlag("NCY"), "🇨🇾"); assert.equal(countryFlag(null), "🏳️");
  assert.deepEqual(marketFromName("BAE"), { name: "BAE", flag: "🇦🇪", code: "AE" });
  assert.deepEqual(marketFromName("Mars"), { name: "Mars", flag: "🏳️" });
  assert.equal(marketLabel({ name: "KKTC", flag: "🇨🇾" }, en.countries).label, "Northern Cyprus");
  assert.equal(marketLabel({ name: "BAE", flag: "🇦🇪" }, en.countries).label, "United Arab Emirates");
  assert.equal(marketLabel({ name: "Almanya", flag: "🇩🇪" }, tr.countries).label, "Almanya");
  assert.deepEqual(marketLabel({ name: "Bilinmeyen Pazar", flag: "🏳️" }, en.countries), { code: null, label: "Bilinmeyen Pazar", flag: "🏳️", isData: true });
  assert.deepEqual(Object.keys(tr.countries).sort(), [...COUNTRY_CODES].sort());
});
test("kullanıcı verisi dili ve sayfa başlığı", async () => {
  const { dataLang } = await import("../src/i18n");
  assert.equal(dataLang("Unlu Mamüller Projesi"), "tr"); assert.equal(dataLang("Vegan Sertifikası"), "tr");
  assert.equal(dataLang("Sample Tortilla"), undefined, "İngilizce veri sayfa diliyle büyütülür"); assert.equal(dataLang(undefined), undefined);
  assert.equal(tr.shell.documentTitle, "Trade2Turkey Dijital Tedarik ve Lojistik Portalı");
  assert.equal(en.shell.documentTitle, "Trade2Turkey | Digital Sourcing & Logistics Portal");
});

test("i18n: yüzdeler yüzde puanı olarak dile göre biçimlenir", () => {
  assert.equal(formatters("en").percent(30.4, 1), "30.4%");
  assert.equal(formatters("tr").percent(30.4, 1), "%30,4");
  assert.match(en.productSpec.formulation.totalWarning("99.5"), /99\.5%/);
  assert.match(tr.productSpec.formulation.totalWarning("99,5"), /%99,5/);
  assert.equal(en.rfqMatrix.impact("Cost", 12.5), "Cost Impact (12.5%)");
  assert.equal(tr.rfqMatrix.impact("Maliyet", 12.5), "Maliyet etkisi (%12,5)");
  for (const lang of ["tr", "en"] as const) {
    const fmt = formatters(lang);
    assert.equal(fmt.percent(0), lang === "en" ? "0%" : "%0");
    assert.equal(fmt.percent(100), lang === "en" ? "100%" : "%100");
    assert.equal(fmt.percent(null), ""); assert.equal(fmt.percent(NaN), "");
    assert.equal(fmt.percent(12.345, 2, 2), lang === "en" ? "12.35%" : "%12,35");
  }
});

test("i18n: logistics has all 21 steps and approved terminology", async () => {
  const { logisticsWorkflow } = await import("../src/data/logisticsWorkflow");
  const ids = logisticsWorkflow.map(step => step.id).sort();
  assert.equal(ids.length, 21);
  for (const catalog of [tr, en]) assert.deepEqual(Object.keys(catalog.logistics.steps).sort(), ids);
  assert.equal(en.logistics.groups["B.A."].title, "Production & Shipment Coordination");
  assert.equal(en.logistics.steps["B.A.7"].name, "Quality Checkpoint – Raw Materials");
  assert(!/packaging/i.test(en.logistics.steps["B.A.7"].kpi));
  assert.match(en.logistics.steps["B.A.8"].kpi, /packaging materials received/);
  assert.equal(en.logistics.steps["B.A.10"].kpi, "Balance payment completed within agreed payment terms");
  assert.equal(en.logistics.steps["B.A.12"].kpi, "Goods released for dispatch after document and load check");
  assert.equal(tr.logistics.steps["B.A.12"].kpi, "Belge ve yükleme kontrolünden sonra sevkiyata çıkış onayı verildi");
});
