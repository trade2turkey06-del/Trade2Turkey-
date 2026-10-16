import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Updates only the fields present in a JSON file on an existing Sectors directory company; other fields stay untouched.
// Usage: node scripts/update-company.mjs <companyId> <file.json> [--apply]   (dry run without --apply)
const [id, file] = process.argv.slice(2).filter(arg => !arg.startsWith("--"));
const apply = process.argv.includes("--apply");
if (!id || !file) throw new Error("Kullanım: node scripts/update-company.mjs <firmaId> <dosya.json> [--apply]");
const data = JSON.parse(await fs.readFile(file, "utf8"));
const config = JSON.parse(await fs.readFile(path.join(os.homedir(), ".config/configstore/firebase-tools.json"), "utf8"));
const token = config.tokens?.access_token;
if (!token) throw new Error("Firebase CLI oturumu gerekli (firebase login).");
const project = "planar-folio-h6m9v", database = "ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7";
const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents/directoryCompanies/${id}`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const value = item => Array.isArray(item) ? { arrayValue: { values: item.map(value) } } : typeof item === "boolean" ? { booleanValue: item } : typeof item === "object" ? { mapValue: { fields: fields(item) } } : { stringValue: String(item) };
const fields = object => Object.fromEntries(Object.entries(object).map(([key, item]) => [key, value(item)]));

const current = await fetch(url, { headers });
if (!current.ok) throw new Error(`directoryCompanies/${id} bulunamadı: ${current.status}`);
const before = (await current.json()).fields;
for (const key of Object.keys(data)) {
  const old = before[key]?.stringValue ?? (before[key]?.arrayValue ? `[${(before[key].arrayValue.values || []).length} kayıt]` : "—");
  const next = Array.isArray(data[key]) ? `[${data[key].length} kayıt]` : String(data[key]).replace(/\n/g, " ⏎ ");
  console.log(`${key}: ${String(old).slice(0, 60)}  →  ${next.slice(0, 90)}`);
}
if (!apply) { console.log("\n[prova] Hiçbir şey yazılmadı. Yazmak için --apply ile çalıştırın."); process.exit(0); }
const mask = [...Object.keys(data), "updatedAt"].map(key => `updateMask.fieldPaths=${key}`).join("&");
const response = await fetch(`${url}?currentDocument.exists=true&${mask}`, { method: "PATCH", headers, body: JSON.stringify({ fields: { ...fields(data), updatedAt: { timestampValue: new Date().toISOString() } } }) });
if (!response.ok) throw new Error(`Güncellenemedi: ${response.status} ${(await response.json()).error?.message || ""}`);
console.log(`\ngüncellendi: directoryCompanies/${id}`);
