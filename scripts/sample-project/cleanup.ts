import { runtime, linkedRoots, assertMarked } from './runtime';
import { PROJECT } from './data';
const {db}=await runtime();
const project=await assertMarked(db);
const roots=await linkedRoots(db);
const children: FirebaseFirestore.DocumentSnapshot[]=[];
async function walk(ref: FirebaseFirestore.DocumentReference){
  for(const collection of await ref.listCollections())for(const child of await collection.listDocuments()){
    const snapshot=await child.get();
    if(snapshot.exists)children.push(snapshot);
    await walk(child);
  }
}
await walk(project.ref);
// The root marker proves ownership. Include later UI edits and nested demo data,
// scoped strictly to this project; users and unrelated projects never enter this list.
const all=[...children,...roots,project];
for(const d of roots)if(d.data()?.projectId!==PROJECT)throw new Error('Root document belongs to another project.');
if(all.length>500)throw new Error('Cleanup exceeds atomic batch limit; manual review required.');
const batch=db.batch();
for(const d of all)batch.delete(d.ref,{lastUpdateTime:d.updateTime!});
await batch.commit();
console.log(`Deleted ${all.length} sample project documents for ${PROJECT}. No users or unrelated projects changed.`);
