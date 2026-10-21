import {TRACKING_COLUMNS, type BuyerTracking} from './buyerTracking';
export const BUYER_COLLECTIONS = ['buyerCountries','buyerCompanyTypes','buyerCompanies','buyerContacts'] as const;
export const BUYER_STATUSES = ['Not contacted','Contacted','Replied','Meeting','Quoted','Not interested'] as const;
export type BuyerStatus = typeof BUYER_STATUSES[number];
export interface BuyerCountry {id:string; name:string; isoCode:string; archived:boolean}
export interface BuyerCompanyType {id:string; name:string; archived:boolean}
export interface BuyerCompany {id:string; countryId:string; typeId:string; name:string; website:string; city:string; categories:string; notes:string; archived:boolean}
export interface BuyerContact extends BuyerTracking {importedAt?:unknown; updatedAt?:unknown; manualUpdatedAt?:unknown; manualFields?:string[]; id:string; companyId:string; name:string; title:string; category:string; email:string; phone:string; outreachBatch:string; status:BuyerStatus; lastContacted:string; notes:string; sharedMailbox:boolean; archived:boolean}
export const normalizeBuyerKey=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export const buyerTypeId=(name:string)=>normalizeBuyerKey(name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const DEFAULT_BUYER_COUNTRIES:BuyerCountry[]=[{id:'gb',name:'United Kingdom',isoCode:'GB',archived:false},{id:'us',name:'United States',isoCode:'US',archived:false}];
export const DEFAULT_BUYER_TYPES:BuyerCompanyType[]=['Retailer','Brand & Manufacturer','Importer & Distributor','Wholesaler','Foodservice Distributor','Broker','Agency & Services'].map(name=>({id:buyerTypeId(name),name,archived:false}));
export function buyerFlag(code:string){return /^[A-Z]{2}$/.test(code)?String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0))):'🌐';}
export function contactMatches(contact:BuyerContact,query:string){const term=normalizeBuyerKey(query);return !term||normalizeBuyerKey([contact.name,contact.title,contact.email,contact.category].join(' ')).includes(term);}
export function companyMatches(company:BuyerCompany,contacts:BuyerContact[],query:string){const term=normalizeBuyerKey(query);return !term||normalizeBuyerKey([company.name,company.categories,company.city].join(' ')).includes(term)||contacts.some(c=>c.companyId===company.id&&!c.archived&&contactMatches(c,query));}
// CSV formula neutralisation applies only to export; stored values remain intact.
export function csvCell(value:string){return '"'+(/^[\s]*[=+@-]/.test(value)?"'"+value:value).replace(/"/g,'""')+'"';}
export function exportBuyers(countries:BuyerCountry[],types:BuyerCompanyType[],companies:BuyerCompany[],contacts:BuyerContact[]){
 const rows=[['country','company','company_type','website','city','company_categories','company_notes','contact_name','title','category','email','phone','outreach_batch','status','last_contacted','notes','is_shared_mailbox',...TRACKING_COLUMNS.map(c=>c.csv)]];
 for(const company of companies.filter(c=>!c.archived)){
  const country=countries.find(c=>c.id===company.countryId);if(!country||country.archived)continue;
  const people=contacts.filter(c=>c.companyId===company.id&&!c.archived);
  for(const c of people.length?people:[null])rows.push([country.name,company.name,types.find(t=>t.id===company.typeId)?.name||'',company.website,company.city,company.categories,company.notes,c?.name||'',c?.title||'',c?.category||'',c?.email||'',c?.phone||'',c?.outreachBatch||'',c?.status||'',c?.lastContacted||'',c?.notes||'',c?.sharedMailbox?'Yes':'No',...TRACKING_COLUMNS.map(field=>c?.[field.key]===undefined?'':String(c[field.key]))]);
 }
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
