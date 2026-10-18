// Read-only inventory: GET requests with a field mask; no document IDs, names,
// credentials or user-entered notes are printed or retained.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { userStatusKey,leadStatusKey,companyTypeKey,urgencyKey } from '../src/domain/statusKeys';
const project='planar-folio-h6m9v',database='ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7';
if(process.argv.slice(2).some(arg=>arg!=='--live-read-only'))throw new Error('Only --live-read-only is supported.');
if(!process.argv.includes('--live-read-only'))throw new Error('Explicit --live-read-only flag required.');
const config=JSON.parse(await fs.readFile(path.join(os.homedir(),'.config/configstore/firebase-tools.json'),'utf8'));
if(!config.tokens?.access_token||config.tokens.expires_at<Date.now())throw new Error('Refresh Firebase CLI login using a read-only database inspection.');
const result:Record<string,unknown>={project,database,readOnly:true,scannedAt:new Date().toISOString()};
for(const [collection,fields] of [['users',['status']],['leads',['status','companyType','urgency']]] as const) {
  const counts:Record<string,Map<string,number>>=Object.fromEntries(fields.map(field=>[field,new Map()]));
  let pageToken='',documents=0;
  do {
    const url=new URL(`https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents/${collection}`);
    url.searchParams.set('pageSize','300');for(const field of fields)url.searchParams.append('mask.fieldPaths',field);if(pageToken)url.searchParams.set('pageToken',pageToken);
    const response=await fetch(url,{headers:{Authorization:`Bearer ${config.tokens.access_token}`}});
    if(!response.ok)throw new Error(`Read-only scan failed: ${response.status}`);
    const data=await response.json();
    for(const doc of data.documents||[]){documents++;for(const field of fields){const raw=doc.fields?.[field];const value=!raw?'<missing>':raw.stringValue??'<non-string>';counts[field].set(value,(counts[field].get(value)||0)+1);}}
    pageToken=data.nextPageToken||'';
  }while(pageToken);
  const normalizers={status:collection==='users'?userStatusKey:leadStatusKey,companyType:companyTypeKey,urgency:urgencyKey};
  result[collection]={documents,fields:Object.fromEntries(fields.map(field=>[field,[...counts[field]].sort(([a],[b])=>a.localeCompare(b)).map(([value,count])=>({value,count,canonical:normalizers[field](value),unknown:!normalizers[field](value)&&value!=='<missing>'}))]))};
}
console.log(JSON.stringify(result,null,2));
