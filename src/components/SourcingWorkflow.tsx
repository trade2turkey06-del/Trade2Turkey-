import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { ClipboardList } from "lucide-react";
import { auth, db } from "../lib/firebase";
import { sourcingWorkflow } from "../data/sourcingWorkflow";
import { INITIAL_SOP_STEPS } from "../types";
import { UserTenant } from "../data/usersData";
import { affectedSteps, canAdvance, dependencies, TaskRecord, validateCompletion, workflowStatuses } from "../domain/workflow";
import { eventData, operationCollection } from "../lib/operationsStore";
import GoogleDriveFolder from "./GoogleDriveFolder";
import TargetSpecificationEditor, { createTargetSpecification } from "./TargetSpecificationEditor";
import SupplierLongListEditor, { SupplierCandidate } from "./SupplierLongListEditor";
import RfqSubmissionEditor, { createRfqForm } from "./RfqSubmissionEditor";

const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:bg-slate-100";
const taskRef = (projectId: string, id: string) => doc(db, "sopSteps", `${projectId}_sourcing-${id}`);
type Step = typeof sourcingWorkflow[number];

export default function SourcingWorkflow({ projectId, currentUser }: { projectId: string; currentUser: UserTenant }) {
  const [records, setRecords] = useState<Record<string, TaskRecord>>({});
  const [users, setUsers] = useState<UserTenant[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true); setRecords({}); setError("");
    // Live snapshots keep approvals consistent across open sessions.
    const stop = onSnapshot(query(collection(db, "sopSteps"), where("projectId", "==", projectId)), snapshot => {
      setRecords(Object.fromEntries(snapshot.docs.filter(item => item.data().workflow === "sourcing").map(item => [item.data().stepId, item.data() as TaskRecord])));
      setLoading(false);
    }, () => { setError("İş akışı yüklenemedi. Bağlantı veya erişim yetkinizi kontrol edin."); setLoading(false); });
    const stopUsers = currentUser.role === "admin" ? onSnapshot(collection(db, "users"), snapshot => {
      setUsers(snapshot.docs.map(item => ({ ...item.data(), role: item.data().role === "owner" ? "admin" : item.data().role, id: item.id } as UserTenant)).filter(user => !user.legacyAccount && !["suspended", "Askıya Alındı"].includes(user.status || "") && (user.role === "admin" || user.projectId === projectId || user.assignedProjects?.includes(projectId))));
    }, () => setError("Görev atanabilecek kullanıcılar yüklenemedi.")) : () => {};
    const eventsQuery = currentUser.role === "freelancer" ? query(operationCollection(projectId, "events"),where("action","in",["workflow_save","workflow_approve","workflow_reject"])) : operationCollection(projectId, "events");
    const stopEvents = onSnapshot(eventsQuery, snapshot => setEvents(snapshot.docs.map(item => ({ ...item.data(), id: item.id })).filter((item: any) => item.entityId?.startsWith("A."))), () => {});
    return () => { stop(); stopUsers(); stopEvents(); };
  }, [projectId, currentUser.id, currentUser.role]);

  return <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="sourcing-workflow-title">
    <h2 id="sourcing-workflow-title" className="flex items-center gap-3 text-xl font-bold"><ClipboardList />Tedarik İş Akışı</h2>
    <p className="mt-2 text-sm text-slate-600">Sorumlu atayın, belge ekleyin ve tamamlanan işi onaya gönderin. Ön koşulları onaylanmayan adımlara başlanamaz.</p>
    <div className="my-4 flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-indigo-50 px-3 py-1">{Object.values(records).filter(item => item.approval === "approved" && item.workflowStatus === "completed").length} / 21 onaylandı</span><span className="rounded-full bg-amber-50 px-3 py-1">{Object.values(records).filter(item => item.approval === "pending").length} onay bekliyor</span></div>
    {error && <p role="alert" className="my-3 text-red-700">{error}</p>}
    {loading ? <p>Yükleniyor…</p> : ["A.A.", "A.B."].map(prefix => <div key={prefix} className="mt-6">
      <h3 className="mb-3 font-bold">{prefix === "A.A." ? "A.A · Keşif ve Fizibilite" : "A.B · Teklif, Kalite ve Uyumluluk"}</h3>
      <div className="space-y-3">{sourcingWorkflow.filter(step => step.id.startsWith(prefix)).map(step => <TaskEditor key={`${projectId}:${step.id}`} projectId={projectId} step={step} record={records[step.id]} users={users} currentUser={currentUser} records={records} events={events.filter(event => event.entityId === step.id)} />)}</div>
    </div>)}
  </section>;
}

