import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Creates the "Hazır Giyim" sector and its first three companies in the Sectors directory.
// Dry run by default; pass --apply to write. Creates only — an existing id makes the request fail instead of overwriting.
const apply = process.argv.includes("--apply");
const config = JSON.parse(await fs.readFile(path.join(os.homedir(), ".config/configstore/firebase-tools.json"), "utf8"));
const token = config.tokens?.access_token;
if (!token) throw new Error("Firebase CLI oturumu gerekli (firebase login).");
const project = "planar-folio-h6m9v", database = "ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7";
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents`;

const sectorId = "hazir-giyim";
const blank = { website: "", catalogUrl: "", description: "", foundedYear: "", employees: "", location: "", address: "", phone: "", email: "", products: "", certificates: "", capacity: "", markets: "", notes: "", contacts: [] };
const companies = {
  "kigili": {
    name: "Kiğılı Giyim Tic. A.Ş.", website: "https://corporate.kigili.com/",
    foundedYear: "1938", employees: "1.500–1.999", location: "İstanbul, Türkiye",
    address: "Esas Aeropark, Yenişehir Mah., Osmanlı Bulvarı No:11 Kat:B2, Pendik / İstanbul (Genel Merkez)",
    products: "Erkek giyim; takım elbise, ceket, gömlek, pantolon, triko, dış giyim, aksesuar",
    notes: "Telefon ve yetkili kişi doğrulanmadı.",
  },
  "sarar": {
    name: "Sarar", website: "https://sarar.com/",
    foundedYear: "1944", employees: "2.000–2.999", location: "Eskişehir, Türkiye",
    address: "Organize Sanayi Bölgesi, Mümtaz Zeytinoğlu Bulvarı, 8. Cadde No:2, Odunpazarı / Eskişehir",
    products: "Erkek ve kadın giyim; takım elbise, ceket, gömlek, palto, Sarev ev tekstili, markalar için fason (private label) üretim",
    notes: "Telefon ve yetkili kişi doğrulanmadı.",
  },
  "anadolu-moda-demo": {
    name: "Anadolu Moda Konfeksiyon Ltd. Şti.", isDemo: true,
    foundedYear: "2009", employees: "150–200", location: "Bursa, Türkiye", address: "Nilüfer OSB, 3. Cadde No:14, Nilüfer / Bursa",
    phone: "0224 000 00 00 (örnek)",
    products: "Kadın ve erkek hazır giyim, örme t-shirt ve sweatshirt, denim, private label üretim, ihracata yönelik küçük/orta seri sipariş",
    notes: "DEMO / KURGUSAL FİRMA – gerçek bir tedarikçi değildir.",
    contacts: [{ id: "anadolu-moda-elif-demir", name: "Elif Demir (örnek)", title: "", phone: "", email: "" }],
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

await create(`sectors/${sectorId}`, { name: "Hazır Giyim", archived: false });
for (const [id, company] of Object.entries(companies)) await create(`directoryCompanies/${id}`, { ...blank, ...company, sectorId });
if (!apply) console.log("Hiçbir şey yazılmadı. Yazmak için --apply ile çalıştırın.");
