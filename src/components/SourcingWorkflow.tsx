import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { ClipboardList } from "lucide-react";
import { auth, db } from "../lib/firebase";
import { sourcingWorkflow, type WorkflowStep } from "../data/sourcingWorkflow";
import { logisticsWorkflow } from "../data/logisticsWorkflow";
import { RotateCcw } from "lucide-react";
import { useProjectData } from "../lib/useProjectData";
import InventoryStepPanel, { inventoryCollections, inventorySteps } from "./InventoryStepPanel";
import { INITIAL_SOP_STEPS } from "../types";
import { UserTenant } from "../data/usersData";
import { affectedSteps, canAdvance, dependencies, TaskRecord, validateCompletion, workflowStatuses } from "../domain/workflow";
import { eventData, operationCollection } from "../lib/operationsStore";
import GoogleDriveFolder from "./GoogleDriveFolder";
import TargetSpecificationEditor, { createTargetSpecification } from "./TargetSpecificationEditor";
import SupplierLongListEditor, { SupplierCandidate } from "./SupplierLongListEditor";
import RfqSubmissionEditor, { createRfqForm } from "./RfqSubmissionEditor";
import ValueChainCostingEditor, { createValueChainCosting } from "./ValueChainCostingEditor";
import IntroductionMeetingEditor, { validateMeetings } from "./IntroductionMeetingEditor";
import RfqComparisonMatrix from "./RfqComparisonMatrix";
import { createMatrix, validateMatrix } from "../domain/rfqMatrix";

const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:bg-slate-100";
type WorkflowKey = "sourcing" | "logistics";
const taskRef = (projectId: string, id: string, workflow: WorkflowKey = "sourcing") => doc(db, "sopSteps", `${projectId}_${workflow}-${id}`);
type Step = WorkflowStep;
interface WorkflowGroup { prefix: string; label: string; title: string; subtitle: string; subsection: string }
interface WorkflowConfig { key: WorkflowKey; section: "A" | "B"; title: string; note: string; steps: Step[]; groups: WorkflowGroup[]; translate: boolean; logistics: boolean }
// One component drives both workflows; the sourcing entry keeps its original texts and behaviour.
const workflows: Record<WorkflowKey, WorkflowConfig> = {
  sourcing: { key: "sourcing", section: "A", title: "Tedarik İş Akışı", note: "Uçtan uca tedarik süreci", steps: sourcingWorkflow, translate: true, logistics: false, groups: [
    { prefix: "A.A.", label: "A.A · Keşif ve Fizibilite", title: "Keşif ve fizibilite", subtitle: "Projenin temellerini oluşturun", subsection: "Keşif ve Fizibilite" },
    { prefix: "A.B.", label: "A.B · Teklif, Kalite ve Uyumluluk", title: "Teklif, kalite ve uyumluluk", subtitle: "Tedarik sürecini doğrulayın ve tamamlayın", subsection: "Teklif, Kalite ve Uyumluluk" },
  ] },
  logistics: { key: "logistics", section: "B", title: "Üretim & Lojistik İş Akışı", note: "Siparişten teslimata ve stok planlamaya", steps: logisticsWorkflow, translate: false, logistics: true, groups: [
    { prefix: "B.A.", label: "B.A · Stratejik Proje Uyumu ve Koordinasyon", title: "Stratejik proje uyumu ve koordinasyon", subtitle: "Siparişten teslimata sevkiyat koordinasyonu", subsection: "Stratejik Proje Uyumu ve Koordinasyon" },
    { prefix: "B.B.", label: "B.B · Envanter Planlama ve Tahmin", title: "Envanter planlama ve tahmin", subtitle: "Stok seviyelerini ve tahminleri yönetin", subsection: "Envanter Planlama ve Tahmin" },
  ] },
};
const roleLabels: Record<string, string> = { "Project Manager": "Proje Yöneticisi", "Sourcing Manager": "Tedarik Yöneticisi", "General Manager": "Genel Müdür" };
const istanbulToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

