import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Creates the "Meyve Suyu" sector and its first three companies in the Sectors directory.
// Dry run by default; pass --apply to write. Creates only — an existing id makes the request fail instead of overwriting.
const apply = process.argv.includes("--apply");
const config = JSON.parse(await fs.readFile(path.join(os.homedir(), ".config/configstore/firebase-tools.json"), "utf8"));
const token = config.tokens?.access_token;
if (!token) throw new Error("Firebase CLI oturumu gerekli (firebase login).");
const project = "planar-folio-h6m9v", database = "ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7";
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents`;

const sectorId = "meyve-suyu";
const blank = { website: "", catalogUrl: "", description: "", foundedYear: "", employees: "", location: "", address: "", phone: "", email: "", products: "", certificates: "", capacity: "", markets: "", notes: "", contacts: [] };
const companies = {
  "goknur": {
    name: "Göknur Gıda Maddeleri Enerji İmalat İthalat İhracat Tic. ve San. A.Ş.", location: "Niğde, Türkiye",
    products: "Meyve suyu konsantresi, meyve püresi, NFC meyve suyu, dondurulmuş meyve (elma, vişne, kayısı vb.)",
    notes: "Borsa İstanbul'da işlem görüyor (GOKNR), ihracatçı.",
  },
  "elite-naturel": {
    name: "Elite Naturel Organik Gıda San. ve Tic. A.Ş.", location: "Ankara, Türkiye",
    products: "Organik meyve suyu, soğuk sıkım meyve suları, shot'lar (zencefil vb.), organik gıda",
    certificates: "ROC (Regenerative Organic Certified)",
    notes: "Borsa İstanbul'da işlem görüyor (ELITE).",
  },
  "pmg": {
    name: "PMG", location: "Türkiye",
    products: "Meyve suyu",
  },
};

const value = item => Array.isArray(item) ? { arrayValue: { values: item.map(value) } } : typeof item === "boolean" ? { booleanValue: item } : typeof item === "object" ? { mapValue: { fields: fields(item) } } : { stringValue: item };
const fields = object => Object.fromEntries(Object.entries(object).map(([key, item]) => [key, value(item)]));
async function create(name, data) {
  if (!apply) { console.log(`[prova] ${name}: ${data.name}`); return; }
  const response = await fetch(`${base}/${name}?currentDocument.exists=false`, {
    method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { ...fields(data), updatedAt: { timestampValue: new Date().toISOString() } } }),
  });
  if (!response.ok) throw new Error(`${name} yazılamadı: ${response.status} ${(await response.json()).error?.message || ""}`);
  console.log(`eklendi: ${name} – ${data.name}`);
}

await create(`sectors/${sectorId}`, { name: "Meyve Suyu", archived: false });
for (const [id, company] of Object.entries(companies)) await create(`directoryCompanies/${id}`, { ...blank, ...company, sectorId });
if (!apply) console.log("Hiçbir şey yazılmadı. Yazmak için --apply ile çalıştırın.");
