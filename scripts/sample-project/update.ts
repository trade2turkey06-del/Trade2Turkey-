import { PROJECT, MARKER, sampleRecords } from './data';

// An explicit allowlist keeps repairs separate from reseeding: no workflow, prices,
// approvals, user profiles or other projects can be overwritten.
export function filenameRepairs() {
  return sampleRecords('unused-for-filename-repair').records
    .filter(record => record.path.startsWith(`projects/${PROJECT}/manufacturers/`))
    .map(record => ({path:record.path, fields:{
      'vaultDetails.pricingCapacity.exwPriceList':record.data.vaultDetails.pricingCapacity.exwPriceList as string,
      'vaultDetails.certifications.coa':record.data.vaultDetails.certifications.coa as string,
    }}));
}
export async function updateFilenames(db: FirebaseFirestore.Firestore, dryRun = false) {
  const result=await db.runTransaction(async transaction => {
    const project=await transaction.get(db.doc(`projects/${PROJECT}`));
    if(project.data()?.sampleProject!==MARKER)throw new Error('Sample project marker missing; refusing update.');
    const plan=filenameRepairs();
    const snapshots=await transaction.getAll(...plan.map(record=>db.doc(record.path)));
    const changes: {path:string; fields:Record<string,string>}[]=[];
    for(const [index,snapshot] of snapshots.entries()) {
      if(!snapshot.exists || snapshot.data()?.sampleProject!==MARKER || snapshot.data()?.projectId!==PROJECT)throw new Error('Sample manufacturer marker/project mismatch; refusing update.');
      const fields:Record<string,string>={};
      for(const [field,expected] of Object.entries(plan[index].fields)) {
        const current=snapshot.get(field);
        // Only known fixture placeholders are eligible. Preserve any user-edited filename.
        const old=`sample_sample-${expected.slice('sample_'.length)}`;
        if(current===old)fields[field]=expected;
        else if(current!==expected)throw new Error(`Unexpected filename at ${snapshot.ref.path}:${field}; refusing update.`);
      }
      if(Object.keys(fields).length)changes.push({path:snapshot.ref.path,fields});
    }
    if(!dryRun)for(const change of changes)transaction.update(db.doc(change.path),change.fields);
    return changes;
  });
  return {project:PROJECT,dryRun,documents:result.length,fields:result.reduce((sum,r)=>sum+Object.keys(r.fields).length,0),changes:result};
}
