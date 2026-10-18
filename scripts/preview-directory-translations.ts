// Copies a reviewed snapshot ONLY to a loopback demo emulator. Never writes live.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {emulatorTarget} from '../tests/seed-guard.mjs';
const {projectId}=emulatorTarget();
if(process.argv.length!==4)throw new Error('Usage: preview-directory-translations.ts <source.json> <review.json>');
const raw=await fs.readFile(process.argv[2],'utf8'),source=JSON.parse(raw),review=JSON.parse(await fs.readFile(process.argv[3],'utf8'));
if(crypto.createHash('sha256').update(raw).digest('hex')!==review.sourceSha256)throw new Error('Source checksum mismatch');
function decode(v:any):any {
 if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;
 if('arrayValue'in v)return (v.arrayValue.values||[]).map(decode);if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,v])=>[k,decode(v)]));if('timestampValue'in v)return new Date(v.timestampValue);throw new Error('Unsupported source type');
}
const db=getFirestore(initializeApp({projectId}));const batch=db.batch();
const paths=new Set(source.records.map((record:any)=>record.name.split('/documents/')[1]));
// Remove only leftover disposable directory fixtures in this guarded emulator.
for(const collection of ['sectors','directoryCompanies'])for(const record of (await db.collection(collection).get()).docs)if(!paths.has(record.ref.path))batch.delete(record.ref);
for(const record of source.records){
 const path=record.name.split('/documents/')[1];if(!/^(sectors|directoryCompanies)\/[^/]+$/.test(path))throw new Error('Out-of-scope path');
 const data:any=Object.fromEntries(Object.entries(record.fields).map(([k,v])=>[k,decode(v)]));
 const translations={...data.translations,en:{...data.translations?.en}};
 for(const row of review.rows.filter((r:any)=>r.record===path)){
  if(!row.en?.trim())throw new Error('Empty translation');
  if(row.field.startsWith('contactTitles.')){const id=row.field.slice('contactTitles.'.length);if(!data.contacts?.some((p:any)=>p.id===id&&p.title===row.tr))throw new Error('Contact source mismatch');translations.en.contactTitles={...translations.en.contactTitles,[id]:row.en};}
  else {if(data[row.field]!==row.tr)throw new Error('Source mismatch');translations.en[row.field]=row.en;}
 }
 batch.set(db.doc(path),{...data,translations});
}
await batch.commit();console.log(JSON.stringify({emulator:projectId,records:source.records.length,translations:review.rows.length,liveWrites:0}));
