import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import { runtime } from './runtime';
import { PROJECT, sampleRecords } from './data';
import { formulationTotal, proteinEnergyPct, level, DEFAULT_THRESHOLDS, approvalErrors, costLinesFromSpec, claimStatus } from '../../src/domain/productSpec';
import { totals, validateMatrix } from '../../src/domain/rfqMatrix';
if(process.argv.includes('--live'))throw new Error('Verification is emulator-only.');
const {db}=await runtime();
const fixture=sampleRecords('sample-presentation-admin');
assert.equal(formulationTotal(fixture.spec.formulation),100);
assert.equal(proteinEnergyPct(fixture.spec.nutrition),30.4);
assert.equal(level(fixture.spec.nutrition.salt.actual,DEFAULT_THRESHOLDS[0].levels.salt),'high');
assert.deepEqual(approvalErrors(fixture.spec),[]);
assert.equal(claimStatus('High protein',fixture.spec,DEFAULT_THRESHOLDS[0]).status,'ok');
validateMatrix(fixture.matrix);
assert.equal(totals(fixture.matrix).ranking[0].id,'sample-northfield');
assert(!/[\u011e\u011f\u0130\u0131\u015e\u015f\u00e7\u00c7\u00f6\u00d6\u00fc\u00dc]/.test(JSON.stringify(fixture.records)));
const run=(name:string,extra:Record<string,string>={})=>spawnSync(process.execPath,['--import','tsx',`scripts/sample-project/${name}.ts`],{env:{...process.env,...extra},encoding:'utf8'});
const sentinel=db.doc('projects/sample-verification-sentinel');
await sentinel.create({id:'sample-verification-sentinel',name:'Unrelated data must survive'});
const first=run('seed'); assert.equal(first.status,0,first.stderr); process.stdout.write(first.stdout);
const before=await db.doc(`projects/${PROJECT}`).get();
assert.notEqual(run('seed').status,0,'Duplicate creation must fail');
assert((await db.doc(`projects/${PROJECT}`).get()).updateTime!.isEqual(before.updateTime!));
assert.notEqual(run('seed',{FIRESTORE_EMULATOR_HOST:'example.com:8085'}).status,0);
assert.notEqual(run('cleanup',{FIRESTORE_EMULATOR_HOST:'example.com:8085'}).status,0);
const env=await initializeTestEnvironment({projectId:process.env.GCLOUD_PROJECT!,firestore:{host:'127.0.0.1',port:8085,rules:await fs.readFile('firestore.rules','utf8')}});
await env.withSecurityRulesDisabled(async c=>{
  for(const [id,role] of [['sample-presentation-admin','admin'],['sample-other-admin','admin'],['sample-unassigned-client','client'],['sample-unassigned-worker','freelancer']])await setDoc(doc(c.firestore(),`users/${id}`),{id,email:`${id}@example.invalid`,role,status:'active',projectId:'',assignedProjects:[]});
});
for(const id of ['sample-presentation-admin','sample-other-admin']){
  const client=env.authenticatedContext(id,{admin:true}).firestore();
  await assertSucceeds(getDoc(doc(client,`projects/${PROJECT}`)));
  await assertSucceeds(getDocs(collection(client,`projects/${PROJECT}/productSpecs`)));
}
for(const id of ['sample-unassigned-client','sample-unassigned-worker',null]){
  const client=id?env.authenticatedContext(id).firestore():env.unauthenticatedContext().firestore();
  for(const record of fixture.records)await assertFails(getDoc(doc(client,record.path)));
}
const costDoc=(await db.doc(`sopSteps/${PROJECT}_sourcing-A.B.9`).get()).data()!;
const specDoc=(await db.doc(`projects/${PROJECT}/productSpecs/sample-northfield-v1`).get()).data()!;
const expected=costLinesFromSpec(specDoc as any);
assert.deepEqual(costDoc.recipeCostLines.map((l:any)=>[l.sourceRowId,l.quantityPerUnit]),expected.lines.map(l=>[l.sourceRowId,l.quantityPerUnit]));
assert(costDoc.recipeCostLines.every((l:any)=>l.unitPrice>0&&l.currency==='EUR'));
const steps=await db.collection('sopSteps').where('projectId','==',PROJECT).get();
assert.equal(steps.docs.filter(d=>d.data().approval==='approved').length,15);
assert.equal(steps.docs.filter(d=>d.data().approval==='pending').length,1);
assert.equal(steps.docs.filter(d=>d.data().workflowStatus==='in_progress').length,1);
assert.equal(steps.docs.filter(d=>d.data().workflowStatus==='not_started').length,4);
// Later UI-created records also belong to this sample and must be removed.
await db.doc(`projects/${PROJECT}/productSpecs/sample-later-draft`).create({projectId:PROJECT,status:'draft'});
await db.doc(`recipes/sample-later-recipe`).create({projectId:PROJECT,productName:'Sample only'});
assert.notEqual(run('cleanup',{FIRESTORE_EMULATOR_HOST:'example.com:8085'}).status,0);
const liveBlocked=spawnSync(process.execPath,['--import','tsx','scripts/sample-project/seed.ts','--live'],{env:{...process.env,FIRESTORE_EMULATOR_HOST:'',FIREBASE_AUTH_EMULATOR_HOST:'',SAMPLE_OWNER_UID:'sample-presentation-admin',SAMPLE_LIVE_APPROVAL:''},encoding:'utf8'});
assert.notEqual(liveBlocked.status,0);assert.match(liveBlocked.stderr,/Live mutation blocked/);
const cleaned=run('cleanup');assert.equal(cleaned.status,0,cleaned.stderr);process.stdout.write(cleaned.stdout);
assert(!(await db.doc(`projects/${PROJECT}`).get()).exists);
assert.equal((await db.collection('sopSteps').where('projectId','==',PROJECT).get()).size,0);
assert.equal((await db.doc(`projects/${PROJECT}`).listCollections()).length,0);
assert(!(await db.doc('recipes/sample-later-recipe').get()).exists);
assert((await sentinel.get()).exists);
assert.equal((await db.collection('users').get()).size,4,'Lifecycle scripts must not create user profiles');
assert.equal(run('seed').status,0,'Reseed after complete cleanup must succeed');
await env.cleanup();
console.log('PASS: 100% formulation; protein energy 30.4%; salt High; RFQ winner Northfield; approved spec linked to EUR costing; English sample text; two admins allowed; all sample documents denied to clients, freelancers and anonymous users; duplicate/remote-host guards; atomic cleanup; unrelated project and user profiles unchanged. Sample reseeded for UI inspection.');
