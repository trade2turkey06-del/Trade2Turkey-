import assert from 'node:assert/strict';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { canAdvance, dependencies, validateCompletion, type TaskRecord } from '../../src/domain/workflow';
import { PROJECT, sampleRecords, validateSampleWorkflow } from './data';

// Called only after lifecycle cleanup. Apart from isolated emulator user fixtures,
// every write here uses authenticated client SDKs with the unchanged rules enabled.
export async function verifyWorkflow(env: RulesTestEnvironment, fixture: ReturnType<typeof sampleRecords>) {
  const submitterUid='sample-alex-morgan', approverUid='sample-presentation-admin';
  const submitter=env.authenticatedContext(submitterUid,{admin:true}).firestore();
  const approver=env.authenticatedContext(approverUid,{admin:true}).firestore();
  const tasks=fixture.records.filter(r=>r.path.startsWith('sopSteps/'));
  const expected=Object.fromEntries(tasks.map(r=>[r.data.stepId,r.data as TaskRecord]));
  assert.equal(tasks.length,21);
  validateSampleWorkflow(fixture.records);
  for(const {data} of tasks) {
    if(['in_progress','completed'].includes(data.workflowStatus))assert.deepEqual(canAdvance(data.stepId,expected),[],`${data.stepId} prerequisites`);
    if(data.workflowStatus==='completed')assert.doesNotThrow(()=>validateCompletion(data as TaskRecord),`${data.stepId} completion`);
  }
  const history=Object.fromEntries(fixture.records.filter(r=>r.path.includes('/events/')).map(r=>[r.path.split('/').at(-1)!,r.data]));
  for(const task of tasks.filter(t=>['in_progress','completed'].includes(t.data.workflowStatus))) {
    for(const prerequisite of dependencies[task.data.stepId]) {
      assert(history[`sample-${prerequisite}-final`].at < history[`sample-${task.data.stepId}-start`].at,`${task.data.stepId} history starts after ${prerequisite} approval`);
    }
  }
  assert(fixture.spec.approvedAt < history['sample-A.B.8-submit'].at,'v1.0 must be approved before A.B.8 submission');
  assert.deepEqual(canAdvance('A.B.11',expected),[]);
  assert.deepEqual(canAdvance('A.B.12',expected),['A.B.10','A.B.11']);
  const broken=structuredClone(fixture.records);
  broken.find(r=>r.data.stepId==='A.B.9')!.data.approval='pending';
  assert.throws(()=>validateSampleWorkflow(broken),/A.B.10: prerequisites must be approved/);

  for(const record of fixture.records.filter(r=>r.path===`projects/${PROJECT}`||r.path.includes('/manufacturers/'))) {
    await assertSucceeds(setDoc(doc(submitter,record.path),record.data));
  }
  const specRecord=fixture.records.find(r=>r.path.includes('/productSpecs/'))!;
  const specRef=doc(submitter,specRecord.path);
  await assertFails(setDoc(specRef,specRecord.data)); // approved specs must go through draft -> approval
  await assertSucceeds(setDoc(specRef,{...specRecord.data,status:'draft'}));
  await assertFails(updateDoc(specRef,{status:'approved',approval:{...specRecord.data.approval,manufacturer:{name:'',date:''}}}));
  await assertSucceeds(updateDoc(specRef,{status:'approved',updatedAt:serverTimestamp()}));

  let writes=0, rejected=2;
  const write=async (client: typeof submitter, uid: string, task: typeof tasks[number], phase: string, fields: Record<string,any>, create=false, accept=true) => {
    const eventId=phase==='final'?task.data.lastEventId:`verify-${task.data.stepId}-${phase}`;
    const batch=writeBatch(client);
    const data={...fields,updatedAt:serverTimestamp(),lastEventId:eventId};
    if(create)batch.set(doc(client,task.path),data);else batch.update(doc(client,task.path),data);
    batch.set(doc(client,`projects/${PROJECT}/events/${eventId}`),{projectId:PROJECT,actorUid:uid,at:serverTimestamp(),action:fields.approval==='approved'?'workflow_approve':'workflow_save',entityId:task.data.stepId,detail:`Sample workflow verification: ${phase}`});
    if(accept){await assertSucceeds(batch.commit());writes++;}else{await assertFails(batch.commit());rejected++;}
  };
  for(const task of tasks) {
    const {decidedBy:_decision,...initial}=task.data;
    await write(submitter,submitterUid,task,'create',{...initial,workflowStatus:'not_started',approval:'none',status:'Pending',completedBy:''},true);
  }
  // Every dependent step is rejected while its prerequisites remain not started.
  for(const task of tasks)if(dependencies[task.data.stepId].length) {
    await write(submitter,submitterUid,task,'blocked-before',{workflowStatus:'in_progress',status:'In Progress'},false,false);
  }
  for(const task of tasks) {
    const target=task.data;
    if(target.workflowStatus==='not_started')continue;
    await write(submitter,submitterUid,task,target.workflowStatus==='in_progress'?'final':'start',{workflowStatus:'in_progress',status:'In Progress'});
    if(target.workflowStatus!=='completed')continue;
    assert.doesNotThrow(()=>validateCompletion(target as TaskRecord));
    await write(submitter,submitterUid,task,target.approval==='pending'?'final':'submit',{workflowStatus:'completed',status:'Completed',approval:'pending',completedBy:submitterUid});
    if(target.approval==='approved') {
      if(target.stepId==='A.A.1')await write(submitter,submitterUid,task,'self-approve',{approval:'approved',decidedBy:submitterUid},false,false);
      await write(approver,approverUid,task,'final',{approval:'approved',decidedBy:approverUid});
    }
  }
  // A.B.10 pending and A.B.11 in progress do not unlock A.B.12 or later steps.
  for(const task of tasks.filter(t=>['A.B.12','A.B.13','A.B.14'].includes(t.data.stepId))) {
    await write(submitter,submitterUid,task,'blocked-after',{workflowStatus:'in_progress',status:'In Progress'},false,false);
  }
  // Compare every persisted step with the seed payload, excluding audit timestamps/IDs.
  for(const task of tasks) {
    const actual=(await getDoc(doc(approver,task.path))).data()!;
    const comparable=(value:Record<string,any>)=>Object.fromEntries(Object.entries(value).filter(([key])=>!['updatedAt','lastEventId'].includes(key)));
    assert.deepEqual(comparable(actual),comparable(task.data),`${task.data.stepId} final rule-validated snapshot`);
  }
  console.log(`PASS workflow: all 21 seed step payloads reproduced through rules-enabled client writes (${writes} accepted task transitions; ${rejected} invalid operations rejected); domain prerequisites/completion passed; approved v1.0 created through draft approval; A.B.12-A.B.14 remain locked.`);
}
