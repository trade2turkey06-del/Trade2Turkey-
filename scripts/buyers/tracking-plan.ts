import {createHash} from 'node:crypto';
import {BUYER_COLLECTIONS,normalizeBuyerKey} from '../../src/domain/buyers';
import {CONTACT_EDITABLE_FIELDS,TRACKING_COLUMNS,validTrackingValue} from '../../src/domain/buyerTracking';
import {CSV_HEADERS,emailWebsite,parseBuyerCsv,planBuyerImport,type BuyerRecord} from './plan';
export const TRACKING_HEADERS=[...CSV_HEADERS.filter(k=>k!=='notes'),'is_shared_mailbox',...TRACKING_COLUMNS.map(c=>c.csv),'notes'];
export const parseTrackingCsv=(source:string)=>parseBuyerCsv(source,TRACKING_HEADERS);
const empty=(value:unknown)=>value===undefined||value===null||value==='';
const time=(value:any)=>typeof value==='string'?Date.parse(value):value?.toMillis?.()??0;
export function manuallyProtected(record:BuyerRecord,key:string){
 if(record.data.manualFields?.includes(key))return true;
 // Old UI wrote whole documents without field history. Never guess which populated field it changed.
 const baseline=record.data.importedAt||record.createTime;
 return !empty(record.data[key])&&!!record.data.updatedAt&&(!baseline||time(record.data.updatedAt)>time(baseline))&&(!record.data.manualUpdatedAt||time(record.data.updatedAt)>time(record.data.manualUpdatedAt));
}
export function planTrackingImport(before:BuyerRecord[],rows:Record<string,string>[]){
 const emails=new Set<string>();
 for(const [i,row]of rows.entries()){
  const email=normalizeBuyerKey(row.email||'');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error(`Missing or invalid email on CSV row ${i+2}`);
  if(emails.has(email))throw Error(`Duplicate email on CSV row ${i+2}`);emails.add(email);
  if(row.is_shared_mailbox&&!['Yes','No'].includes(row.is_shared_mailbox))throw Error(`Invalid shared mailbox on CSV row ${i+2}`);
  for(const field of TRACKING_COLUMNS)if(row[field.csv]){const value=field.kind==='number'?Number(row[field.csv]):row[field.csv];if(!validTrackingValue(field.key,value))throw Error(`Invalid ${field.csv} on CSV row ${i+2}`);}
 }
 const original=new Map(before.map(r=>[r.path,r]));
 const base=planBuyerImport(before,rows.map(row=>({...row,contact_name:'',email:'',notes:''})));
 const records=base.records;
 const skipped:{path:string;field:string;reason:string}[]=[];
 const set=(record:BuyerRecord,key:string,value:any)=>{
  if(empty(value)||record.data[key]===value)return;
  const old=original.get(record.path);
  if(old&&manuallyProtected(old,key)){skipped.push({path:record.path,field:key,reason:'manual-edit'});return;}
  record.data[key]=value;
 };
 const country=(name:string)=>{const found=records.filter(r=>r.path.startsWith('buyerCountries/')&&normalizeBuyerKey(r.data.name)===normalizeBuyerKey(name));if(found.length!==1)throw Error('Ambiguous country');return found[0].path.split('/')[1];};
 for(const row of rows){
  const countryId=country(row.country),companies=records.filter(r=>r.path.startsWith('buyerCompanies/')&&r.data.countryId===countryId&&normalizeBuyerKey(r.data.name)===normalizeBuyerKey(row.company));
  if(companies.length!==1)throw Error('Ambiguous company');const company=companies[0],companyId=company.path.split('/')[1];
  if(!company.data.website)company.data.website=emailWebsite(row.email);
  const type=records.find(r=>r.path.startsWith('buyerCompanyTypes/')&&normalizeBuyerKey(r.data.name)===normalizeBuyerKey(row.company_type))!;
  set(company,'typeId',type.path.split('/')[1]);
  const email=normalizeBuyerKey(row.email),matches=records.filter(r=>r.path.startsWith('buyerContacts/')&&normalizeBuyerKey(r.data.email||'')===email);
  if(matches.length>1)throw Error('Ambiguous email match');
  let record=matches[0];
  if(!record){record={path:'buyerContacts/'+createHash('sha256').update('email|'+email).digest('hex').slice(0,32),data:{companyId,name:'',title:'',category:'',email,phone:'',outreachBatch:'',notes:'',status:'Not contacted',lastContacted:'',sharedMailbox:false,archived:false}};if(records.some(r=>r.path===record.path))throw Error('Contact ID collision');records.push(record);}
  if(record.data.companyId!==companyId){skipped.push({path:record.path,field:'companyId',reason:'company-mismatch'});}
  for(const [key,value]of Object.entries({name:row.contact_name,title:row.title,category:row.category,email,phone:row.phone,outreachBatch:row.outreach_batch,notes:row.notes,...(row.is_shared_mailbox?{sharedMailbox:row.is_shared_mailbox==='Yes'}:{})}))set(record,key,value);
  for(const field of TRACKING_COLUMNS)if(row[field.csv])set(record,field.key,field.kind==='number'?Number(row[field.csv]):row[field.csv]);
 }
 // Revert base-plan changes to any pre-existing manually protected field too.
 for(const r of records){const old=original.get(r.path);if(old)for(const key of Object.keys(r.data))if(r.data[key]!==old.data[key]&&manuallyProtected(old,key)){r.data[key]=old.data[key];if(!skipped.some(s=>s.path===r.path&&s.field===key))skipped.push({path:r.path,field:key,reason:'manual-edit'});}}
 const changes=records.flatMap(r=>{const old=original.get(r.path),fields=Object.keys(r.data).filter(k=>JSON.stringify(r.data[k])!==JSON.stringify(old?.data[k]));if(!fields.length)return[];return[{...r,fields,create:!old,updateTime:old?.updateTime}];});
 // Bootstrap a durable override mask only for records with actual imported changes.
 for(const change of changes){if(change.data.manualFields===undefined){const old=original.get(change.path);change.data.manualFields=old?CONTACT_EDITABLE_FIELDS.filter(k=>manuallyProtected(old,k)):[];if(!change.path.startsWith('buyerContacts/'))delete change.data.manualFields;else change.fields.push('manualFields');}}
 const contactChanges=changes.filter(c=>c.path.startsWith('buyerContacts/'));
 return {records,changes,skipped,summary:{inputRows:rows.length,updated:contactChanges.filter(c=>!c.create).length,added:contactChanges.filter(c=>c.create).length,skippedRecords:new Set(skipped.map(s=>s.path)).size,skippedFields:skipped.length,unchanged:rows.length-contactChanges.length,counts:Object.fromEntries(BUYER_COLLECTIONS.map(name=>[name,records.filter(r=>r.path.startsWith(name+'/')).length]))}};
}