export default function SourcingWorkflow({ projectId, currentUser, workflow = "sourcing" }: { projectId: string; currentUser: UserTenant; workflow?: WorkflowKey }) {
  const config = workflows[workflow];
  // Logistics cards read the OperationsHub stock data; the sourcing workflow subscribes to nothing extra.
  const inventory = useProjectData(projectId, config.logistics ? inventoryCollections : []);
  const [records, setRecords] = useState<Record<string, TaskRecord>>({});
  const [users, setUsers] = useState<UserTenant[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true); setRecords({}); setError("");
    // Live snapshots keep approvals consistent across open sessions.
    const stop = onSnapshot(query(collection(db, "sopSteps"), where("projectId", "==", projectId)), snapshot => {
      setRecords(Object.fromEntries(snapshot.docs.filter(item => item.data().workflow === config.key).map(item => [item.data().stepId, item.data() as TaskRecord])));
      setLoading(false);
    }, () => { setError("İş akışı yüklenemedi. Bağlantı veya erişim yetkinizi kontrol edin."); setLoading(false); });
    const stopUsers = currentUser.role === "admin" ? onSnapshot(collection(db, "users"), snapshot => {
      setUsers(snapshot.docs.map(item => ({ ...item.data(), role: item.data().role === "owner" ? "admin" : item.data().role, id: item.id } as UserTenant)).filter(user => !user.legacyAccount && !["suspended", "Askıya Alındı"].includes(user.status || "") && (user.role === "admin" || user.projectId === projectId || user.assignedProjects?.includes(projectId))));
    }, () => setError("Görev atanabilecek kullanıcılar yüklenemedi.")) : () => {};
    const eventsQuery = currentUser.role === "freelancer" ? query(operationCollection(projectId, "events"),where("action","in",["workflow_save","workflow_approve","workflow_reject"])) : operationCollection(projectId, "events");
    const stopEvents = onSnapshot(eventsQuery, snapshot => setEvents(snapshot.docs.map(item => ({ ...item.data(), id: item.id })).filter((item: any) => item.entityId?.startsWith(`${config.section}.`))), () => {});
    return () => { stop(); stopUsers(); stopEvents(); };
  }, [projectId, currentUser.id, currentUser.role, config.key]);

  return <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby={`${config.key}-workflow-title`}>
    <h2 id={`${config.key}-workflow-title`} className="flex items-center gap-3 text-xl font-bold"><ClipboardList />{config.title}</h2>
    <p className="mt-2 text-sm text-slate-600">Sorumlu atayın, belge ekleyin ve tamamlanan işi onaya gönderin. Ön koşulları onaylanmayan adımlara başlanamaz.</p>
    <div className="my-4 flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-indigo-50 px-3 py-1">{config.steps.filter(step => records[step.id]?.approval === "approved" && records[step.id]?.workflowStatus === "completed").length} / {config.steps.length} onaylandı</span><span className="rounded-full bg-amber-50 px-3 py-1">{config.steps.filter(step => records[step.id]?.approval === "pending").length} onay bekliyor</span></div>
    {error && <p role="alert" className="my-3 text-red-700">{error}</p>}
    {loading ? <p>Yükleniyor…</p> : config.groups.map(({ prefix, label }) => <div key={prefix} className="mt-6">
      <h3 className="mb-3 font-bold">{label}</h3>
      <div className="space-y-3">{config.steps.filter(step => step.id.startsWith(prefix)).map(step => <TaskEditor key={`${projectId}:${step.id}`} config={config} inventory={inventory} projectId={projectId} step={step} record={records[step.id]} users={users} currentUser={currentUser} records={records} events={events.filter(event => event.entityId === step.id)} />)}</div>
    </div>)}
  </section>;
}

