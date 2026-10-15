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
      setMessage(`${records.length} kayıt dışa aktarıldı. Dosyayı güvenli bir yerde saklayın; belgelerin asılları Drive'da kalır.`);
    } catch (error) {setMessage(error instanceof Error ? error.message : "Yedek alınamadı.");} finally {setBusy(false);}
  };
  const restore = async () => {
    if (!preview) return; setBusy(true); setMessage("");
    try {
      validateBackup(preview,projectId);
      if (preview.records.length > 300) throw new Error("Tek işlemde en fazla 300 kayıt geri yüklenebilir. Büyük yedekler için yönetici kurtarma prosedürünü kullanın.");
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
            tx.set(ref,{...recovered,workflowStatus:"incomplete",status:"Pending",approval:"none",completedBy:"",rejectionReason:"Yedekten geri yüklendi; yeniden kontrol ve onay gerekiyor.",updatedAt:serverTimestamp(),lastEventId:restoreEventRef.id});
            restoredTasks=true;
          } else tx.set(ref,recovered);
          added++;
        }
        if(restoredTasks) tx.set(restoreEventRef,{projectId,action:"restore",entityId:projectId,detail:"Eksik görevler yedekten geri yüklendi; onayları sıfırlandı.",actorUid:auth.currentUser!.uid,at:serverTimestamp()});
        return {added,skipped};
      });
      setMessage(`${result.added} eksik kayıt geri eklendi, ${result.skipped} mevcut veya geçersiz belge kaydı korundu / atlandı. Görevler yeniden onaylanmalıdır.`); setPreview(null);
    } catch (error) {setMessage(`Geri yükleme yapılmadı. ${error instanceof Error ? error.message : "Yetki veya veri hatası."}`);} finally {setBusy(false);}
  };
  return <Panel title="Proje yedeği ve geri yükleme"><p className="text-sm text-slate-600">JSON yedeği bilgisayarınıza indirilir. Geri yükleme yalnızca eksik kayıtları tek işlemde ekler; mevcut kayıtları değiştirmez veya silmez. Görevlerin onayları sıfırlanır. Kullanıcı hesapları ve dosya asılları bu yedeğe dahil değildir.</p><button disabled={busy} onClick={() => void exportData()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">Proje yedeğini indir</button><label className="block text-sm">Yedek dosyasını incele<input type="file" accept="application/json,.json" disabled={busy} className="mt-2 block" onChange={async e => {setPreview(null); const file=e.target.files?.[0]; if (!file) return; try {if(file.size>20*1024*1024) throw new Error("Yedek en fazla 20 MB olabilir.");const data=JSON.parse(await file.text());validateBackup(data,projectId);setPreview(data);setMessage("");} catch(error) {setMessage(error instanceof Error?error.message:"Geçersiz dosya.");}}} /></label>{preview && <div className="rounded-xl bg-amber-50 p-4 text-sm"><p>{preview.projectId} · {preview.records.length} kayıt · {preview.createdAt}</p><button disabled={busy} onClick={() => void restore()} className="mt-3 rounded-lg border border-amber-500 px-4 py-2">Eksik kayıtları geri ekle</button></div>}<p role="status" className="text-sm">{busy ? "İşlem sürüyor…" : message}</p></Panel>;
}
