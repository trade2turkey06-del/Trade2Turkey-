import {createHash} from 'node:crypto';
import {DEFAULT_BUYER_COUNTRIES,DEFAULT_BUYER_TYPES,BUYER_COLLECTIONS,normalizeBuyerKey,buyerTypeId} from '../../src/domain/buyers';
export type BuyerRecord={path:string;data:Record<string,any>;updateTime?:string; createTime?:string};
export const CSV_HEADERS=['country','company','company_type','contact_name','title','category','email','phone','outreach_batch','notes'];
export function parseBuyerCsv(source:string,expectedHeaders:readonly string[]=CSV_HEADERS):Record<string,string>[] {
 const matrix:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 const input=source.replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){
  const char=input[i];
  if(quoted){if(char==='"'){if(input[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=char;continue;}
  if(char==='"'){if(cell||closed)throw Error('Malformed CSV quote');quoted=true;}
  else if(char===','){row.push(cell);cell='';closed=false;}
  else if(char==='\r'||char==='\n'){if(char==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))matrix.push(row);row=[];cell='';closed=false;}
  else{if(closed)throw Error('Unexpected text after CSV quote');cell+=char;}
 }
 if(quoted)throw Error('Unclosed CSV quote');
 if(cell||row.length){row.push(cell);if(row.some(v=>v.trim()))matrix.push(row);}
 const headers=matrix.shift()?.map(s=>s.trim());
 if(!headers||headers.length!==expectedHeaders.length||new Set(headers).size!==headers.length||expectedHeaders.some(h=>!headers.includes(h)))throw Error('Unexpected CSV columns');
 return matrix.map((values,i)=>{if(values.length!==headers.length)throw Error(`Wrong column count on CSV row ${i+2}`);return Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));});
}
const empty=(v:any)=>v===undefined||v===null||(typeof v==='string'&&!v.trim());
const stableId=(value:string)=>createHash('sha256').update(value).digest('hex').slice(0,32);
export function emailWebsite(email:string){const domain=email.trim().split('@')[1]?.toLowerCase();return domain&&/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)?`https://www.${domain.replace(/^www\./,'')}`:'';}
export function planBuyerImport(before:BuyerRecord[],rows:Record<string,string>[]){
 const records=structuredClone(before),original=new Map(before.map(d=>[d.path,d]));
 const fields=new Map<string,Set<string>>();
 const all=(collection:string)=>records.filter(d=>d.path.startsWith(collection+'/'));
 const unique=(matches:BuyerRecord[],kind:string)=>{if(matches.length>1)throw Error(`Ambiguous ${kind} match; no changes written`);return matches[0];};
 const add=(collection:string,id:string,data:any)=>{const path=`${collection}/${id}`;if(records.some(d=>d.path===path))throw Error('Stable ID collision');const record={path,data};records.push(record);fields.set(path,new Set(Object.keys(data)));return record;};
 const fill=(record:BuyerRecord,key:string,value:any)=>{if(!empty(value)&&empty(record.data[key])){record.data[key]=value;const keys=fields.get(record.path)??new Set();keys.add(key);fields.set(record.path,keys);}};
 const id=(record:BuyerRecord)=>record.path.split('/')[1];
 for(const c of DEFAULT_BUYER_COUNTRIES){if(!unique(all('buyerCountries').filter(d=>normalizeBuyerKey(d.data.name)===normalizeBuyerKey(c.name)),'country')){const {id,...data}=c;if(!records.some(d=>d.path===`buyerCountries/${id}`))add('buyerCountries',id,data);}}
 for(const t of DEFAULT_BUYER_TYPES){if(!unique(all('buyerCompanyTypes').filter(d=>normalizeBuyerKey(d.data.name)===normalizeBuyerKey(t.name)),'type')){const {id,...data}=t;if(!records.some(d=>d.path===`buyerCompanyTypes/${id}`))add('buyerCompanyTypes',id,data);}}
 let crossCompanyEmails=0;
 // Aggregate company categories before filling blanks: all CSV categories are retained for new companies.
 const categories=new Map<string,Set<string>>();
 for(const row of rows){const key=normalizeBuyerKey(row.country)+'|'+normalizeBuyerKey(row.company);const set=categories.get(key)??new Set();if(row.category)set.add(row.category);categories.set(key,set);}
 for(const [index,row]of rows.entries()){
  if(!row.country||!row.company||!row.company_type)throw Error(`Missing identity on CSV row ${index+2}`);
  if(row.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))throw Error(`Invalid email on CSV row ${index+2}`);
  const country=unique(all('buyerCountries').filter(d=>normalizeBuyerKey(d.data.name)===normalizeBuyerKey(row.country)),'country')??add('buyerCountries',stableId(normalizeBuyerKey(row.country)),{name:row.country,isoCode:'',archived:false});
  const companyType=unique(all('buyerCompanyTypes').filter(d=>normalizeBuyerKey(d.data.name)===normalizeBuyerKey(row.company_type)),'company type')??add('buyerCompanyTypes',buyerTypeId(row.company_type)||stableId(row.company_type),{name:row.company_type,archived:false});
  const countryId=id(country),typeId=id(companyType);
  const company=unique(all('buyerCompanies').filter(d=>d.data.countryId===countryId&&normalizeBuyerKey(d.data.name)===normalizeBuyerKey(row.company)),'company')??add('buyerCompanies',stableId(countryId+'|'+normalizeBuyerKey(row.company)),{countryId,typeId,name:row.company,website:'',city:'',categories:'',notes:'',archived:false});
  fill(company,'typeId',typeId);fill(company,'website',emailWebsite(row.email));fill(company,'categories',[...(categories.get(normalizeBuyerKey(row.country)+'|'+normalizeBuyerKey(row.company))||[])].join('; '));
  if(!row.contact_name&&!row.email){fill(company,'notes',row.notes);continue;}
  const companyId=id(company),email=normalizeBuyerKey(row.email),name=normalizeBuyerKey(row.contact_name);
  const byEmail=email?unique(all('buyerContacts').filter(d=>normalizeBuyerKey(d.data.email||'')===email),'contact email'):undefined;
  const byName=!byEmail&&name?unique(all('buyerContacts').filter(d=>d.data.companyId===companyId&&normalizeBuyerKey(d.data.name||'')===name&&(!email||empty(d.data.email))),'contact name'):undefined;
  const contact=byEmail||byName||add('buyerContacts',stableId(email?'email|'+email:'name|'+companyId+'|'+name),{companyId,name:row.contact_name,title:row.title,category:row.category,email:row.email,phone:row.phone,outreachBatch:row.outreach_batch,notes:row.notes,status:'Not contacted',lastContacted:'',sharedMailbox:/shared mailbox/i.test(row.notes),archived:false});
  if(contact.data.companyId!==companyId)crossCompanyEmails++;
  for(const [key,value]of Object.entries({name:row.contact_name,title:row.title,category:row.category,email:row.email,phone:row.phone,outreachBatch:row.outreach_batch,notes:row.notes,status:'Not contacted',sharedMailbox:/shared mailbox/i.test(row.notes),lastContacted:''}))fill(contact,key,value);
 }
 const changes=[...fields].map(([path,keys])=>({path,data:records.find(d=>d.path===path)!.data,fields:[...keys],create:!original.has(path),updateTime:original.get(path)?.updateTime}));
 const counts=Object.fromEntries(BUYER_COLLECTIONS.map(collection=>[collection,{total:all(collection).length,added:changes.filter(c=>c.create&&c.path.startsWith(collection+'/')).length,updated:changes.filter(c=>!c.create&&c.path.startsWith(collection+'/')).length}]));
 return {records,changes,summary:{inputRows:rows.length,companyOnlyRows:rows.filter(row=>!row.contact_name&&!row.email).length,counts,sharedMailboxes:all('buyerContacts').filter(c=>c.data.sharedMailbox).length,people:all('buyerContacts').filter(c=>!c.data.sharedMailbox).length,crossCompanyEmails}};
}
