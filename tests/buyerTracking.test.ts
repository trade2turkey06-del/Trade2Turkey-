import test from 'node:test';
import assert from 'node:assert/strict';
import {planTrackingImport,parseTrackingCsv,TRACKING_HEADERS} from '../scripts/buyers/tracking-plan';
import {activityEntries,hasContactWarning,hasLeftCompany,isFollowUpDue,istanbulToday,matchesTracking,trackingSummary,contactEditPatch,TRACKING_COLUMNS,safeLinkedInUrl,validTrackingValue} from '../src/domain/buyerTracking';
import {exportBuyers,type BuyerContact} from '../src/domain/buyers';
const row=(patch:Record<string,string>={})=>Object.fromEntries(TRACKING_HEADERS.map(k=>[k,({country:'United Kingdom',company:'Example',company_type:'Retailer',contact_name:'Alex',email:'alex@example.invalid',is_shared_mailbox:'No',email_status:'Sent',notes:'2026-10-20 Sent',...patch} as any)[k]||'']));
const initial=()=>planTrackingImport([],[row()]);
const stamp=(records:any[])=>records.map(r=>({...r,createTime:'2026-10-20T08:00:00Z',data:{...r.data,updatedAt:'2026-10-20T08:00:00Z',...(r.path.startsWith('buyerContacts/')?{importedAt:'2026-10-20T08:00:00Z'}:{})}}));
test('tracking CSV parser accepts all 31 headers and rejects malformed columns and enum/date values',()=>{
 const r=row(),csv=TRACKING_HEADERS.join(',')+'\n'+TRACKING_HEADERS.map(k=>r[k]).join(',');assert.equal(parseTrackingCsv(csv).length,1);
 assert.throws(()=>parseTrackingCsv('email\na@example.invalid'),/columns/);
 for(const patch of [{email_status:'Unknown'},{linkedin_invite_order:'-1'},{linkedin_invite_order:'NaN'},{follow_up_date:'2026-02-30'},{linkedin_url:'javascript:alert(1)'},{still_at_company:'Maybe'}])assert.throws(()=>planTrackingImport([],[row(patch)]),/Invalid/);
});
test('nonempty CSV fields update existing contacts, blanks preserve values, absent records survive, and second import is empty',()=>{
 const before=stamp(initial().records),contact=before.find(r=>r.path.startsWith('buyerContacts/'))!;contact.data.phone='Existing phone';
 const snapshot=structuredClone(before),result=planTrackingImport(before,[row({contact_name:'Alex Updated',email:'ALEX@example.invalid',priority:'A',reply_summary:'Reply log'})]);
 assert.deepEqual(before,snapshot);assert.equal(result.summary.updated,1);assert.equal(result.summary.added,0);
 const after=result.records.find(r=>r.path===contact.path)!;assert.equal(after.data.name,'Alex Updated');assert.equal(after.data.phone,'Existing phone');assert.equal(after.data.priority,'A');
 assert.equal(planTrackingImport(stamp(result.records),[row({contact_name:'Alex Updated',email:'ALEX@example.invalid',priority:'A',reply_summary:'Reply log'})]).changes.length,0);
 const added=planTrackingImport(before,[row({email:'new@example.invalid'})]);assert.equal(added.summary.added,1);assert.ok(added.records.some(r=>r.path===contact.path));
});
test('field overrides survive multiple imports even after importedAt advances; legacy edited records are conservatively protected',()=>{
 const before=stamp(initial().records),contact=before.find(r=>r.path.startsWith('buyerContacts/'))!;
 contact.data.notes='Manual note';contact.data.status='Meeting';contact.data.manualFields=['notes','status'];contact.data.updatedAt='2026-10-21T09:00:00Z';contact.data.manualUpdatedAt=contact.data.updatedAt;
 const result=planTrackingImport(before,[row({notes:'CSV note',priority:'B'})]);assert.equal(result.summary.skippedRecords,1);assert.equal(result.summary.skippedFields,1);
 const after=result.records.find(r=>r.path===contact.path)!;assert.equal(after.data.notes,'Manual note');assert.equal(after.data.priority,'B');assert.equal(after.data.status,'Meeting');
 after.data.importedAt='2026-10-22T08:00:00Z';after.data.updatedAt=after.data.importedAt;
 const second=planTrackingImport(result.records,[row({notes:'New CSV note',priority:'C'})]);assert.equal(second.records.find(r=>r.path===contact.path)!.data.notes,'Manual note');
 delete contact.data.manualFields;delete contact.data.importedAt;delete contact.data.manualUpdatedAt;
 const legacy=planTrackingImport(before,[row({contact_name:'Changed',priority:'A'})]);assert.equal(legacy.records.find(r=>r.path===contact.path)!.data.name,'Alex');assert.ok(legacy.skipped.some(s=>s.field==='name'));
});
test('follow-up due uses Istanbul date, status and reply channel; summaries/filtering/warnings handle legacy records',()=>{
 const c={id:'x',companyId:'co',emailStatus:'Sent',followUpDate:'2026-10-21',replyChannel:'Auto-reply',notes:'ON HOLD | BOUNCED',stillAtCompany:'Left (moved to Example)',linkedinStatus:'Connected',priority:'A',outreachBatch:'Batch A',archived:false} as BuyerContact;
 assert.equal(istanbulToday(new Date('2026-10-20T22:30:00Z')),'2026-10-21');assert.ok(isFollowUpDue(c,'2026-10-21'));
 for(const patch of [{emailStatus:'Replied'},{replyChannel:'Email'},{replyChannel:'LinkedIn'},{followUpDate:'2026-10-22'},{archived:true}])assert.equal(isFollowUpDue({...c,...patch},'2026-10-21'),false);
 assert.ok(matchesTracking(c,{stillAtCompany:'Left',priority:'A',linkedinStatus:'Connected',outreachBatch:'Batch A'}));assert.equal(matchesTracking(c,{priority:'C'}),false);
 assert.ok(hasLeftCompany(c));assert.ok(hasContactWarning(c));assert.deepEqual(activityEntries(' First | Second | '),['First','Second']);
 const summary=trackingSummary([c,{...c,id:'legacy',emailStatus:undefined,linkedinStatus:undefined}], '2026-10-21');assert.equal(summary.email.Sent,1);assert.equal(summary.email['Not sent'],1);assert.equal(summary.linkedin.Connected,1);assert.equal(summary.due.length,1);
});
test('contact patches mark only actual user edits; exports include all new fields and the shared mailbox mapping',()=>{
 const c={id:'x',companyId:'co',name:'Alex',email:'a@example.invalid',notes:'Original',status:'Not contacted',sharedMailbox:false,archived:false,linkedinInviteOrder:3} as BuyerContact;
 assert.deepEqual(contactEditPatch(c,{...c,notes:'Edited'}),{notes:'Edited'});assert.deepEqual(contactEditPatch(c,{...c,linkedinInviteOrder:undefined}),{linkedinInviteOrder:''});
 const exported=exportBuyers([{id:'gb',name:'United Kingdom',isoCode:'GB',archived:false}],[],[{id:'co',countryId:'gb',typeId:'',name:'Example',website:'',city:'',categories:'',notes:'',archived:false}],[c]);
 for(const field of TRACKING_COLUMNS)assert.ok(exported.includes('"'+field.csv+'"'));assert.ok(exported.includes('"is_shared_mailbox"'));
 assert.equal(safeLinkedInUrl('https://evil.invalid/linkedin.com'),null);assert.equal(safeLinkedInUrl('https://linkedin.com.evil.invalid/in/a'),null);assert.ok(safeLinkedInUrl('https://www.linkedin.com/in/alex'));assert.equal(validTrackingValue('linkedinInviteOrder',2.5),false);
});

test('old-client edits without field markers are protected even after tracking metadata was initialised',()=>{
 const before=stamp(initial().records),contact=before.find(r=>r.path.startsWith('buyerContacts/'))!;
 contact.data.manualFields=[];contact.data.notes='Manual old-client edit';contact.data.updatedAt='2026-10-21T09:00:00Z';
 const result=planTrackingImport(before,[row({priority:'A'})]);assert.equal(result.records.find(r=>r.path===contact.path)!.data.notes,'Manual old-client edit');assert.ok(result.skipped.some(s=>s.field==='notes'));
});
