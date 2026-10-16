import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Adds three Havlu (sectorId "towel") companies to the Sectors directory.
// Dry run by default; pass --apply to write. Creates only — an existing id makes the request fail instead of overwriting.
const apply = process.argv.includes("--apply");
const config = JSON.parse(await fs.readFile(path.join(os.homedir(), ".config/configstore/firebase-tools.json"), "utf8"));
const token = config.tokens?.access_token;
if (!token) throw new Error("Firebase CLI oturumu gerekli (firebase login).");
const project = "planar-folio-h6m9v", database = "ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7";
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents`;

const blank = { website: "", catalogUrl: "", description: "", foundedYear: "", employees: "", location: "", address: "", phone: "", email: "", products: "", certificates: "", capacity: "", markets: "", notes: "", contacts: [] };
const companies = {
  "gokhan-tekstil": {
    name: "Gökhan Tekstil (Soft Cotton)", website: "https://www.gokhan.com.tr",
    description: "1977'den beri faaliyet gösteren, Denizli merkezli havlu ve bornoz üreticisi. İplikten nakışa dikey entegre üretim; 1999'dan beri kendi markası Soft Cotton ile satış.",
    foundedYear: "1977", employees: "600+", location: "Denizli, Türkiye", address: "OSB, Fahri Karaca Cad. No:13, 20330 Honaz/Denizli",
    phone: "+90 258 269 15 65", email: "info@gokhan.com.tr",
    products: "Havlu, bornoz, ev ve yatak tekstili, iplik, dokuma kumaş",
    certificates: "OEKO-TEX Standard 100, GOTS, Control Union, ISO",
    capacity: "65.000 m² kapalı alan; aylık 400.000 m kumaş ve 100 ton havlu kumaşı; iplik, dokuma, boya-terbiye, konfeksiyon ve nakış tesisleri",
    markets: "Üretimin yaklaşık %95'i 4 kıtada 50+ ülkeye ihraç ediliyor; dünyaca bilinen markalara fason üretim; İstanbul bölge ofisi (Şişli)",
    notes: "Bilgiler firmanın web sitesinden ve Heimtextil 2027 katılımcı kaydından alınmıştır; doğrulanacak.",
  },
  "evliyaoglu-tekstil": {
    name: "Evliyaoğlu Tekstil (MaxxSoftHome)", website: "https://www.maxxsofthome.com",
    description: "1978'de iplik ticaretiyle başlayıp havlu ve bornoz üretimine geçen Denizli firması. Kendi ipliğini üretiyor; MaxxSoftHome® markasıyla 45 ülkeye satış.",
    foundedYear: "1978", location: "Denizli, Türkiye", address: "Denizli OSB Mah. Cafer Sadık Abalıoğlu Bulv. No:14, 20330 Honaz/Denizli",
    phone: "+90 258 269 14 50", email: "export@maxxsofthome.com",
    products: "Havlu, bornoz, paspas, otel tekstili, mutfak tekstili, baskılı dekoratif yastık",
    certificates: "GOTS, OEKO-TEX Standard 100, V-Label, Green Label, BSCI",
    capacity: "Kendi iplik üretimi; yeni ve çevre dostu üretim tesisleri",
    markets: "2002'den beri Avrupa'ya ihracat; bugün 45 ülkeye satış",
    notes: "Bilgiler 2025 Heimtextil fuar broşüründen alınmıştır; ilgili kişi güncelliği doğrulanacak.",
    contacts: [{ id: "evliyaoglu-emel-ozler", name: "Emel Özler", title: "Pazarlama Müdürü", phone: "+90 258 269 14 50", email: "export@maxxsofthome.com" }],
  },
  "makroteks-tekstil": {
    name: "Makroteks Tekstil", website: "https://www.makroteks.com",
    description: "1993'te kurulan, Denizli merkezli otel tekstili ve havlu üreticisi. Dokumadan paketlemeye entegre üretim; ABD'de ofis ve New York showroom'u.",
    foundedYear: "1993", location: "Denizli, Türkiye", address: "Akhan Mah. Atatürk Bulv. No:117, 20155 Pamukkale/Denizli",
    phone: "+90 258 274 65 95", email: "info@makroteks.com",
    products: "Otel tekstili, havlu, paspas, bornoz, mutfak havlusu, bebek ve çocuk ürünleri, nevresim",
    capacity: "11.500 m² kapalı alan; dokumadan paketlemeye entegre üretim hattı",
    markets: "27 ülkeye ihracat; ilk ihracat 1996'da ABD'ye. ABD ofisi Stratford, CT ve New York showroom'u (sales@makroteks.com, +1 860 371 4227). Markalar: Lunanino, Fabrikalite, Home & Bath, Salbakos, Classic Turkish Towels, Towels Beyond",
    notes: "Bilgiler firmanın web sitesinden alınmıştır; doğrulanacak.",
  },
};

const value = item => Array.isArray(item) ? { arrayValue: { values: item.map(value) } } : typeof item === "object" ? { mapValue: { fields: fields(item) } } : { stringValue: item };
const fields = object => Object.fromEntries(Object.entries(object).map(([key, item]) => [key, value(item)]));

for (const [id, company] of Object.entries(companies)) {
  const record = { ...blank, ...company, sectorId: "towel" };
  if (!apply) { console.log(`[prova] directoryCompanies/${id}: ${record.name} (${record.contacts.length} kişi)`); continue; }
  const response = await fetch(`${base}/directoryCompanies/${id}?currentDocument.exists=false`, {
    method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { ...fields(record), updatedAt: { timestampValue: new Date().toISOString() } } }),
  });
  if (!response.ok) throw new Error(`${id} yazılamadı: ${response.status} ${(await response.json()).error?.message || ""}`);
  console.log(`eklendi: directoryCompanies/${id} – ${record.name}`);
}
if (!apply) console.log("Hiçbir şey yazılmadı. Yazmak için --apply ile çalıştırın.");
