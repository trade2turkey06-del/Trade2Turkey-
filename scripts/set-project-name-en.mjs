import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Writes only the optional English project name (projects/{id}.nameEn). Idempotent: projects that already have a
// nameEn are skipped, `name` and every other field stay untouched, and the write fails if the project changed after
// it was read (updateTime precondition). Usage: node scripts/set-project-name-en.mjs [--apply]   (dry run without --apply)
const PROPOSALS = {
  "PROJE-MEYVE-SUYU": "Fruit Juice Project",
  "PROJE-UNLU MAMÜLLER": "Bakery Products Project",
};
const apply = process.argv.includes("--apply");
const config = JSON.parse(await fs.readFile(path.join(os.homedir(), ".config/configstore/firebase-tools.json"), "utf8"));
const token = config.tokens?.access_token;
if (!token) throw new Error("Firebase CLI oturumu gerekli (firebase login).");
const project = "planar-folio-h6m9v", database = "ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7";
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents/projects`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const list = await fetch(`${base}?pageSize=300&mask.fieldPaths=name&mask.fieldPaths=nameEn`, { headers });
if (!list.ok) throw new Error(`Projeler okunamadı: ${list.status} ${await list.text()}`);
const documents = (await list.json()).documents ?? [];
const plan = documents.map(document => {
  const id = decodeURIComponent(document.name.split("/").pop()), fields = document.fields ?? {};
  const name = fields.name?.stringValue ?? "", current = fields.nameEn?.stringValue ?? "", proposal = PROPOSALS[id];
  const action = current.trim() ? "skip: nameEn already set" : !proposal ? "skip: no proposal (name already English / not listed)" : "write";
  return { id, name, current, proposal, action, updateTime: document.updateTime, path: document.name };
});
for (const item of plan) console.log(`${item.id} | name: ${item.name} | nameEn: ${item.current || "—"} → ${item.action === "write" ? item.proposal : item.action}`);
const writes = plan.filter(item => item.action === "write");
if (!apply) { console.log(`\n[prova] ${writes.length} proje yazılacak. Hiçbir şey yazılmadı; yazmak için --apply ile çalıştırın.`); process.exit(0); }
for (const item of writes) {
  const url = `https://firestore.googleapis.com/v1/${item.path}?updateMask.fieldPaths=nameEn&currentDocument.updateTime=${encodeURIComponent(item.updateTime)}`;
  const response = await fetch(url, { method: "PATCH", headers, body: JSON.stringify({ fields: { nameEn: { stringValue: item.proposal } } }) });
  console.log(`${item.id}: ${response.ok ? "nameEn yazıldı" : `HATA ${response.status} ${await response.text()}`}`);
}
