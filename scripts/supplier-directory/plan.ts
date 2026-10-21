import {DIRECTORY_TEXT_FIELDS} from '../../src/domain/directoryTranslations';
import {sectors,suppliers} from './suppliers';
export type RecordDoc = {path:string; data:any; updateTime?:string};
export type Change = {path:string; data:any; fields:string[]; updateTime?:string; create:boolean};
const blank=(v:any)=>v==null||(typeof v==='string'&&!v.trim());
const normal=(s:string)=>s.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').replace(/[^a-z0-9]/g,'');
const host=(s:string)=>{try{return new URL(s.includes('://')?s:`https://${s}`).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}};
const english=(s:string)=>s.replace(/Türkiye/g,'Turkey').replace(/İstanbul/g,'Istanbul').replace(/İzmir/g,'Izmir').replace(/ABD/g,'USA').replace(/Almanya/g,'Germany').replace(/Hollanda/g,'the Netherlands').replace(/İngiltere/g,'the UK');
const address=(s:string)=>english(s).replace(/Organize Sanayi Bölgesi/g,'Organized Industrial Zone').replace(/Genel Merkez/g,'Head Office').replace(/Mah\./g,'Neighbourhood').replace(/Cadde|Cad\./g,'Street').replace(/Bulvarı|Bulv\./g,'Boulevard').replace(/Sok\.|Sk\./g,'Street').replace(/Kat:/g,'Floor:').replace(/Küme Evleri/g,'Housing Cluster');
export function plan(records:RecordDoc[],review:any[]) {
 const docs=new Map(records.map(d=>[d.path,structuredClone(d)])); const original=new Map(records.map(d=>[d.path,d]));
 const changed=new Map<string,Set<string>>();
 function fill(d:RecordDoc,key:string,value:any){if(blank(value))return;const parts=key.split('.');let obj=d.data;for(const part of parts.slice(0,-1))obj=obj[part]??={};const last=parts.at(-1)!;if(blank(obj[last])){obj[last]=value;const fields=changed.get(d.path)??new Set();fields.add(key);changed.set(d.path,fields);}}
 function create(path:string,data:any){if(docs.has(path))throw Error(`ID collision: ${path}`);const d={path,data};docs.set(path,d);changed.set(path,new Set(Object.keys(data)));return d;}
 const sectorIds=new Map<string,string>();
 for(const [id,tr,en] of sectors){const matches=[...docs.values()].filter(d=>d.path.startsWith('sectors/')&&(normal(d.data.name)===normal(tr)||normal(d.data.translations?.en?.name||'')===normal(en)));if(matches.length>1)throw Error(`Ambiguous sector: ${tr}`);const d=matches[0]??create(`sectors/${id}`,{name:tr,archived:false,translations:{en:{name:en}}});fill(d,'translations.en.name',en);sectorIds.set(id,d.path.split('/')[1]);}
 for(const row of review){const d=docs.get(row.record);if(!d||row.record.startsWith('sectors/'))continue;let source=row.field.startsWith('contactTitles.')?d.data.contacts?.find((p:any)=>p.id===row.field.slice(14))?.title:d.data[row.field];if(source===row.tr)fill(d,`translations.en.${row.field}`,english(row.en));else if(!blank(source)&&blank(d.data.translations?.en?.[row.field]))throw Error(`Translation source changed: ${row.record} ${row.field}`);}
 for(const supplier of suppliers){
  const matches=[...docs.values()].filter(d=>d.path.startsWith('directoryCompanies/')&&(normal(d.data.name)===normal(supplier.name)||host(d.data.website||'')===host(supplier.website)||(supplier.name==='Elite Naturel'&&d.path==='directoryCompanies/elite-naturel')));
  if(matches.length>1)throw Error(`Ambiguous company: ${supplier.name}`);
  let d=matches[0];if(!d){const id=normal(supplier.name);d=create(`directoryCompanies/${id}`,{sectorId:sectorIds.get(supplier.sectorId),name:supplier.name,website:'',catalogUrl:'',description:'',foundedYear:'',employees:'',location:'',address:'',phone:'',email:'',products:'',certificates:'',capacity:'',markets:'',notes:'',contacts:[]});}
  for(const key of ['website','location','description','products','certificates'] as const)fill(d,key,supplier[key]);
  // Only use new English descriptions for matching source or empty source fields.
  for(const key of ['location','description','products','certificates'] as const)if(d.data[key]===supplier[key])fill(d,`translations.en.${key}`,supplier[key]);
 }
 for(const d of docs.values())if(d.path.startsWith('directoryCompanies/')){
  fill(d,'translations.en.name',d.data.name);
  if(d.data.location)fill(d,'translations.en.location',english(d.data.location));
  if(d.data.address)fill(d,'translations.en.address',address(d.data.address));
  for(const key of ['foundedYear','employees'] as const)if(d.data[key]&&/^[\d\s.,+–-]+$/.test(d.data[key]))fill(d,`translations.en.${key}`,d.data[key]);
  // Identity names stay shared; the English name is an explicit translation record.
  // Do not label the pre-existing fictional demo as a real contact.
  if(!d.data.isDemo&&!d.data.notes?.includes('KURGUSAL')){
   if(!Array.isArray(d.data.tags)||!d.data.tags.includes('Long-standing contact')){
    d.data.tags=[...(d.data.tags||[]),'Long-standing contact'];const fields=changed.get(d.path)??new Set();fields.add('tags');changed.set(d.path,fields);
   }
  }
 }
 const unresolved=[...docs.values()].filter(d=>d.path.startsWith('directoryCompanies/')).flatMap(d=>DIRECTORY_TEXT_FIELDS.filter(key=>!blank(d.data[key])&&blank(d.data.translations?.en?.[key])).map(key=>`${d.path}:${key}`));
 if(unresolved.length)throw Error(`Missing translations: ${unresolved.join(', ')}`);
 const changes:Change[]=[...changed].map(([path,fields])=>({path,data:docs.get(path)!.data,fields:[...fields],updateTime:original.get(path)?.updateTime,create:!original.has(path)}));
 return {changes,records:[...docs.values()],unverified:suppliers.map(s=>{const d=[...docs.values()].find(d=>d.path.startsWith('directoryCompanies/')&&(host(d.data.website||'')===host(s.website)||normal(d.data.name)===normal(s.name)))!;return {name:s.name,fields:['location','description','certificates'].filter(k=>blank(d.data[k]))};}).filter(s=>s.fields.length)};
}
