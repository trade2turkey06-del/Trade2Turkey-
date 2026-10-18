import { useI18n } from "../i18n";
import { message as msg } from "../i18n";
import { useState } from "react";
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Backup, projectCollections, rootCollections, validateBackup } from "../domain/backup";
import { Panel } from "./OperationsHub";

export function encodeBackup(value: any): any {
  if (value instanceof Timestamp) return { __type: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (Array.isArray(value)) return value.map(encodeBackup);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,encodeBackup(item)]));
  return value;
}
function decode(value: any): any {
  if (value?.__type === "timestamp") return new Timestamp(value.seconds,value.nanoseconds);
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,decode(item)]));
  return value;
}
export default function BackupPanel({ projectId }: { projectId: string }) {
  const { t, fmt } = useI18n();
  const [busy,setBusy] = useState(false), [message,setMessage] = useState(""), [preview,setPreview] = useState<Backup | null>(null);
  const exportData = async () => {
    setBusy(true); setMessage("");
    try {
      const records: Backup["records"] = [];
      const project = await getDoc(doc(db,"projects",projectId));
      if (project.exists()) records.push({path: project.ref.path,data: encodeBackup(project.data())});
      for (const name of rootCollections) {
        const snapshot = await getDocs(query(collection(db,name),where("projectId","==",projectId)));
        snapshot.docs.forEach(item => records.push({path:item.ref.path,data:encodeBackup(item.data())}));
      }
      for (const name of projectCollections) {
        const snapshot = await getDocs(collection(db,"projects",projectId,name));
        snapshot.docs.forEach(item => records.push({path:item.ref.path,data:encodeBackup({...item.data(),projectId})}));
      }
      const backup: Backup = {version:1,projectId,createdAt:new Date().toISOString(),records};
      validateBackup(backup,projectId);
      const blob = new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
      const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href=url; link.download=`Trade2Turkey-${projectId}-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
      setMessage(msg("actionCenter", "valueRecordsExportedStoreTheFileSecurelyOriginalDocuments", records.length));
    } catch (error) {setMessage(error instanceof Error ? error.message : msg("actionCenter", "couldNotCreateTheBackup"));} finally {setBusy(false);}
  };
  const restore = async () => {
    if (!preview) return; setBusy(true); setMessage("");
    try {
      validateBackup(preview,projectId);
      if (preview.records.length > 300) throw new Error(msg("actionCenter", "aMaximumOf300RecordsCanBeRestoredIn"));
      const result = await runTransaction(db,async tx => {
        const snapshots=[];
        for (const item of preview.records) snapshots.push({item,ref:doc(db,item.path),snapshot:await tx.get(doc(db,item.path))});
        let added=0, skipped=0;
        const restoreEventRef=doc(collection(db,"projects",projectId,"events"));
        let restoredTasks=false;
        for (const {item,ref,snapshot} of snapshots) {
          if (snapshot.exists()) { skipped++; continue; }
          const value=decode(item.data), parts=item.path.split("/");
          if(parts[0]==="driveFiles" && !String(value.downloadUrl||"").startsWith("https://")) { skipped++; continue; }
          const recovered={...value,recoveredAt:serverTimestamp(),recoveredBy:auth.currentUser!.uid};
          if(parts[2]==="events") {
            tx.set(ref,{...recovered,at:serverTimestamp(),actorUid:auth.currentUser!.uid,originalActorUid:value.actorUid,originalAt:value.at});
          } else if(parts[0]==="sopSteps" && value.workflow==="sourcing") {
            tx.set(ref,{...recovered,workflowStatus:"incomplete",status:"Pending",approval:"none",completedBy:"",rejectionReason:"restored_requires_review",updatedAt:serverTimestamp(),lastEventId:restoreEventRef.id});
            restoredTasks=true;
          } else tx.set(ref,recovered);
          added++;
        }
        if(restoredTasks) tx.set(restoreEventRef,{projectId,action:"restore",entityId:projectId,detail:"backup_restored",actorUid:auth.currentUser!.uid,at:serverTimestamp()});
        return {added,skipped};
      });
      setMessage(msg("actionCenter", "valueMissingRecordsRestoredValueExistingOrInvalidDocument", result.added, result.skipped)); setPreview(null);
    } catch (error) {setMessage(msg("actionCenter", "noDataWasRestoredValue", error instanceof Error ? error.message : "Yetki veya veri hatası."));} finally {setBusy(false);}
  };
  return <Panel title={msg("actionCenter", "projectBackupRestore")}><p className="text-sm text-slate-600">{msg("actionCenter", "theJsonBackupDownloadsToYourComputerRestoreAdds")}</p><button disabled={busy} onClick={() => void exportData()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">{msg("actionCenter", "downloadProjectBackup")}</button><label className="block text-sm">{msg("actionCenter", "inspectBackupFile")}<input type="file" accept="application/json,.json" disabled={busy} className="mt-2 block" onChange={async e => {setPreview(null); const file=e.target.files?.[0]; if (!file) return; try {if(file.size>20*1024*1024) throw new Error(msg("actionCenter", "backupFilesMustNotExceed20Mb"));const data=JSON.parse(await file.text());validateBackup(data,projectId);setPreview(data);setMessage("");} catch(error) {setMessage(error instanceof Error?error.message:msg("actionCenter", "invalidFile"));}}} /></label>{preview && <div className="rounded-xl bg-amber-50 p-4 text-sm"><p>{preview.projectId} · {fmt.number(preview.records.length)} {msg("actionCenter", "records")} {fmt.dateTime(new Date(preview.createdAt))}</p><button disabled={busy} onClick={() => void restore()} className="mt-3 rounded-lg border border-amber-500 px-4 py-2">{msg("actionCenter", "restoreMissingRecords")}</button></div>}<p role="status" className="text-sm">{busy ? msg("actionCenter", "processing") : message}</p></Panel>;
}
