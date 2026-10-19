import test from "node:test";
import assert from "node:assert/strict";
import { nameLocale, projectDisplayName, projectNameById, rememberProjectNames } from "../src/lib/projectName";

test("proje adı: EN'de nameEn, yoksa Türkçe ad; TR'de her zaman Türkçe ad", () => {
  const project = { id: "PROJE-UNLU MAMÜLLER", name: "Unlu Mamüller Projesi", nameEn: "Bakery Products Project" };
  assert.equal(projectDisplayName(project, "en"), "Bakery Products Project");
  assert.equal(projectDisplayName(project, "tr"), "Unlu Mamüller Projesi");
  assert.equal(projectDisplayName({ name: "Meyve Suyu Projesi" }, "en"), "Meyve Suyu Projesi");
  assert.equal(projectDisplayName({ name: "Meyve Suyu Projesi", nameEn: "  " }, "en"), "Meyve Suyu Projesi", "blank English name falls back");
  assert.equal(projectDisplayName(undefined, "en", "Workspace"), "Workspace");
});

test("proje adı: büyük harf arayüz diline göre (EN'de Türkçe İ yok)", () => {
  assert.equal("Unlu Mamüller Projesi".toLocaleUpperCase(nameLocale("en")), "UNLU MAMÜLLER PROJESI");
  assert.equal("Unlu Mamüller Projesi".toLocaleUpperCase(nameLocale("tr")), "UNLU MAMÜLLER PROJESİ");
  assert.equal(nameLocale("en"), "en-US");
  assert.equal(nameLocale("tr"), "tr-TR");
});

test("proje adı: kimlikten ad; eski düz metin kayıtları ve bilinmeyen kimlikler", () => {
  const scope = globalThis as any, previous = scope.window;
  scope.window = {};
  try {
    rememberProjectNames([{ id: "P1", name: "Meyve Suyu Projesi", nameEn: "Fruit Juice Project" }, { id: "P2", name: "Örnek" }]);
    assert.equal(projectNameById("P1", "en"), "Fruit Juice Project");
    assert.equal(projectNameById("P1", "tr"), "Meyve Suyu Projesi");
    assert.equal(projectNameById("P2", "en"), "Örnek");
    assert.equal(projectNameById("NONE", "en"), "NONE");
    scope.window.PROJECT_NAMES = { OLD: "Eski Proje" }; // format of older sessions
    assert.equal(projectNameById("OLD", "en"), "Eski Proje");
    scope.window = undefined;
    assert.equal(projectNameById("PROJE-UNLU MAMÜLLER", "en"), "Bakery Products Project", "static fallback");
  } finally { scope.window = previous; }
});
