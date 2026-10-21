import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBuyerCsv,planBuyerImport,emailWebsite,CSV_HEADERS} from '../scripts/buyers/plan';
import {contactMatches,companyMatches,exportBuyers,DEFAULT_BUYER_COUNTRIES,DEFAULT_BUYER_TYPES,type BuyerContact,type BuyerCompany} from '../src/domain/buyers';
const row=(overrides:Record<string,string>={})=>Object.fromEntries(CSV_HEADERS.map(k=>[k,({country:'United Kingdom',company:'Example Foods',company_type:'Retailer',contact_name:'Alex Buyer',email:'alex@example.invalid',category:'Juices',notes:'' ,...overrides} as any)[k]||'']));
test('CSV parses BOM, escaped quotes, comma and multiline fields; rejects malformed input',()=>{
 const input='\uFEFF'+CSV_HEADERS.join(',')+'\r\nUnited Kingdom,"Example, Foods",Retailer,Alex,Buyer,Juices,alex@example.invalid,,,"Line 1\nLine ""2"""\r\n';
 const parsed=parseBuyerCsv(input);assert.equal(parsed[0].company,'Example, Foods');assert.equal(parsed[0].notes,'Line 1\nLine "2"');
 assert.throws(()=>parseBuyerCsv('wrong,headers\n1,2'),/columns/);
 assert.throws(()=>parseBuyerCsv(CSV_HEADERS.join(',')+'\n"unclosed'),/Unclosed/);
});
test('import deduplicates by country + company, email and fallback name; preserves populated fields and archives',()=>{
 const first=planBuyerImport([], [row(),row({email:'ALEX@example.invalid',contact_name:'Alex Buyer',phone:'123'}),row({country:'United States',email:'us@example.invalid'}),row({email:'',contact_name:'No Email'}),row({email:'',contact_name:'No Email'})]);
 assert.equal(first.summary.counts.buyerCompanies.total,2);assert.equal(first.summary.counts.buyerContacts.total,3);
 const company=first.records.find(d=>d.path.startsWith('buyerCompanies/'))!;
 company.data.website='https://existing.invalid';company.data.archived=true;
 const contact=first.records.find(d=>d.path.startsWith('buyerContacts/'))!;contact.data.status='Replied';contact.data.title='Existing title';
 const before=structuredClone(first.records);
 const again=planBuyerImport(first.records,[row({title:'New title',phone:'555'})]);
 assert.deepEqual(first.records,before);assert.equal(again.changes.length,0);
 assert.equal(company.data.website,'https://existing.invalid');assert.equal(contact.data.status,'Replied');
 assert.equal(planBuyerImport(first.records,[row({email:'new@example.invalid',contact_name:'No Email'})]).summary.counts.buyerContacts.total,3);
});
test('shared mailboxes are general addresses; company-only rows do not create fake people; categories aggregate',()=>{
 const result=planBuyerImport([],[row({contact_name:'',email:'info@example.invalid',notes:'Shared mailbox'}),row({contact_name:'',email:'',category:'Snacks',notes:'Company note'})]);
 assert.equal(result.summary.sharedMailboxes,1);assert.equal(result.summary.people,0);assert.equal(result.summary.companyOnlyRows,1);
 assert.equal(result.summary.counts.buyerContacts.total,1);
 const company=result.records.find(d=>d.path.startsWith('buyerCompanies/'))!;assert.equal(company.data.categories,'Juices; Snacks');assert.equal(company.data.notes,'Company note');
 assert.equal(planBuyerImport(result.records,[row({contact_name:'',email:'info@example.invalid',notes:'Shared mailbox'}),row({contact_name:'',email:'',category:'Snacks',notes:'Company note'})]).changes.length,0);
 assert.equal(emailWebsite('alex@leathams.co.uk'),'https://www.leathams.co.uk');assert.equal(emailWebsite(''), '');
});
test('global/contact searches include names, emails, titles and categories; CSV scopes and escapes formula cells',()=>{
 const c={id:'co',countryId:'gb',typeId:DEFAULT_BUYER_TYPES[0].id,name:'Example Foods',website:'',city:'',categories:'Juices',notes:'',archived:false} as BuyerCompany;
 const p={id:'p',companyId:'co',name:'=Bad',title:'Senior Buyer',category:'Snacks',email:'alex@example.invalid',phone:'+44123',outreachBatch:'Batch A',status:'Contacted',lastContacted:'2026-10-20',notes:'Comma, newline\n"quote"',sharedMailbox:false,archived:false} as BuyerContact;
 assert.ok(companyMatches(c,[p],'ALEX@'));assert.ok(companyMatches(c,[p],'snacks'));assert.ok(contactMatches(p,'senior'));assert.ok(!companyMatches(c,[{...p,archived:true}],'alex@'));
 const csv=exportBuyers(DEFAULT_BUYER_COUNTRIES,DEFAULT_BUYER_TYPES,[c],[p,{...p,id:'archived',archived:true}]);
 assert.ok(csv.includes('"\'=Bad"'));assert.ok(csv.includes('"\'+44123"'));assert.ok(csv.includes('Comma, newline\n""quote""'));assert.equal((csv.match(/alex@example.invalid/g)||[]).length,1);
 assert.equal(exportBuyers(DEFAULT_BUYER_COUNTRIES,DEFAULT_BUYER_TYPES,[{...c,archived:true}],[p]).includes('alex@'),false);
});
test('ambiguous existing identities abort rather than overwrite; cross-company email preserves original owner',()=>{
 const first=planBuyerImport([],[row()]);const contact=first.records.find(d=>d.path.startsWith('buyerContacts/'))!;
 const result=planBuyerImport(first.records,[row({company:'Different Company'})]);assert.equal(result.summary.crossCompanyEmails,1);assert.equal(result.records.find(d=>d.path===contact.path)!.data.companyId,contact.data.companyId);
 assert.throws(()=>planBuyerImport([...first.records,{...contact,path:'buyerContacts/duplicate'}],[row()]),/Ambiguous/);
});
