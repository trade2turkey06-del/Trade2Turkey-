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
