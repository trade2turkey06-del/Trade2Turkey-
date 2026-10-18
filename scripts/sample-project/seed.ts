import { runtime, linkedRoots } from './runtime';
import { sampleRecords, PROJECT } from './data';
import { updateFilenames } from './update';
const {db,ownerUid,live}=await runtime();
if(process.argv.includes('--update')) {
  console.log(JSON.stringify(await updateFilenames(db,process.argv.includes('--dry-run')),null,2));
  process.exit(0);
}
if(process.argv.includes('--dry-run'))throw new Error('--dry-run requires --update.');
const {records}=sampleRecords(ownerUid);
if((await linkedRoots(db)).length)throw new Error('Linked data already exists; refusing to overwrite.');
const root=db.doc(`projects/${PROJECT}`);
if((await root.listCollections()).length)throw new Error('Project subcollections already exist; refusing to overwrite.');
// Atomic create-only batch: a rerun or collision fails without partial data or overwrites.
const batch=db.batch();
for(const record of records)batch.create(db.doc(record.path),record.data);
await batch.commit();
console.log(JSON.stringify({environment:live?'LIVE':'EMULATOR',project:PROJECT,documents:records.length,approved:16,pendingApproval:1,inProgress:1,notStarted:3,visibility:'All administrators; no user assignments',sampleOnly:true},null,2));
