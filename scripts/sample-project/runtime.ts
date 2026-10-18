import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Firestore } from '@google-cloud/firestore';
import { OAuth2Client } from 'google-auth-library';
import { emulatorTarget } from '../../tests/seed-guard.mjs';
import { PROJECT, MARKER } from './data';

export const CLOUD_PROJECT='planar-folio-h6m9v';
export const DATABASE='ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7';
export async function runtime() {
  const live=process.argv.includes('--live');
  const ownerUid=process.env.SAMPLE_OWNER_UID || (live?'':'sample-presentation-admin');
  if(!ownerUid || ownerUid.includes('/'))throw new Error('SAMPLE_OWNER_UID must identify an existing administrator.');
  if(!live){
    const target=emulatorTarget();
    return {db:getFirestore(initializeApp({projectId:target.projectId})),ownerUid,live};
  }
  if(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Remove emulator settings before using --live.');
  if(process.env.SAMPLE_LIVE_APPROVAL!==`APPROVED:${PROJECT}`)throw new Error('Live mutation blocked: obtain user approval after reviewing emulator results and backup, then set SAMPLE_LIVE_APPROVAL.');
  const backup=process.env.SAMPLE_BACKUP_DIR;
  if(!backup)throw new Error('SAMPLE_BACKUP_DIR is required. Run the read-only project backup first.');
  const raw=await fs.readFile(path.join(backup,'firestore.json'),'utf8');
  const hash=(await fs.readFile(path.join(backup,'sha256.txt'),'utf8')).trim();
  const parsed=JSON.parse(raw);
  const createdAt=Date.parse(parsed.createdAt);
  if(crypto.createHash('sha256').update(raw).digest('hex')!==hash || parsed.project!==CLOUD_PROJECT || parsed.database!==DATABASE || !Array.isArray(parsed.records) || !parsed.records.length || !parsed.rules || !Number.isFinite(createdAt) || Date.now()-createdAt>3600000 || createdAt>Date.now())throw new Error('Backup must be checksum verified, complete with rules, for the exact database and less than one hour old.');
  const config=JSON.parse(await fs.readFile(path.join(os.homedir(),'.config/configstore/firebase-tools.json'),'utf8'));
  if(!config.tokens?.access_token || !Number.isFinite(config.tokens.expires_at) || config.tokens.expires_at<Date.now()+60000)throw new Error('Refresh the Firebase CLI login with a read-only database inspection before running.');
  // The Admin SDK accepts only service-account/ADC credentials for Firestore.
  // Use the underlying Cloud client with the already-authorized CLI OAuth session.
  const authClient=new OAuth2Client();
  authClient.setCredentials({access_token:config.tokens.access_token,expiry_date:config.tokens.expires_at});
  const db=new Firestore({projectId:CLOUD_PROJECT,databaseId:DATABASE,authClient});
  const owner=(await db.doc(`users/${ownerUid}`).get()).data();
  if(!owner || !['admin','owner'].includes(owner.role) || ['suspended','Askıya Alındı'].includes(owner.status))throw new Error('Owner must be an existing active administrator.');
  return {db,ownerUid,live};
}
// Administrative lifecycle scripts use exact projectId queries to enumerate all linked documents;
// these are not application search queries. Never read/write an unrelated document body.
export async function linkedRoots(db: FirebaseFirestore.Firestore) {
  const result: FirebaseFirestore.QueryDocumentSnapshot[]=[];
  for(const c of await db.listCollections()){
    if(c.id==='projects')continue;
    for(const field of c.id==='users'?['projectId','assignedProjects']:['projectId']){
      const snapshot=await c.where(field,field==='assignedProjects'?'array-contains':'==',PROJECT).get();
      if(c.id==='users' && !snapshot.empty)throw new Error('Project is assigned to a user. Remove assignment explicitly before continuing.');
      result.push(...snapshot.docs);
    }
  }
  return [...new Map(result.map(d=>[d.ref.path,d])).values()];
}
export async function assertMarked(db: FirebaseFirestore.Firestore) {
  const project=await db.doc(`projects/${PROJECT}`).get();
  if(!project.exists || project.data()?.sampleProject!==MARKER)throw new Error('Sample project marker missing; refusing cleanup.');
  return project;
}
