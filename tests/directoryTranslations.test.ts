import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {translatedValue,companyValue,contactTitle,sectorValue,withEnglish,withContactEnglish,missingTranslations,type DirectoryCompany} from '../src/domain/directoryTranslations';
const company={id:'x',name:'Evliyaoğlu Tekstil',location:'Denizli, Honaz',address:'Honaz',description:'Firma açıklaması',products:'Havlu',contacts:[{id:'emel',name:'Emel Özler',title:'Pazarlama Müdürü',phone:'+90 123',email:'emel@example.invalid'}]} as DirectoryCompany;
test('EN uses translation; blank EN falls back with a marker only for nonempty TR',()=>{
 assert.deepEqual(translatedValue('Havlu','Towels','en'),{text:'Towels',missing:false});
 assert.deepEqual(translatedValue('Havlu','  ','en'),{text:'Havlu',missing:true});
 assert.deepEqual(translatedValue('Havlu','Towels','tr'),{text:'Havlu',missing:false});
 assert.deepEqual(translatedValue(undefined,undefined,'en'),{text:'',missing:false});
 assert.equal(sectorValue({id:'t',name:'Havlu',translations:{en:{name:'Towels & Bathrobes'}}},'en').text,'Towels & Bathrobes');
});
test('English updates preserve identities, all TR fields and unrelated translations without mutation',()=>{
 const before=structuredClone(company);
 const english=withContactEnglish(withEnglish(company,'products','Towels'),'emel','Marketing Manager');
 assert.deepEqual(company,before);
 const {translations,...unchanged}=english;assert.deepEqual(unchanged,before);
 assert.equal(english.name,'Evliyaoğlu Tekstil');assert.equal(english.location,'Denizli, Honaz');
 assert.equal(companyValue(english,'products','en').text,'Towels');
 assert.equal(companyValue(english,'products','tr').text,'Havlu');
 assert.equal(contactTitle(english,english.contacts[0],'en').text,'Marketing Manager');
 assert.equal(contactTitle(english,english.contacts[0],'tr').text,'Pazarlama Müdürü');
 assert.equal(english.contacts[0].name,'Emel Özler');
 assert.deepEqual(missingTranslations(english),['location','address','description']);
 const reordered={...english,contacts:[{id:'other',name:'Other',title:'',phone:'',email:''},...english.contacts]};
 assert.equal(contactTitle(reordered,reordered.contacts[1],'en').text,'Marketing Manager');
});
test('review has complete unique English entries and preserves numbers and unit symbols',()=>{
 const review=JSON.parse(fs.readFileSync('docs/SECTORS_TRANSLATION_REVIEW.json','utf8'));
 assert.equal(review.status,'awaiting_translation_approval_no_live_writes');
 assert.equal(review.rows.length,74);assert.match(review.sourceSha256,/^[a-f0-9]{64}$/);
 assert.equal(new Set(review.rows.map((r:any)=>r.record+'|'+r.field)).size,74);
 for(const row of review.rows){
  assert.ok(row.tr.trim()&&row.en.trim(),row.record+':'+row.field);
  const quantities=(s:string)=>s.match(/[+-]?\d+(?:[.,–]\d+)*(?:\+)?|m²|°C|\bkg\b|\bkm\b/g)||[];
  assert.deepEqual(quantities(row.en).sort(),quantities(row.tr).sort(),row.record+':'+row.field);
 }
});

test('location and address use EN without changing the Turkish source or company identity',()=>{
 const translated=withEnglish(withEnglish(company,'location','Denizli, Turkey'),'address','Honaz');
 assert.equal(companyValue(translated,'location','en').text,'Denizli, Turkey');
 assert.equal(companyValue(translated,'location','tr').text,'Denizli, Honaz');
 assert.equal(translated.name,company.name);
});
