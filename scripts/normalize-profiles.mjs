import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const config=JSON.parse(await fs.readFile(path.join(os.homedir(),".config/configstore/firebase-tools.json"),"utf8"));
const token=config.tokens?.access_token;
const project="planar-folio-h6m9v",database="ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7";
async function request(url,options={}){const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...options.headers}});if(!response.ok)throw new Error(`Profile normalization failed: ${response.status}`);return response.json();}
const identities=await request(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchGet?maxResults=1000`);
if(identities.nextPageToken)throw new Error("Pagination required; no changes made.");
const actual=new Map((identities.users||[]).map(user=>[user.localId,user.email?.toLowerCase()]));
const base=`https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents`;
const profiles=await request(`${base}/users?pageSize=300`);if(profiles.nextPageToken)throw new Error("Pagination required; no changes made.");
let linked=0,suspended=0;
for(const profile of profiles.documents||[]){
  const id=profile.name.split("/").at(-1),email=profile.fields?.email?.stringValue?.toLowerCase();
  const matched=actual.has(id)&&actual.get(id)===email;
  const fields=matched ? {uid:{stringValue:id},id:{stringValue:id}} : {status:{stringValue:"suspended"},legacyAccount:{booleanValue:true}};
  const url=new URL(`https://firestore.googleapis.com/v1/${profile.name}`);for(const key of Object.keys(fields))url.searchParams.append("updateMask.fieldPaths",key);
  if(profile.updateTime)url.searchParams.set("currentDocument.updateTime",profile.updateTime);
  await request(url,{method:"PATCH",body:JSON.stringify({fields})});
  if(matched)linked++;else suspended++;
}
console.log(JSON.stringify({linked,suspendedLegacyProfiles:suspended,deleted:0,passwordsChanged:0}));
