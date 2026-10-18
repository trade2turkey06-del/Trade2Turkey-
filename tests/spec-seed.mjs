// Ürün reçetesi (A.B.8) arayüz testi için kurgusal "Unlu Mamüller" verisi. Tüm firma adları, dosya adları ve değerler
// örnektir. Besin değerleri, reçetede protein enerji oranı %30,4 ve tuz "Yüksek" sonucunu verecek şekilde seçildi.
// Önce tests/ui-seed.mjs çalıştırılmalıdır (yönetici hesabı). Yalnızca emülatöre yazar (bkz. seed-guard.mjs).
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { emulatorTarget } from "./seed-guard.mjs";

const { projectId, firestore } = emulatorTarget();
const PROJECT = "PROJE-UNLU MAMÜLLER", MAIN = "ornek-uretici-1", PARTIAL = "ornek-uretici-2";

// Onaylayan hesabı: gönderen ve onaylayan farklı kişi olmalı; arayüzde onay için bu hesapla giriş yapılır.
const adminAuth = getAdminAuth(initializeAdminApp({ projectId }, "spec-seed"));
try { await adminAuth.getUser("approver"); } catch { await adminAuth.createUser({ uid: "approver", email: "approver@t2t.test", password: "DemoOnly-123456!" }); }
await adminAuth.setCustomUserClaims("approver", { admin: true });

const vault = {
  pricingCapacity: { exwPriceList: "ornek_exw_fiyat_listesi.pdf", moq: "Deneme siparişi için 1x 40' HC (örnek)", monthlyCapacity: "30 x 40' HC / ay (örnek)" },
  productionTransit: { productionFirstOrder: "İlk sipariş 4-6 hafta (örnek)", productionRepeatOrder: "Tekrar sipariş 2-4 hafta (örnek)", shipmentTransitTime: "8-10 iş günü (örnek)" },
  storageShelfLife: { frozenProducts: "Donuk: -18°C'de 18 ay (örnek)", ambientProducts: "Ortam: 22-24°C, kuru ortamda 12 ay (örnek)" },
  certifications: { coa: "ornek_tortilla_coa.pdf", certificates: ["Örnek Gıda Güvenliği Sertifikası", "Örnek Helal Sertifikası"] },
  palletContainerConfig: { boxDimensions: "Koli 52x29,5x20 cm, 12 x 400 g (örnek)", palletConfig: "Palet 80x120 cm, 72 koli (örnek)", containerCapacity40HC: "40' HC: 25 palet (örnek)" },
  // 20 g × 4 / 263 kcal = %30,4 protein enerji oranı; tuz 1,96 g > 1,5 g → "Yüksek". Türkçe virgüllü yazım bilerek karışık.
  nutritionalValues: { energy: "1108 kJ / 263 kcal", fat: "5,87g", fatSaturated: "3,19g", carbohydrates: "32.00g", sugar: "6,18g", protein: "20.00g", fiber: "3,87g", salt: "1,96g" },
  variations: ["Sade Tortilla (örnek)", "Tam Buğday Tortilla (örnek)"],
  marketingSamples: "Örnek numune notu.",
  exportMarkets: [{ name: "Almanya", flag: "🇩🇪" }, { name: "Hollanda", flag: "🇳🇱" }],
  productClaims: ["Katkısız", "Yüksek Protein", "Vegan"],
};
const approvedStep = (id, extra = {}) => ({
  id: `sourcing-${id}`, projectId: PROJECT, stepId: id, workflow: "sourcing", section: "A", workflowStatus: "completed", approval: "approved", status: "Completed",
  assigneeUid: "approver", approverUid: "approver", completedBy: "approver", decidedBy: "approver", dueDate: "2026-10-20",
  evidenceName: `ornek_${id.replace(/\./g, "_")}_belgesi.pdf`, evidenceUrl: "https://example.com/ornek-belge", ...extra,
});

const env = await initializeTestEnvironment({ projectId, firestore: { host: firestore.host, port: firestore.port } });
await env.withSecurityRulesDisabled(async context => {
  const db = context.firestore();
  await setDoc(doc(db, "users/approver"), { id: "approver", email: "approver@t2t.test", companyName: "Yerel Onaylayan", role: "admin", projectId: "DEMO", assignedProjects: ["DEMO", PROJECT], status: "active" }, { merge: true });
  await setDoc(doc(db, "projects", PROJECT), {
    id: PROJECT, name: "Unlu Mamüller (örnek veri)", description: "Kurgusal emülatör verisi", status: "active",
    packaging_config: { productVariant: "Sade Tortilla", singleWeight: 0.4, packagingStyle: "PP poşet (örnek)", innerBoxCount: 0, masterCartonCount: 12, palletCartonCount: 72, cartonNetWeight: 4.8, cartonGrossWeight: 5.2, cartonDimensions: "52x29,5x20 cm", totalGrossWeight: 0 },
  }, { merge: true });
  await setDoc(doc(db, "projects", PROJECT, "manufacturers", MAIN), { id: MAIN, name: "Kuzey Ovası Fırıncılık A.Ş. (kurgusal)", vaultDetails: vault });
  // Bilerek eksik kasa verisi: Belge Kasası "Belirtilmedi" göstermeli, Tedarik sekmesi çökmemeli.
  await setDoc(doc(db, "projects", PROJECT, "manufacturers", PARTIAL), { id: PARTIAL, name: "Güney Vadisi Unlu Ürünler Ltd. (kurgusal, eksik veri)", vaultDetails: { productClaims: ["Lif Kaynağı"] } });
  // A.A.1–A.B.6 onaylı; A.B.7 onaylı ve yüksek potansiyelli üretici olarak MAIN seçili. A.B.8 ve sonrası arayüzde test edilir.
  const steps = ["A.A.1", "A.A.2", "A.A.3", "A.A.4", "A.A.5", "A.A.6", "A.A.7", "A.B.1", "A.B.2", "A.B.3", "A.B.4", "A.B.5", "A.B.6"];
  for (const id of steps) await setDoc(doc(db, "sopSteps", `${PROJECT}_sourcing-${id}`), approvedStep(id));
  await setDoc(doc(db, "sopSteps", `${PROJECT}_sourcing-A.B.7`), approvedStep("A.B.7", { highPotentialManufacturerId: MAIN, highPotentialManufacturerName: "Kuzey Ovası Fırıncılık A.Ş. (kurgusal)" }));
});
await env.cleanup();
console.log(`"${PROJECT}" örnek verisi hazır. Onaylayan hesabı: approver@t2t.test / DemoOnly-123456!`);
