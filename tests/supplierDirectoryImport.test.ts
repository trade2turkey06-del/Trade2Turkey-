import test from 'node:test';
import assert from 'node:assert/strict';
import {plan} from '../scripts/supplier-directory/plan';
import {suppliers} from '../scripts/supplier-directory/suppliers';
test('import matches websites despite name differences, preserves populated fields and is idempotent',()=>{
 const existing={path:'directoryCompanies/existing',updateTime:'version',data:{name:'Different legal name',sectorId:'original-sector',website:'http://globalvore.com/',products:'Existing products',description:'Existing description',location:'Existing location',phone:'Private phone',email:'Private email',contacts:[],translations:{en:{products:'Existing English',description:'Existing English description',location:'Existing English location'}}}};
 const before=structuredClone(existing);
 const result=plan([existing],[]);
 assert.deepEqual(existing,before);
 assert.equal(result.records.filter(d=>d.data.name==='Globalvore').length,0);
 const current=result.records.find(d=>d.path===existing.path)!.data;
 for(const key of ['name','sectorId','products','description','location','phone','email','website'])assert.equal(current[key],existing.data[key as keyof typeof existing.data]);
 assert.equal(current.translations.en.products,'Existing English');
 assert.deepEqual(plan(result.records,[]).changes,[]);
 for(const d of result.records.filter(d=>d.path.startsWith('directoryCompanies/')&&d.path!==existing.path)){
  assert.equal(d.data.phone,'');assert.equal(d.data.email,'');assert.deepEqual(d.data.contacts,[]);
  assert.ok(d.data.tags.includes('Long-standing contact'));
 }
 assert.equal(result.records.filter(d=>d.path.startsWith('directoryCompanies/')).length,suppliers.length);
});
test('changed translation sources and ambiguous company matches abort the whole plan',()=>{
 assert.throws(()=>plan([{path:'directoryCompanies/a',data:{name:'A',products:'Changed',contacts:[]}}],[{record:'directoryCompanies/a',field:'products',tr:'Original',en:'English'}]),/source changed/);
 assert.throws(()=>plan(['a','b'].map(id=>({path:`directoryCompanies/${id}`,data:{name:'Globalvore',contacts:[]}})),[]),/Ambiguous company/);
});