function TaskEditor({ config, inventory, projectId, step, record, users, currentUser, records, events }: { config: WorkflowConfig; inventory: { data: Record<string, any[]>; loading: boolean; error: string }; projectId: string; step: Step; record?: TaskRecord; users: UserTenant[]; currentUser: UserTenant; records: Record<string, TaskRecord>; events: any[] }) {
  const [draft, setDraft] = useState<TaskRecord>({ stepId: step.id, workflowStatus: "not_started", ...record });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const dueDateInput = useRef<HTMLInputElement>(null);
  const translated = config.translate ? INITIAL_SOP_STEPS.find(item => item.id === step.id) : undefined;
  const blocked = canAdvance(step.id, records);
  const isAdmin = currentUser.role === "admin";
  const canEdit = isAdmin || record?.assigneeUid === currentUser.id;
  const approved = record?.approval === "approved";
  const overdue = config.logistics && !approved && !!record?.dueDate && record.dueDate < istanbulToday();
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
      if (action === "save" && step.id === "A.B.2" && isAdmin) {
        if (draft.workflowStatus === "completed") validateMeetings(draft.introductionMeetings ?? []);
        if (new TextEncoder().encode(JSON.stringify(draft.introductionMeetings ?? [])).length > 500000) throw new Error("Toplantı notları çok büyük. Lütfen uzun notları belge bağlantısı olarak ekleyin.");
      }
      if (action === "save" && step.id === "A.B.6" && isAdmin && draft.rfqComparisonMatrix) {
        validateMatrix(draft.rfqComparisonMatrix);
        if (new TextEncoder().encode(JSON.stringify(draft.rfqComparisonMatrix)).length > 500000) throw new Error("The RFQ matrix is too large. Shorten long values or notes.");
      }
      if (action === "save" && step.id === "A.A.6" && new TextEncoder().encode(JSON.stringify(draft.valueChainCosting ?? {})).length > 500000) throw new Error("Maliyet tablosu çok büyük. Lütfen uzun açıklamaları kısaltın.");
      if (step.id === "A.A.2" && new TextEncoder().encode(JSON.stringify(draft.targetSpecification || [])).length > 500000) throw new Error("Özellik formu çok büyük. Lütfen uzun içerikleri belge bağlantısı olarak ekleyin.");
      await runTransaction(db, async tx => {
        const ref = taskRef(projectId, step.id, config.key); const snapshot = await tx.get(ref);
        const current = snapshot.data() as TaskRecord | undefined;
        if ((current?.updatedAt?.seconds || 0) !== (record?.updatedAt?.seconds || 0) || (current?.updatedAt?.nanoseconds || 0) !== (record?.updatedAt?.nanoseconds || 0)) throw new Error("Bu adım başka bir oturumda değişti. Güncel kaydı kontrol edip yeniden deneyin.");
        const prerequisites: Record<string, TaskRecord> = {};
        for (const id of dependencies[step.id] || []) { const snapshot = await tx.get(taskRef(projectId, id, config.key)); prerequisites[id] = snapshot.data() as TaskRecord; }
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
            id: `${config.key}-${step.id}`, projectId, workflow: config.key, stepId: step.id, section: config.section,
            subsection: config.groups.find(group => step.id.startsWith(group.prefix))?.subsection ?? "",
            task: step.task.trim(), requester: step.requester, taskOwner: step.owner, kpiMetric: step.metric.trim(), kpiTimeDays: step.days,
            ...(config.logistics ? { approver: step.approver, approvalDays: step.approvalDays, ...(step.period ? { kpiPeriod: step.period } : {}) } : {}),
            status: draft.workflowStatus === "completed" ? "Completed" : draft.workflowStatus === "in_progress" ? "In Progress" : "Pending",
            workflowStatus: draft.workflowStatus, assigneeUid: draft.assigneeUid || "", approverUid: draft.approverUid || "",
            dueDate: candidate.dueDate, notes: draft.notes || "", evidenceName: draft.evidenceName || "", evidenceUrl: draft.evidenceUrl || "",
            approval: draft.workflowStatus === "completed" ? "pending" : "none", completedBy: draft.workflowStatus === "completed" ? uid : "",
            rejectionReason: "", updatedAt: serverTimestamp(),
            ...(step.id === "A.A.2" && isAdmin ? { targetSpecification: draft.targetSpecification ?? createTargetSpecification() } : {}),
            ...(step.id === "A.A.3" && isAdmin ? { supplierLongList: draft.supplierLongList ?? [] } : {}),
            ...(step.id === "A.A.5" && isAdmin ? { supplierShortList: draft.supplierShortList ?? [] } : {}),
            ...(step.id === "A.A.4" && isAdmin ? { rfqForms: draft.rfqForms ?? [createRfqForm()] } : {}),
            ...(step.id === "A.A.6" && isAdmin ? { valueChainCosting: draft.valueChainCosting ?? createValueChainCosting() } : {}),
            ...(step.id === "A.B.2" && isAdmin ? { introductionMeetings: draft.introductionMeetings ?? [] } : {}),
            ...(step.id === "A.B.6" && isAdmin ? { rfqComparisonMatrix: draft.rfqComparisonMatrix ?? createMatrix() } : {}),
          };
        } else {
          if (!current || current.approverUid !== uid || (action === "approve" && current.completedBy === uid)) throw new Error("Yalnızca atanmış onaylayan karar verebilir; işlemi yapan kişi kendi işini onaylayamaz.");
          if (action === "approve" && current.approval !== "pending") throw new Error("Bu kayıt onay beklemiyor.");
          if (action === "approve") validateCompletion(current);
          if (action === "reject" && !reason.trim()) throw new Error("Ret / iade gerekçesini yazın.");
          const targets = affectedSteps([step.id, ...(step.returnTo || "").split("/").filter(id => config.steps.some(item => item.id === id))]).filter(id => id !== step.id);
          const targetSnapshots = [];
          if (action === "reject") for (const id of targets) targetSnapshots.push({ id, snapshot: await tx.get(taskRef(projectId, id, config.key)) });
          next = { approval: action === "approve" ? "approved" : "rejected", workflowStatus: action === "approve" ? "completed" : "incomplete", status: action === "approve" ? "Completed" : "Pending", rejectionReason: action === "reject" ? reason.trim() : "", decidedBy: uid, updatedAt: serverTimestamp() };
          for (const target of targetSnapshots) if (target.snapshot.exists()) tx.update(taskRef(projectId, target.id, config.key), { workflowStatus: "incomplete", status: "Pending", approval: "none", rejectionReason: `${step.id}: ${reason.trim()}`.slice(0,1500), returnedFrom: step.id, lastEventId: eventRef.id, updatedAt: serverTimestamp() });
        }
        tx.set(ref, { ...next, lastEventId: eventRef.id }, { merge: true });
        tx.set(eventRef, { ...eventData(`workflow_${action}`, step.id, action === "reject" ? reason : action === "approve" ? "Onaylandı" : workflowStatuses[draft.workflowStatus]), projectId });
      });
      setMessage("Kaydedildi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kaydedilemedi."); }
    finally { setBusy(false); }
  };
  // Archives an approved recurring step as a past period and reopens it for the next one.
  const startNewPeriod = async () => {
    if (!window.confirm(`${step.id} için yeni dönem başlatılsın mı? Mevcut onaylı dönem geçmişe kaydedilir.`)) return;
    setBusy(true); setMessage("");
    try {
      const uid = auth.currentUser?.uid; if (!uid) throw new Error("Oturum açın.");
      await runTransaction(db, async tx => {
        const ref = taskRef(projectId, step.id, config.key); const current = (await tx.get(ref)).data() as TaskRecord | undefined;
        if (!current || current.approval !== "approved") throw new Error("Yeni dönem yalnızca onaylanmış adımda başlatılabilir.");
        const history = current.periodHistory ?? [];
        if (history.length >= 200) throw new Error("Dönem geçmişi dolu (200). Eski dönemleri arşivleyin.");
        const eventRef = doc(operationCollection(projectId, "events"));
        tx.set(ref, {
          periodHistory: [...history, { period: history.length + 1, dueDate: current.dueDate || "", evidenceName: current.evidenceName || "", evidenceUrl: current.evidenceUrl || "", notes: current.notes || "", completedBy: current.completedBy || "", decidedBy: current.decidedBy || "", approvedAt: current.updatedAt ?? null }],
          workflowStatus: "not_started", status: "Pending", approval: "none", completedBy: "", rejectionReason: "", dueDate: "", evidenceName: "", evidenceUrl: "", notes: "",
          updatedAt: serverTimestamp(), lastEventId: eventRef.id,
        }, { merge: true });
        tx.set(eventRef, { ...eventData("workflow_period", step.id, `Dönem ${history.length + 1} kapatıldı, yeni dönem başlatıldı`), projectId });
      });
      setMessage("Yeni dönem başlatıldı.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Yeni dönem başlatılamadı."); }
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
      <span className={`rounded-full px-2 py-1 text-xs ${approved ? "bg-emerald-100 text-emerald-800" : record?.approval === "pending" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{approved ? "Onaylandı" : record?.approval === "pending" ? "Onay bekliyor" : workflowStatuses[record?.workflowStatus || "not_started"]}</span>{overdue && <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Gecikti</span>}<span className="text-xs text-slate-500">{step.period ?? `${step.days} gün`}</span><span className="text-indigo-600">Ayrıntılar ↕</span>
    </summary>
    <div className="space-y-4 border-t p-4">
      {config.logistics && inventorySteps.includes(step.id) && <InventoryStepPanel stepId={step.id} projectId={projectId} data={inventory.data} loading={inventory.loading} error={inventory.error} canPlan={isAdmin && !approved && !busy} />}
      {step.id === "A.A.2" && <TargetSpecificationEditor sections={draft.targetSpecification ?? createTargetSpecification()} onChange={sections => setDraft(previous => ({ ...previous, targetSpecification: sections }))} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.A.3" && <SupplierLongListEditor shortlistedIds={(records["A.A.5"]?.supplierShortList ?? []).map((item: SupplierCandidate) => item.id)} onShortlist={isAdmin ? company => { if (!busy) void shortlist(company); } : undefined} companies={draft.supplierLongList ?? []} onChange={companies => setDraft(previous => ({ ...previous, supplierLongList: companies }))} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.A.5" && <SupplierLongListEditor title="Üretici Kısa Listesi" description="A.A.3 geniş tedarikçi listesinden kısa listeye alınacak üreticileri (en az 3 firma) seçin; gerekirse bilgilerini düzenleyin veya listeden çıkarın." source={records["A.A.3"]?.supplierLongList ?? []} companies={draft.supplierShortList ?? []} onChange={companies => setDraft(previous => ({ ...previous, supplierShortList: companies }))} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.A.4" && <RfqSubmissionEditor forms={draft.rfqForms ?? [createRfqForm()]} onChange={forms => setDraft(previous => ({ ...previous, rfqForms: forms }))} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.A.6" && <ValueChainCostingEditor costing={draft.valueChainCosting ?? createValueChainCosting()} onChange={costing => setDraft(previous => ({ ...previous, valueChainCosting: costing }))} manufacturers={(records["A.A.5"]?.supplierShortList ?? []).map((item: SupplierCandidate) => item.name).filter(Boolean)} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.B.2" && <IntroductionMeetingEditor meetings={draft.introductionMeetings ?? []} onChange={meetings => setDraft(previous => ({ ...previous, introductionMeetings: meetings }))} manufacturers={(records["A.A.5"]?.supplierShortList ?? []).map((item: SupplierCandidate) => item.name).filter(Boolean)} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.B.6" && <RfqComparisonMatrix matrix={draft.rfqComparisonMatrix} onChange={matrix => setDraft(previous => ({ ...previous, rfqComparisonMatrix: matrix }))} isAdmin={isAdmin} shortlist={(records["A.A.5"]?.supplierShortList ?? []).map((item: SupplierCandidate) => item.name).filter(Boolean)} disabled={!isAdmin || busy || approved} />}
      <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2"><p><strong>KPI:</strong> {translated?.kpiMetric || step.metric}</p><p><strong>Gerekli çıktı:</strong> {translated?.requiredOutputs || step.outputs}</p><p><strong>Ön koşul:</strong> {dependencies[step.id]?.join(", ") || "Yok"}</p><p><strong>Reddedilirse dönüş:</strong> {step.returnTo || "Aynı adım"}</p>{config.logistics && <><p><strong>Süre:</strong> {step.period ?? `${step.days} gün`}{step.approvalDays !== null && ` · Onay: ${step.approvalDays} gün`}</p><p><strong>Roller:</strong> Talep eden {roleLabels[step.requester] ?? step.requester} · Sorumlu {roleLabels[step.owner] ?? step.owner} · Onaylayan {roleLabels[step.approver] ?? step.approver}</p></>}</div>
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
      {step.period && approved && isAdmin && <button onClick={() => void startNewPeriod()} disabled={busy} className="flex items-center gap-2 rounded-lg border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700 disabled:opacity-50"><RotateCcw className="h-4 w-4" /> Yeni dönem başlat</button>}
      <p role="status" className="text-sm text-indigo-800">{message}</p>
      {(record?.cycleHistory?.length ?? 0) > 0 && <details><summary className="cursor-pointer text-sm font-semibold">Önceki PO döngüleri ({record!.cycleHistory.length})</summary><ul className="mt-2 space-y-2 text-xs text-slate-600">{[...record!.cycleHistory].reverse().map((entry: any) => <li key={entry.cycle} className="rounded-lg bg-slate-50 p-2"><strong>Döngü {entry.cycle}</strong> · onay: {entry.approvedAt?.toDate?.().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) || "—"}{entry.evidenceUrl && <> · <a className="text-teal-700 hover:underline" href={entry.evidenceUrl} target="_blank" rel="noreferrer">{entry.evidenceName || "Belge"}</a></>}{entry.notes && <p className="mt-1 text-slate-500">{entry.notes}</p>}</li>)}</ul></details>}
      {step.period && (record?.periodHistory?.length ?? 0) > 0 && <details><summary className="cursor-pointer text-sm font-semibold">Geçmiş dönemler ({record!.periodHistory.length})</summary><ul className="mt-2 space-y-2 text-xs text-slate-600">{[...record!.periodHistory].reverse().map((entry: any) => <li key={entry.period} className="rounded-lg bg-slate-50 p-2"><strong>Dönem {entry.period}</strong> · onay: {entry.approvedAt?.toDate?.().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) || "—"}{entry.dueDate && ` · hedef: ${entry.dueDate}`} · {users.find(user => user.id === entry.completedBy)?.email || entry.completedBy || "—"}{entry.evidenceUrl && <> · <a className="text-teal-700 hover:underline" href={entry.evidenceUrl} target="_blank" rel="noreferrer">{entry.evidenceName || "Belge"}</a></>}{entry.notes && <p className="mt-1 text-slate-500">{entry.notes}</p>}</li>)}</ul></details>}
      <details><summary className="cursor-pointer text-sm font-semibold">İşlem geçmişi ({events.length})</summary><ul className="mt-2 space-y-2 text-xs text-slate-600">{[...events].sort((a,b) => (b.at?.seconds || 0) - (a.at?.seconds || 0)).map(event => <li key={event.id}>{event.at?.toDate?.().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) || "Kaydediliyor"} · {users.find(user => user.id === event.actorUid)?.email || event.actorUid} · {event.detail}</li>)}</ul></details>
      <details><summary className="cursor-pointer text-sm font-semibold">Belge yükle / belgeleri görüntüle</summary><GoogleDriveFolder stepId={step.id} storageLocation={step.outputs} currentProjectId={projectId} clientMode={!isAdmin} /></details>
    </div>
  </details>;
}