function TaskEditor({ projectId, step, record, users, currentUser, records, events }: { projectId: string; step: Step; record?: TaskRecord; users: UserTenant[]; currentUser: UserTenant; records: Record<string, TaskRecord>; events: any[] }) {
  const [draft, setDraft] = useState<TaskRecord>({ stepId: step.id, workflowStatus: "not_started", ...record });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const dueDateInput = useRef<HTMLInputElement>(null);
  const translated = INITIAL_SOP_STEPS.find(item => item.id === step.id);
  const blocked = canAdvance(step.id, records);
  const isAdmin = currentUser.role === "admin";
  const canEdit = isAdmin || record?.assigneeUid === currentUser.id;
  const approved = record?.approval === "approved";
  useEffect(() => { setDraft({ stepId: step.id, workflowStatus: "not_started", ...record }); }, [record?.updatedAt?.seconds, record?.updatedAt?.nanoseconds, record?.workflowStatus, record?.approval]);
  const change = (name: string, value: string) => setDraft(previous => ({ ...previous, [name]: value }));
  const save = async (action: "save" | "approve" | "reject") => {
    const candidate = { ...draft, dueDate: dueDateInput.current?.value || draft.dueDate || "" };
    setBusy(true); setMessage("");
    try {
      const uid = auth.currentUser?.uid; if (!uid) throw new Error("Oturum açın.");
      if (action === "save" && step.id === "A.A.4" && new TextEncoder().encode(JSON.stringify(draft.rfqForms ?? [])).length > 500000) throw new Error("RFQ formları çok büyük. Lütfen uzun yanıtları belge bağlantısı olarak ekleyin.");
      if (action === "save" && (step.id === "A.A.3" || step.id === "A.A.5") && isAdmin) {
        const companies: SupplierCandidate[] = (step.id === "A.A.3" ? draft.supplierLongList : draft.supplierShortList) ?? [];
        if (companies.some(company => !company.name.trim())) throw new Error("Lütfen listedeki her firmanın adını girin veya boş firmayı çıkarın.");
        if (new TextEncoder().encode(JSON.stringify(companies)).length > 500000) throw new Error("Firma listesi çok büyük. Lütfen uzun notları kısaltın.");
      }
      if (step.id === "A.A.2" && new TextEncoder().encode(JSON.stringify(draft.targetSpecification || [])).length > 500000) throw new Error("Özellik formu çok büyük. Lütfen uzun içerikleri belge bağlantısı olarak ekleyin.");
      await runTransaction(db, async tx => {
        const ref = taskRef(projectId, step.id); const snapshot = await tx.get(ref);
        const current = snapshot.data() as TaskRecord | undefined;
        if ((current?.updatedAt?.seconds || 0) !== (record?.updatedAt?.seconds || 0) || (current?.updatedAt?.nanoseconds || 0) !== (record?.updatedAt?.nanoseconds || 0)) throw new Error("Bu adım başka bir oturumda değişti. Güncel kaydı kontrol edip yeniden deneyin.");
        const prerequisites: Record<string, TaskRecord> = {};
        for (const id of dependencies[step.id] || []) { const snapshot = await tx.get(taskRef(projectId, id)); prerequisites[id] = snapshot.data() as TaskRecord; }
        if ((action === "save" && ["in_progress", "completed"].includes(draft.workflowStatus)) || action === "approve") {
          const missing = canAdvance(step.id, prerequisites);
          if (missing.length) throw new Error(`Önce şu adımlar tamamlanıp onaylanmalı: ${missing.join(", ")}`);
        }
        const eventRef = doc(operationCollection(projectId, "events"));
        let next: Record<string, unknown>;
        if (action === "save") {
          if (!canEdit) throw new Error("Bu görevi düzenleme yetkiniz yok.");
          if (current?.approval === "approved") throw new Error("Onaylı kayıt değiştirilemez. Önce onaylayan gerekçeli iade yapmalı.");
          if (draft.workflowStatus === "completed") validateCompletion(candidate);
          next = {
            id: `sourcing-${step.id}`, projectId, workflow: "sourcing", stepId: step.id, section: "A",
            subsection: step.id.startsWith("A.A.") ? "Keşif ve Fizibilite" : "Teklif, Kalite ve Uyumluluk",
            task: step.task.trim(), requester: step.requester, taskOwner: step.owner, kpiMetric: step.metric.trim(), kpiTimeDays: step.days,
            status: draft.workflowStatus === "completed" ? "Completed" : draft.workflowStatus === "in_progress" ? "In Progress" : "Pending",
            workflowStatus: draft.workflowStatus, assigneeUid: draft.assigneeUid || "", approverUid: draft.approverUid || "",
            dueDate: candidate.dueDate, notes: draft.notes || "", evidenceName: draft.evidenceName || "", evidenceUrl: draft.evidenceUrl || "",
            approval: draft.workflowStatus === "completed" ? "pending" : "none", completedBy: draft.workflowStatus === "completed" ? uid : "",
            rejectionReason: "", updatedAt: serverTimestamp(),
            ...(step.id === "A.A.2" && isAdmin ? { targetSpecification: draft.targetSpecification ?? createTargetSpecification() } : {}),
            ...(step.id === "A.A.3" && isAdmin ? { supplierLongList: draft.supplierLongList ?? [] } : {}),
            ...(step.id === "A.A.5" && isAdmin ? { supplierShortList: draft.supplierShortList ?? [] } : {}),
            ...(step.id === "A.A.4" && isAdmin ? { rfqForms: draft.rfqForms ?? [createRfqForm()] } : {}),
          };
        } else {
          if (!current || current.approverUid !== uid || (action === "approve" && current.completedBy === uid)) throw new Error("Yalnızca atanmış onaylayan karar verebilir; işlemi yapan kişi kendi işini onaylayamaz.");
          if (action === "approve" && current.approval !== "pending") throw new Error("Bu kayıt onay beklemiyor.");
          if (action === "approve") validateCompletion(current);
          if (action === "reject" && !reason.trim()) throw new Error("Ret / iade gerekçesini yazın.");
          const targets = affectedSteps([step.id, ...(step.returnTo || "").split("/").filter(id => sourcingWorkflow.some(item => item.id === id))]).filter(id => id !== step.id);
          const targetSnapshots = [];
          if (action === "reject") for (const id of targets) targetSnapshots.push({ id, snapshot: await tx.get(taskRef(projectId, id)) });
          next = { approval: action === "approve" ? "approved" : "rejected", workflowStatus: action === "approve" ? "completed" : "incomplete", status: action === "approve" ? "Completed" : "Pending", rejectionReason: action === "reject" ? reason.trim() : "", decidedBy: uid, updatedAt: serverTimestamp() };
          for (const target of targetSnapshots) if (target.snapshot.exists()) tx.update(taskRef(projectId, target.id), { workflowStatus: "incomplete", status: "Pending", approval: "none", rejectionReason: `${step.id}: ${reason.trim()}`.slice(0,1500), returnedFrom: step.id, lastEventId: eventRef.id, updatedAt: serverTimestamp() });
        }
        tx.set(ref, { ...next, lastEventId: eventRef.id }, { merge: true });
        tx.set(eventRef, { ...eventData(`workflow_${action}`, step.id, action === "reject" ? reason : action === "approve" ? "Onaylandı" : workflowStatuses[draft.workflowStatus]), projectId });
      });
      setMessage("Kaydedildi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kaydedilemedi."); }
    finally { setBusy(false); }
  };
  // Copies a long-list company into the A.A.5 record without touching that step's status.
  const shortlist = async (company: SupplierCandidate) => {
    setBusy(true); setMessage("");
    try {
      if (!auth.currentUser?.uid) throw new Error("Oturum açın.");
      await runTransaction(db, async tx => {
        const ref = taskRef(projectId, "A.A.5"); const snapshot = await tx.get(ref);
        const current = snapshot.data() as TaskRecord | undefined;
        if (current?.approval === "approved" || current?.approval === "pending") throw new Error("A.A.5 kısa listesi onayda veya onaylı; değiştirilemez.");
        const list: SupplierCandidate[] = current?.supplierShortList ?? [];
        if (list.some(item => item.id === company.id)) return;
        const eventRef = doc(operationCollection(projectId, "events"));
        tx.set(ref, { ...(current ? {} : { id: "sourcing-A.A.5", projectId, workflow: "sourcing", stepId: "A.A.5", section: "A", workflowStatus: "not_started", status: "Pending", approval: "none" }), supplierShortList: [...list, { ...company }], updatedAt: serverTimestamp(), lastEventId: eventRef.id }, { merge: true });
        tx.set(eventRef, { ...eventData("workflow_save", "A.A.5", `${company.name} kısa listeye eklendi (A.A.3)`), projectId });
      });
      setMessage(`“${company.name}” A.A.5 Üretici Kısa Listesi'ne eklendi.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kısa listeye eklenemedi."); }
    finally { setBusy(false); }
  };
  return <details data-testid={`task-${step.id}`} className="group rounded-2xl border border-slate-200 bg-white open:border-indigo-300">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 text-sm [&::-webkit-details-marker]:hidden">
      <span className="rounded-lg bg-indigo-50 px-2 py-1 font-bold text-indigo-700">{step.id}</span><span className="min-w-0 flex-1 font-semibold">{translated?.task || step.task}</span>
      <span className={`rounded-full px-2 py-1 text-xs ${approved ? "bg-emerald-100 text-emerald-800" : record?.approval === "pending" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{approved ? "Onaylandı" : record?.approval === "pending" ? "Onay bekliyor" : workflowStatuses[record?.workflowStatus || "not_started"]}</span><span className="text-xs text-slate-500">{step.days} gün</span><span className="text-indigo-600">Ayrıntılar ↕</span>
    </summary>
    <div className="space-y-4 border-t p-4">
      {step.id === "A.A.2" && <TargetSpecificationEditor sections={draft.targetSpecification ?? createTargetSpecification()} onChange={sections => setDraft(previous => ({ ...previous, targetSpecification: sections }))} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.A.3" && <SupplierLongListEditor shortlistedIds={(records["A.A.5"]?.supplierShortList ?? []).map((item: SupplierCandidate) => item.id)} onShortlist={isAdmin ? company => { if (!busy) void shortlist(company); } : undefined} companies={draft.supplierLongList ?? []} onChange={companies => setDraft(previous => ({ ...previous, supplierLongList: companies }))} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.A.5" && <SupplierLongListEditor title="Üretici Kısa Listesi" description="A.A.3 geniş tedarikçi listesinden kısa listeye alınacak üreticileri (en az 3 firma) seçin; gerekirse bilgilerini düzenleyin veya listeden çıkarın." source={records["A.A.3"]?.supplierLongList ?? []} companies={draft.supplierShortList ?? []} onChange={companies => setDraft(previous => ({ ...previous, supplierShortList: companies }))} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.A.4" && <RfqSubmissionEditor forms={draft.rfqForms ?? [createRfqForm()]} onChange={forms => setDraft(previous => ({ ...previous, rfqForms: forms }))} disabled={!isAdmin || busy || approved} />}
      <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2"><p><strong>KPI:</strong> {translated?.kpiMetric || step.metric}</p><p><strong>Gerekli çıktı:</strong> {translated?.requiredOutputs || step.outputs}</p><p><strong>Ön koşul:</strong> {dependencies[step.id]?.join(", ") || "Yok"}</p><p><strong>Reddedilirse dönüş:</strong> {step.returnTo || "Aynı adım"}</p></div>
      {blocked.length > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Beklenen ön koşullar: {blocked.join(", ")}</p>}
      {record?.rejectionReason && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">İade gerekçesi: {record.rejectionReason}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">Durum<select className={input} value={draft.workflowStatus} disabled={!canEdit || busy || approved} onChange={e => change("workflowStatus", e.target.value)}>{Object.entries(workflowStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm">Görev sorumlusu<select className={input} value={draft.assigneeUid || ""} disabled={!isAdmin || busy || approved} onChange={e => change("assigneeUid", e.target.value)}><option value="">Kişi seçin</option>{users.map(user => <option key={user.id} value={user.id}>{user.displayName || user.companyName} · {user.email}</option>)}</select></label>
        <label className="text-sm">Onaylayan<select className={input} value={draft.approverUid || ""} disabled={!isAdmin || busy || approved} onChange={e => change("approverUid", e.target.value)}><option value="">Kişi seçin</option>{users.filter(user => user.role === "admin").map(user => <option key={user.id} value={user.id}>{user.displayName || user.companyName} · {user.email}</option>)}</select></label>
        <label className="text-sm">Hedef bitiş tarihi<input ref={dueDateInput} type="date" className={input} value={draft.dueDate || ""} disabled={!canEdit || busy || approved} onChange={e => change("dueDate", e.target.value)} onInput={e => change("dueDate", e.currentTarget.value)} /></label>
        <label className="text-sm">Belge / çıktı adı<input className={input} maxLength={250} value={draft.evidenceName || ""} disabled={!canEdit || busy || approved} onChange={e => change("evidenceName", e.target.value)} /></label>
        <label className="text-sm">Belge bağlantısı (HTTPS)<input type="url" className={input} maxLength={2000} placeholder="https://drive.google.com/…" value={draft.evidenceUrl || ""} disabled={!canEdit || busy || approved} onChange={e => change("evidenceUrl", e.target.value)} /></label>
      </div>
      <label className="block text-sm">Notlar<textarea className={input} maxLength={3000} value={draft.notes || ""} disabled={!canEdit || busy || approved} onChange={e => change("notes", e.target.value)} /></label>
      {canEdit && !approved && <button onClick={() => void save("save")} disabled={busy} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Kaydediliyor…" : draft.workflowStatus === "completed" ? "Kaydet ve onaya gönder" : "Kaydet"}</button>}
      {record?.approverUid === currentUser.id && ["pending", "approved"].includes(record.approval || "") && <div className="space-y-3 rounded-xl bg-slate-50 p-4"><label className="block text-sm">Ret / iade gerekçesi<input className={input} maxLength={1500} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="flex gap-2">{record.approval === "pending" && <button disabled={busy || record.completedBy === currentUser.id} onClick={() => void save("approve")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-40">Onayla</button>}<button disabled={busy} onClick={() => void save("reject")} className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white">Gerekçeyle iade et</button></div></div>}
      <p role="status" className="text-sm text-indigo-800">{message}</p>
      <details><summary className="cursor-pointer text-sm font-semibold">İşlem geçmişi ({events.length})</summary><ul className="mt-2 space-y-2 text-xs text-slate-600">{[...events].sort((a,b) => (b.at?.seconds || 0) - (a.at?.seconds || 0)).map(event => <li key={event.id}>{event.at?.toDate?.().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) || "Kaydediliyor"} · {users.find(user => user.id === event.actorUid)?.email || event.actorUid} · {event.detail}</li>)}</ul></details>
      <details><summary className="cursor-pointer text-sm font-semibold">Belge yükle / belgeleri görüntüle</summary><GoogleDriveFolder stepId={step.id} storageLocation={step.outputs} currentProjectId={projectId} clientMode={!isAdmin} /></details>
    </div>
  </details>;
}
