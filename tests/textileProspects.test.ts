import test from 'node:test';
import assert from 'node:assert/strict';
import {plan} from '../scripts/supplier-directory/textile-plan';
const fixtures=[{path:'sectors/towels',data:{name:'Havlu',translations:{en:{name:'Towels & Home Textile'}}}},{path:'sectors/apparel',data:{name:'Hazır Giyim',translations:{en:{name:'Apparel'}}}},{path:'directoryCompanies/alasev',data:{name:'Alasev Tekstil',sectorId:'towels',website:'https://alasevtekstil.com',notes:'Keep',tags:['Long-standing contact']}}];
test('textile import creates 28 prospects, renames towels and moves only Alasev sector',()=>{
 const original=structuredClone(fixtures);const r=plan(fixtures);assert.deepEqual(fixtures,original);
 assert.equal(r.changes.filter(c=>c.create&&c.path.startsWith('sectors/')).length,11);
 assert.equal(r.changes.filter(c=>c.create&&c.path.startsWith('directoryCompanies/')).length,28);
 const alasev=r.records.find(d=>d.path==='directoryCompanies/alasev')!;assert.deepEqual(alasev.data,{...fixtures[2].data,sectorId:'home-storage-organizers'});
 assert.equal(r.records.find(d=>d.path==='sectors/towels')!.data.name,'Havlu ve Banyo Tekstili');
 for(const c of r.changes.filter(c=>c.create&&c.path.startsWith('directoryCompanies/'))){assert.deepEqual(c.data.contacts,[]);assert.equal(c.data.phone,'');assert.equal(c.data.email,'');assert.ok(c.data.tags.includes('Prospect'));assert.ok(!c.data.tags.includes('Long-standing contact'));assert.equal(c.data.translations.en.products,c.data.products);}
 const h=r.records.find(d=>d.data.name==='Hürsan Havlu')!.data;assert.equal(h.website,'');assert.ok(h.notes.includes('Likely website: hursan.com.tr (unverified)'));assert.ok(h.tags.includes('Website unverified'));
 assert.deepEqual(plan(r.records).changes,[]);
});
test('website duplicates retain existing populated fields and receive only blank values and tags',()=>{
 const d={path:'directoryCompanies/existing',data:{name:'Existing legal name',website:'http://menderes.com',products:'Keep',notes:'Keep',sectorId:'original'}};
 const r=plan([...fixtures,d]);assert.ok(r.skipped.includes('Menderes Tekstil'));const after=r.records.find(x=>x.path===d.path)!;for(const [k,v]of Object.entries(d.data))assert.equal(after.data[k],v);
});
