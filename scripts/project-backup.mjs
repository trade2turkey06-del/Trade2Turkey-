import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

// Read-only backup using the existing Firebase CLI login. Credentials never enter the export or logs.
const config = JSON.parse(await fs.readFile(path.join(os.homedir(), ".config/configstore/firebase-tools.json"), "utf8"));
const token = config.tokens?.access_token;
if (!token) throw new Error("Firebase CLI oturumu gerekli.");
const project = "planar-folio-h6m9v", database = "ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7";
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents`;
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers } });
  if (!response.ok) throw new Error(`Backup request failed: ${response.status} (${new URL(url).hostname})`);
  return response.json();
}
const records = [];
async function walk(parent) {
  let pageToken;
  do {
    const result = await request(`${parent}:listCollectionIds`, {method:"POST",body:JSON.stringify({pageSize:100,...(pageToken?{pageToken}:{})})});
    for (const name of result.collectionIds || []) {
      let next;
      do {
        const url=new URL(`${parent}/${name}`);url.searchParams.set("pageSize","300");if(next)url.searchParams.set("pageToken",next);
        const result=await request(url);
        for(const document of result.documents || []) {records.push(document);await walk(`https://firestore.googleapis.com/v1/${document.name}`);}
        next=result.nextPageToken;
      } while(next);
    }
    pageToken=result.nextPageToken;
  } while(pageToken);
}
await walk(base);
const accounts = await request(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchGet?maxResults=1000`);
// Only account identifiers and status are retained; password hashes and provider credentials are excluded.
const identities=(accounts.users || []).map(user=>({uid:user.localId,email:user.email,disabled:!!user.disabled,emailVerified:!!user.emailVerified}));
let rules = null;
try {
  const release = await request(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore/${database}`);
  rules = await request(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
} catch { console.log("Canlı kuralların kopyası alınamadı; yerel kurallar ayrıca sürüm kontrolünde."); }
const directory=path.join(process.cwd(),"backups",new Date().toISOString().replace(/[:.]/g,"-"));await fs.mkdir(directory,{recursive:true,mode:0o700});
const payload=JSON.stringify({version:1,project,database,createdAt:new Date().toISOString(),records,identities,rules},null,2);
await fs.writeFile(path.join(directory,"firestore.json"),payload,{mode:0o600});
const hash=crypto.createHash("sha256").update(payload).digest("hex");await fs.writeFile(path.join(directory,"sha256.txt"),hash+"\n",{mode:0o600});
const reread=await fs.readFile(path.join(directory,"firestore.json"),"utf8");if(crypto.createHash("sha256").update(reread).digest("hex")!==hash)throw new Error("Backup checksum mismatch");
JSON.parse(reread);
console.log(JSON.stringify({backup:directory,documents:records.length,identities:identities.length,checksumVerified:true}));
