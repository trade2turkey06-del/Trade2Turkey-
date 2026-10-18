// Read-only export. Full source/version metadata remains in ignored backups/.
// No creation, update, delete, automatic translation API or paid service is used.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {DIRECTORY_TEXT_FIELDS} from '../src/domain/directoryTranslations';
const project='planar-folio-h6m9v',database='ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7';
if(process.argv.length!==3||process.argv[2]!=='--live-read-only')throw new Error('Only --live-read-only is supported.');
const config=JSON.parse(await fs.readFile(path.join(os.homedir(),'.config/configstore/firebase-tools.json'),'utf8'));
if(!config.tokens?.access_token||config.tokens.expires_at<Date.now()+60000)throw new Error('Refresh the Firebase CLI session using a read-only inspection.');
const records:any[]=[];
for(const collection of ['sectors','directoryCompanies']){
 let pageToken='';
 do{
  const url=new URL(`https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents/${collection}`);url.searchParams.set('pageSize','300');if(pageToken)url.searchParams.set('pageToken',pageToken);
  const response=await fetch(url,{headers:{Authorization:`Bearer ${config.tokens.access_token}`}});if(!response.ok)throw new Error(`Directory export failed: ${response.status}`);
  const data=await response.json();records.push(...data.documents||[]);pageToken=data.nextPageToken||'';
 }while(pageToken);
}
function decode(value:any):any {
 if('stringValue'in value)return value.stringValue;if('integerValue'in value)return value.integerValue;if('doubleValue'in value)return value.doubleValue;if('booleanValue'in value)return value.booleanValue;
 if('arrayValue'in value)return (value.arrayValue.values||[]).map(decode);if('mapValue'in value)return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([k,v])=>[k,decode(v)]));if('timestampValue'in value)return value.timestampValue;return null;
}
const rows:any[]=[];
for(const doc of records){
 const recordPath=doc.name.split('/documents/')[1],data=Object.fromEntries(Object.entries(doc.fields||{}).map(([key,value])=>[key,decode(value)]));
 if(recordPath.startsWith('sectors/')){if(typeof data.name==='string'&&data.name.trim())rows.push({record:recordPath,name:data.name,field:'name',tr:data.name,en:(data.translations as any)?.en?.name||''});}
 else{
  for(const field of DIRECTORY_TEXT_FIELDS)if(typeof data[field]==='string'&&(data[field] as string).trim())rows.push({record:recordPath,name:data.name,field,tr:data[field],en:(data.translations as any)?.en?.[field]||''});
  for(const person of (data.contacts as any[])||[])if(typeof person.title==='string'&&person.title.trim())rows.push({record:recordPath,name:data.name,field:`contactTitles.${person.id}`,contactName:person.name||'',tr:person.title,en:(data.translations as any)?.en?.contactTitles?.[person.id]||''});
 }
}
const directory=path.join(process.cwd(),'backups',`directory-translations-${new Date().toISOString().replace(/[:.]/g,'-')}`);await fs.mkdir(directory,{recursive:true,mode:0o700});
const raw=JSON.stringify({project,database,readOnly:true,scannedAt:new Date().toISOString(),records},null,2),checksum=crypto.createHash('sha256').update(raw).digest('hex');
await fs.writeFile(path.join(directory,'source.json'),raw,{mode:0o600});await fs.writeFile(path.join(directory,'sha256.txt'),checksum+'\n',{mode:0o600});await fs.writeFile(path.join(directory,'rows.json'),JSON.stringify(rows,null,2),{mode:0o600});
if(crypto.createHash('sha256').update(await fs.readFile(path.join(directory,'source.json'))).digest('hex')!==checksum)throw new Error('Export checksum mismatch.');
console.log(JSON.stringify({directory,sectors:records.filter(doc=>doc.name.split('/documents/')[1].startsWith('sectors/')).length,companies:records.filter(doc=>doc.name.split('/documents/')[1].startsWith('directoryCompanies/')).length,nonemptyTranslatableFields:rows.length,existingEnglishFields:rows.filter(row=>row.en).length,checksumVerified:true},null,2));
