import test from 'node:test';
import assert from 'node:assert/strict';
import {plan} from '../scripts/supplier-directory/prospect-plan';
import input from '../scripts/supplier-directory/prospects.json';
test('prospects import preserves existing values, handles blank websites and repeats without writes',()=>{
 const existing={path:'directoryCompanies/ifs',updateTime:'v1',data:{name:'Other legal name',website:'http://ifsfood.com.tr',description:'Existing',notes:'Existing notes',tags:['Existing'],phone:'123',translations:{en:{description:'Existing'}}}};
 const unrelated={path:'directoryCompanies/unrelated',data:{name:'Unrelated',website:'',tags:[]}};
 const original=structuredClone([existing,unrelated]);const result=plan(original);
 assert.deepEqual(original,[existing,unrelated]);
 assert.equal(result.records.filter(d=>d.path.startsWith('directoryCompanies/')).length,36);
 assert.deepEqual(result.skipped,['IFS Food Gıda']);
 const updated=result.records.find(d=>d.path===existing.path)!.data;
 assert.equal(updated.description,'Existing');assert.equal(updated.notes,'Existing notes');assert.equal(updated.phone,'123');assert.equal(updated.website,existing.data.website);assert.deepEqual(updated.tags,['Existing','Prospect']);
 assert.deepEqual(result.records.find(d=>d.path===unrelated.path),unrelated);
 for(const s of input.suppliers){const d=result.records.find(d=>d.data.name===s.name);if(!d)continue;assert.ok(d.data.tags.includes('Prospect'));assert.ok(!d.data.tags.includes('Long-standing contact'));assert.equal(d.data.phone,'');assert.equal(d.data.email,'');if(!s.website)assert.equal(d.data.website,'');if(s.sectorId==='fish-seafood')assert.ok(d.data.notes.includes('Target buyer: Myton Food Group – Fish'));}
 assert.equal(result.records.filter(d=>d.path.startsWith('sectors/')).length,6);
 assert.deepEqual(plan(result.records).changes,[]);
});
test('ambiguous matches abort rather than modifying duplicates',()=>{
 assert.throws(()=>plan(['a','b'].map(id=>({path:`directoryCompanies/${id}`,data:{name:'Baktar Tarım',website:''}}))),/Ambiguous company/);
});
