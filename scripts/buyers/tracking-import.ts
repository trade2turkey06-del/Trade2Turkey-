// Private input is never logged or committed. Dry run is the default.
// node --import tsx scripts/buyers/tracking-import.ts [--apply]
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {BUYER_COLLECTIONS} from '../../src/domain/buyers';
import type {BuyerRecord} from './plan';
import {parseTrackingCsv,planTrackingImport} from './tracking-plan';
const args=process.argv.slice(2);if(args.some(a=>a!=='--apply'))throw Error('Only --apply is supported');
const apply=args.includes('--apply'),config=JSON.parse(await fs.readFile('firebase-applet-config.json','utf8'));
const root=`projects/${config.projectId}/databases/${config.firestoreDatabaseId}`;
const auth=JSON.parse(await fs.readFile(path.join(os.homedir(),'.config/configstore/firebase-tools.json'),'utf8'));
if(!auth.tokens?.access_token||auth.tokens.expires_at<Date.now()+60000)throw Error('Refresh Firebase CLI authentication first.');
const headers={Authorization:`Bearer ${auth.tokens.access_token}`,'Content-Type':'application/json'};
async function request(url:string,body?:any){const r=await fetch(url,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(`Firestore request failed: ${r.status}`);return r.json();}
function decode(v:any):any{if('stringValue'in v)return v.stringValue;if('booleanValue'in v)return v.booleanValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('timestampValue'in v)return v.timestampValue;if('arrayValue'in v)return(v.arrayValue.values||[]).map(decode);if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,v])=>[k,decode(v)]));return null;}
function encode(v:any):any{if(v===null)return{nullValue:null};if(Array.isArray(v))return{arrayValue:{values:v.map(encode)}};if(typeof v==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,v])=>[k,encode(v)]))}};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};return{stringValue:v};}
async function read(){const records:BuyerRecord[]=[];for(const collection of BUYER_COLLECTIONS){let pageToken='';do{const q=new URLSearchParams({pageSize:'300',...(pageToken?{pageToken}:{})});const data=await request(`https://firestore.googleapis.com/v1/${root}/documents/${collection}?${q}`);for(const d of data.documents||[])records.push({path:d.name.split('/documents/')[1],updateTime:d.updateTime,createTime:d.createTime,data:decode({mapValue:{fields:d.fields}})});pageToken=data.nextPageToken||'';}while(pageToken);}return records;}
const rows=parseTrackingCsv(await fs.readFile('data/buyers_tracking.csv','utf8')),before=await read(),result=planTrackingImport(before,rows);
const directory=`backups/buyers-tracking-${new Date().toISOString().replace(/[:.]/g,'-')}`;await fs.mkdir(directory,{recursive:true,mode:0o700});
for(const [name,data]of Object.entries({before,plan:result}))await fs.writeFile(`${directory}/${name}.json`,JSON.stringify(data,null,2),{mode:0o600});
console.log(JSON.stringify({mode:apply?'apply':'dry-run',...result.summary,backup:directory},null,2));
if(apply&&result.changes.length){
 if(result.changes.length>500)throw Error('Atomic import limited to 500 changed documents; no writes made.');
 const writes=result.changes.map(c=>{
  const contact=c.path.startsWith('buyerContacts/');
  return {update:{name:`${root}/documents/${c.path}`,fields:encode(c.data).mapValue.fields},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'},...(contact?[{fieldPath:'importedAt',setToServerValue:'REQUEST_TIME'}]:[])],...(c.create?{currentDocument:{exists:false}}:{updateMask:{fieldPaths:c.fields},currentDocument:{updateTime:c.updateTime}})};
 });
 await request(`https://firestore.googleapis.com/v1/${root}/documents:commit`,{writes});
 const after=await read();if(planTrackingImport(after,rows).changes.length)throw Error('Idempotency verification failed');
 for(const old of before){const now=after.find(d=>d.path===old.path);if(!now)throw Error('Existing record missing');const change=result.changes.find(c=>c.path===old.path);for(const [key,value]of Object.entries(old.data))if(!change?.fields.includes(key)&&!['updatedAt','importedAt'].includes(key)&&JSON.stringify(value)!==JSON.stringify(now.data[key]))throw Error('Unexpected field change');}
 for(const skipped of result.skipped){const old=before.find(d=>d.path===skipped.path)!,now=after.find(d=>d.path===skipped.path)!;if(JSON.stringify(old.data[skipped.field])!==JSON.stringify(now.data[skipped.field]))throw Error('Manual edit was changed');}
 await fs.writeFile(`${directory}/summary.json`,JSON.stringify(result.summary,null,2),{mode:0o600});
 console.log(JSON.stringify({committed:result.changes.length,idempotent:true,manualEditsPreserved:true,unlistedRecordsPreserved:true}));
}
