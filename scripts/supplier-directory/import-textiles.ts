// Dry run: node --import tsx scripts/supplier-directory/import-textiles.ts
// Apply:   node --import tsx scripts/supplier-directory/import-textiles.ts --apply
// No deletes. Only the explicitly requested towel rename and Alasev sector move
// replace populated fields; supplier imports fill blanks and add tags. Atomic version guards.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {plan} from './textile-plan';
import type {RecordDoc} from './plan';
const args=process.argv.slice(2);if(args.some(a=>a!=='--apply'))throw Error('Only --apply is supported');
const apply=args.includes('--apply');
const config=JSON.parse(await fs.readFile('firebase-applet-config.json','utf8'));
const root=`projects/${config.projectId}/databases/${config.firestoreDatabaseId}`;
const auth=JSON.parse(await fs.readFile(path.join(os.homedir(),'.config/configstore/firebase-tools.json'),'utf8'));
if(!auth.tokens?.access_token||auth.tokens.expires_at<Date.now()+60000)throw Error('Refresh Firebase CLI authentication first.');
const headers={Authorization:`Bearer ${auth.tokens.access_token}`,'Content-Type':'application/json'};
async function request(url:string,body?:any){const r=await fetch(url,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(`Firestore ${r.status}: ${await r.text()}`);return r.json();}
function decode(v:any):any{if('stringValue'in v)return v.stringValue;if('booleanValue'in v)return v.booleanValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('timestampValue'in v)return v.timestampValue;if('arrayValue'in v)return(v.arrayValue.values||[]).map(decode);if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,v])=>[k,decode(v)]));return null;}
function encode(v:any):any{if(v===null)return{nullValue:null};if(Array.isArray(v))return{arrayValue:{values:v.map(encode)}};if(typeof v==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,v])=>[k,encode(v)]))}};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return{doubleValue:v};return{stringValue:v};}
async function read(){const docs:RecordDoc[]=[];for(const collection of ['sectors','directoryCompanies']){let pageToken='';do{const q=new URLSearchParams({pageSize:'300',...(pageToken?{pageToken}:{})});const data=await request(`https://firestore.googleapis.com/v1/${root}/documents/${collection}?${q}`);for(const d of data.documents||[])docs.push({path:d.name.split('/documents/')[1],updateTime:d.updateTime,data:decode({mapValue:{fields:d.fields}})});pageToken=data.nextPageToken||'';}while(pageToken);}return docs;}
const before=await read();const review:any[]=[];
const result=plan(before,review);
const directory=`backups/textile-import-${new Date().toISOString().replace(/[:.]/g,'-')}`;await fs.mkdir(directory,{recursive:true,mode:0o700});
await fs.writeFile(`${directory}/before.json`,JSON.stringify(before,null,2),{mode:0o600});
await fs.writeFile(`${directory}/plan.json`,JSON.stringify(result,null,2),{mode:0o600});
const summary={mode:apply?'apply':'dry-run',addedSectors:result.changes.filter(c=>c.create&&c.path.startsWith('sectors/')).map(c=>c.data.name),addedCompanies:result.changes.filter(c=>c.create&&c.path.startsWith('directoryCompanies/')).map(c=>c.data.name),updatedCompanies:result.changes.filter(c=>!c.create&&c.path.startsWith('directoryCompanies/')).map(c=>c.data.name),updatedSectors:result.changes.filter(c=>!c.create&&c.path.startsWith('sectors/')).map(c=>c.data.name),skippedCompanies:result.skipped,movedCompanies:result.moved,unverified:result.unverified,backup:directory};
console.log(JSON.stringify(summary,null,2));
if(apply&&result.changes.length){
 // Commit atomically; masks restrict existing records to planned fields.
 const writes=result.changes.map(c=>({update:{name:`${root}/documents/${c.path}`,fields:encode(c.data).mapValue.fields},...(c.create?{currentDocument:{exists:false}}:{updateMask:{fieldPaths:c.fields.map(field=>field.split('.').map(part=>`\`${part}\``).join('.'))},currentDocument:{updateTime:c.updateTime}})}));
 await request(`https://firestore.googleapis.com/v1/${root}/documents:commit`,{writes});
 const after=await read();const repeat=plan(after,review);if(repeat.changes.length)throw Error('Idempotency verification failed');
 // Verify populated fields except additive tags and the two authorized migrations.
 for(const old of before){const now=after.find(d=>d.path===old.path)!;function check(a:any,b:any,p:string){for(const [k,v]of Object.entries(a)){if(k==='tags')continue;if(old.path.startsWith('sectors/')&&((k==='name'&&p===old.path)||(k==='name'&&p===old.path+'.translations.en'))&&result.changes.some(c=>c.path===old.path&&c.fields.includes(p===old.path?'name':'translations.en.name')))continue;if(k==='sectorId'&&result.moved.includes(old.data.name)&&p===old.path)continue;if(v&&typeof v==='object'&&!Array.isArray(v))check(v,b[k],`${p}.${k}`);else if(v!==''&&v!==null&&JSON.stringify(v)!==JSON.stringify(b[k]))throw Error(`Existing value changed: ${p}.${k}`);}}check(old.data,now.data,old.path);}
 console.log(JSON.stringify({committed:result.changes.length,idempotent:true,existingValuesPreserved:true}));
}
