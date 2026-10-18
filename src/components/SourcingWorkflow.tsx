import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { ClipboardList, Search, CheckCheck, Clock3, CircleDot, Layers3, ChevronDown } from "lucide-react";
import { auth, db } from "../lib/firebase";
import { sourcingWorkflow, type WorkflowStep } from "../data/sourcingWorkflow";
import { logisticsWorkflow } from "../data/logisticsWorkflow";
import { RotateCcw } from "lucide-react";
import { useProjectData } from "../lib/useProjectData";
import InventoryStepPanel, { inventoryCollections, inventorySteps } from "./InventoryStepPanel";
import { UserTenant } from "../data/usersData";
import { affectedSteps, canAdvance, dependencies, TaskRecord, validateCompletion, workflowStatuses } from "../domain/workflow";
import { CodedError, errorMessage, useI18n, type Messages } from "../i18n";
import { eventText } from "../lib/eventText";
import { eventData, operationCollection } from "../lib/operationsStore";
import GoogleDriveFolder from "./GoogleDriveFolder";
import TargetSpecificationEditor, { createTargetSpecification } from "./TargetSpecificationEditor";
import SupplierLongListEditor, { SupplierCandidate } from "./SupplierLongListEditor";
import RfqSubmissionEditor, { createRfqForm } from "./RfqSubmissionEditor";
import ValueChainCostingEditor, { createValueChainCosting } from "./ValueChainCostingEditor";
import IntroductionMeetingEditor, { validateMeetings } from "./IntroductionMeetingEditor";
import RfqComparisonMatrix from "./RfqComparisonMatrix";
import { createMatrix, validateMatrix } from "../domain/rfqMatrix";
import { requiredManufacturerId, specLinkValid } from "../domain/productSpec";
import { useManufacturers, useProductSpecs } from "../lib/productSpecStore";
import { HighPotentialPicker, RecipeCostPreview, SpecLinkPanel } from "./productSpec/WorkflowPanels";

const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:bg-slate-100";
type WorkflowKey = "sourcing" | "logistics";
const taskRef = (projectId: string, id: string, workflow: WorkflowKey = "sourcing") => doc(db, "sopSteps", `${projectId}_${workflow}-${id}`);
type Step = WorkflowStep;
interface WorkflowGroup { prefix: string; label: string; title: string; subtitle: string; subsection: string }
interface WorkflowConfig { key: WorkflowKey; section: "A" | "B"; title: string; note: string; steps: Step[]; groups: WorkflowGroup[]; translate: boolean; logistics: boolean }
// One component drives both workflows. Sourcing texts come from src/i18n; the logistics texts below are translated in phase 2.
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
// Başlık, not ve grup adları: tedarik akışında seçili dilden, lojistikte (2. aşama) yapılandırmadan gelir.
const workflowText = (config: WorkflowConfig, t: Messages) => config.translate
  ? { title: t.sourcing.title, note: t.sourcing.note, groups: config.groups.map(group => ({ ...group, ...t.sourcing.groups[group.prefix] })) }
  : { title: config.title.replace("İş Akışı", "iş akışı"), note: config.note, groups: config.groups };
const stepName = (config: WorkflowConfig, t: Messages, step: Step) => (config.translate ? t.steps[step.id]?.name : undefined) || step.task;
const istanbulToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

export default function SourcingWorkflow({ projectId, currentUser, workflow = "sourcing" }: { projectId: string; currentUser: UserTenant; workflow?: WorkflowKey }) {
  const config = workflows[workflow];
  const { t, fmt } = useI18n();
  const text = workflowText(config, t), s = t.sourcing;
  // Logistics cards read the OperationsHub stock data; the sourcing workflow subscribes to nothing extra.
  const inventory = useProjectData(projectId, config.logistics ? inventoryCollections : []);
  const [records, setRecords] = useState<Record<string, TaskRecord>>({});
  const [users, setUsers] = useState<UserTenant[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    setLoading(true); setRecords({}); setError("");
    // Live snapshots keep approvals consistent across open sessions.
    const stop = onSnapshot(query(collection(db, "sopSteps"), where("projectId", "==", projectId)), snapshot => {
      setRecords(Object.fromEntries(snapshot.docs.filter(item => item.data().workflow === config.key).map(item => [item.data().stepId, item.data() as TaskRecord])));
      setLoading(false);
    }, () => { setError("load"); setLoading(false); });
    const stopUsers = currentUser.role === "admin" ? onSnapshot(collection(db, "users"), snapshot => {
      setUsers(snapshot.docs.map(item => ({ ...item.data(), role: item.data().role === "owner" ? "admin" : item.data().role, id: item.id } as UserTenant)).filter(user => !user.legacyAccount && !["suspended", "Askıya Alındı"].includes(user.status || "") && (user.role === "admin" || user.projectId === projectId || user.assignedProjects?.includes(projectId))));
    }, () => setError("users")) : () => {};
    const eventsQuery = currentUser.role === "freelancer" ? query(operationCollection(projectId, "events"),where("action","in",["workflow_save","workflow_approve","workflow_reject"])) : operationCollection(projectId, "events");
    const stopEvents = onSnapshot(eventsQuery, snapshot => setEvents(snapshot.docs.map(item => ({ ...item.data(), id: item.id })).filter((item: any) => item.entityId?.startsWith(`${config.section}.`))), () => {});
    return () => { stop(); stopUsers(); stopEvents(); };
  }, [projectId, currentUser.id, currentUser.role, config.key]);

  const approvedCount = config.steps.filter(step => records[step.id]?.approval === "approved" && records[step.id]?.workflowStatus === "completed").length;
  const pendingCount = config.steps.filter(step => records[step.id]?.approval === "pending").length;
  const activeCount = config.steps.filter(step => records[step.id]?.workflowStatus === "in_progress").length;
  const matches = config.steps.filter(step => {
    const record = records[step.id];
    const haystack = fmt.lower(`${step.id} ${step.task} ${stepName(config, t, step)}`);
    return haystack.includes(fmt.lower(search)) && (filter === "all" || filter === "pending" && record?.approval === "pending" || filter === "approved" && record?.approval === "approved" || filter === "in_progress" && record?.workflowStatus === "in_progress");
  });
  return <section className="workflow-section space-y-6" aria-labelledby={`${config.key}-workflow-title`}>
    <div className="workflow-metrics" aria-busy={loading}>
      {[{ label: s.metrics.total, count: config.steps.length, icon: Layers3, tone: "slate", note: text.note }, { label: s.metrics.active, count: activeCount, icon: CircleDot, tone: "blue", note: s.metrics.activeNote }, { label: s.metrics.pending, count: pendingCount, icon: Clock3, tone: "amber", note: s.metrics.pendingNote }, { label: s.metrics.done, count: approvedCount, icon: CheckCheck, tone: "teal", note: s.metrics.doneNote }].map(({ label, count, icon: Icon, tone, note }) => <div key={label} className={`metric-card metric-${tone}`}><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">{label}</p><span className="metric-icon"><Icon className="h-[18px] w-[18px]" /></span></div><p className="mt-3 text-3xl font-semibold tracking-tight text-navy">{loading || error ? "—" : count}</p><p className="mt-2 text-[11px] text-slate-400">{note}</p></div>)}
    </div>
    <div className="workflow-board">
      <div className="flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6"><div><h2 id={`${config.key}-workflow-title`} className="text-lg font-semibold text-navy">{text.title}</h2><p className="mt-1.5 text-xs leading-5 text-slate-500">{s.boardSubtitle}</p></div><div className="w-44"><div className="mb-2 flex justify-between text-[10px] font-medium text-slate-500"><span>{s.progress}</span><span>{loading || error ? "—" : `${Math.round(approvedCount / config.steps.length * 100)}%`}</span></div><div role="progressbar" aria-label={s.progressLabel(text.title)} aria-valuemin={0} aria-valuemax={config.steps.length} aria-valuenow={approvedCount} className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${approvedCount / config.steps.length * 100}%` }} /></div></div></div>
      <div className="workflow-toolbar"><div className="workflow-filters" role="group" aria-label={s.filterLabel}>{["all", "in_progress", "pending", "approved"].map(id => [id, s.filters[id]]).map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)} className={filter === id ? "is-selected" : ""}>{label}</button>)}</div><label className="workflow-search"><Search className="h-4 w-4 text-slate-400" /><input type="search" aria-label={s.searchLabel(text.title)} placeholder={s.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} /></label></div>
      {error && <p role="alert" className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error === "users" ? s.usersLoadError : s.loadError}</p>}
      {loading ? <div role="status" className="space-y-3 p-6">{[1,2,3].map(id => <div key={id} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}<p className="text-xs text-slate-500">{s.loading}</p></div> : <div className="p-4 sm:p-6">{text.groups.map(({ prefix, title, subtitle }, index) => {
        const steps = matches.filter(step => step.id.startsWith(prefix));
        if (!steps.length) return null;
        const total = config.steps.filter(step => step.id.startsWith(prefix)).length;
        return <div key={prefix} className="workflow-phase"><div className="phase-heading"><span className="phase-number">0{index + 1}</span><div><h3 className="text-sm font-semibold text-navy">{title}</h3><p className="mt-0.5 text-[10px] text-slate-400">{subtitle}</p></div><span className="ml-auto text-[11px] text-slate-400">{s.stepCount(steps.length, total)}</span></div><div className="space-y-2">{steps.map(step => <TaskEditor key={`${projectId}:${step.id}`} config={config} inventory={inventory} projectId={projectId} step={step} record={records[step.id]} users={users} currentUser={currentUser} records={records} events={events.filter(event => event.entityId === step.id)} />)}</div></div>;
      })}{!matches.length && <div className="py-12 text-center"><Search className="mx-auto mb-3 h-7 w-7 text-slate-300" /><p className="text-sm font-semibold text-navy">{s.noMatchTitle}</p><p className="mt-2 text-xs text-slate-500">{s.noMatchText}</p><button onClick={() => { setFilter("all"); setSearch(""); }} className="mt-4 rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-white">{s.showAll}</button></div>}</div>}
      <div className="flex items-center gap-2 border-t border-slate-100 px-6 py-4 text-[11px] text-slate-400"><ClipboardList className="h-3.5 w-3.5" /> {s.footer}</div>
    </div>
  </section>;
}

function TaskEditor({ config, inventory, projectId, step, record, users, currentUser, records, events }: { config: WorkflowConfig; inventory: { data: Record<string, any[]>; loading: boolean; error: string }; projectId: string; step: Step; record?: TaskRecord; users: UserTenant[]; currentUser: UserTenant; records: Record<string, TaskRecord>; events: any[] }) {
  const [draft, setDraft] = useState<TaskRecord>({ stepId: step.id, workflowStatus: "not_started", ...record });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const dueDateInput = useRef<HTMLInputElement>(null);
  const { t, fmt } = useI18n();
  const s = t.sourcing, d = s.details;
  const translated = config.translate ? t.steps[step.id] : undefined;
  const days = (count: number) => s.days(count);
  const role = (name: string) => s.roles[name] ?? name;
  const dateOf = (value: any) => value?.toDate ? fmt.date(value.toDate(), { day: "numeric", month: "short", year: "numeric" }) : "—";
  const blocked = canAdvance(step.id, records);
  const isAdmin = currentUser.role === "admin";
  const canEdit = isAdmin || record?.assigneeUid === currentUser.id;
  const approved = record?.approval === "approved";
  const overdue = config.logistics && !approved && !!record?.dueDate && record.dueDate < istanbulToday();
  // Ürün reçetesi bağlantıları: A.B.7 üretici seçer, A.B.8 onaylı reçeteyi bağlar, A.B.9 satırları reçeteden alır.
  const manufacturers = useManufacturers(projectId, step.id === "A.B.7" || step.id === "A.B.8");
  const { specs } = useProductSpecs(projectId, step.id === "A.B.8" || step.id === "A.B.9");
  useEffect(() => { setDraft({ stepId: step.id, workflowStatus: "not_started", ...record }); }, [record?.updatedAt?.seconds, record?.updatedAt?.nanoseconds, record?.workflowStatus, record?.approval]);
  const change = (name: string, value: string) => setDraft(previous => ({ ...previous, [name]: value }));
  const save = async (action: "save" | "approve" | "reject") => {
    const candidate = { ...draft, dueDate: dueDateInput.current?.value || draft.dueDate || "" };
    setBusy(true); setMessage("");
    try {
      const uid = auth.currentUser?.uid; if (!uid) throw new CodedError("signIn");
      if (action === "save" && step.id === "A.A.4" && new TextEncoder().encode(JSON.stringify(draft.rfqForms ?? [])).length > 500000) throw new CodedError("rfqTooLarge");
      if (action === "save" && (step.id === "A.A.3" || step.id === "A.A.5") && isAdmin) {
        const companies: SupplierCandidate[] = (step.id === "A.A.3" ? draft.supplierLongList : draft.supplierShortList) ?? [];
        if (companies.some(company => !company.name.trim())) throw new CodedError("companyNameMissing");
        if (new TextEncoder().encode(JSON.stringify(companies)).length > 500000) throw new CodedError("companiesTooLarge");
      }
      if (action === "save" && step.id === "A.B.2" && isAdmin) {
        if (draft.workflowStatus === "completed") validateMeetings(draft.introductionMeetings ?? []);
        if (new TextEncoder().encode(JSON.stringify(draft.introductionMeetings ?? [])).length > 500000) throw new CodedError("meetingsTooLarge");
      }
      if (action === "save" && step.id === "A.B.6" && isAdmin && draft.rfqComparisonMatrix) {
        validateMatrix(draft.rfqComparisonMatrix);
        if (new TextEncoder().encode(JSON.stringify(draft.rfqComparisonMatrix)).length > 500000) throw new CodedError("matrixTooLarge");
      }
      if (action === "save" && step.id === "A.A.6" && new TextEncoder().encode(JSON.stringify(draft.valueChainCosting ?? {})).length > 500000) throw new CodedError("costingTooLarge");
      if (action === "save" && step.id === "A.B.7" && draft.workflowStatus === "completed" && !draft.highPotentialManufacturerId) throw new CodedError("ab7Required");
      if (action === "save" && step.id === "A.B.8" && draft.workflowStatus === "completed" && !specLinkValid(specs.find(spec => spec.id === draft.approvedSpecId), requiredManufacturerId(records["A.B.7"], draft))) throw new CodedError("ab8Required");
      if (action === "save" && step.id === "A.B.9" && new TextEncoder().encode(JSON.stringify(draft.recipeCostLines ?? [])).length > 500000) throw new CodedError("costLinesTooLarge");
      if (step.id === "A.A.2" && new TextEncoder().encode(JSON.stringify(draft.targetSpecification || [])).length > 500000) throw new CodedError("specTooLarge");
      await runTransaction(db, async tx => {
        const ref = taskRef(projectId, step.id, config.key); const snapshot = await tx.get(ref);
        const current = snapshot.data() as TaskRecord | undefined;
        if ((current?.updatedAt?.seconds || 0) !== (record?.updatedAt?.seconds || 0) || (current?.updatedAt?.nanoseconds || 0) !== (record?.updatedAt?.nanoseconds || 0)) throw new CodedError("conflict");
        const prerequisites: Record<string, TaskRecord> = {};
        for (const id of dependencies[step.id] || []) { const snapshot = await tx.get(taskRef(projectId, id, config.key)); prerequisites[id] = snapshot.data() as TaskRecord; }
        if ((action === "save" && ["in_progress", "completed"].includes(draft.workflowStatus)) || action === "approve") {
          const missing = canAdvance(step.id, prerequisites);
          if (missing.length) throw new CodedError("prerequisites", { ids: missing.join(", ") });
        }
        const eventRef = doc(operationCollection(projectId, "events"));
        let next: Record<string, unknown>;
        if (action === "save") {
          if (!canEdit) throw new CodedError("noEditRight");
          if (current?.approval === "approved") throw new CodedError("approvedLocked");
          if (draft.workflowStatus === "completed") validateCompletion(candidate);
          next = {
            id: `${config.key}-${step.id}`, projectId, workflow: config.key, stepId: step.id, section: config.section,
            // Dilden bağımsız grup kodu (A.A, A.B…); eski kayıtlardaki Türkçe metin hiçbir yerde okunmaz.
            subsection: config.groups.find(group => step.id.startsWith(group.prefix))?.prefix.slice(0, -1) ?? "",
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
            ...(step.id === "A.B.7" && isAdmin ? { highPotentialManufacturerId: draft.highPotentialManufacturerId ?? "", highPotentialManufacturerName: draft.highPotentialManufacturerName ?? "" } : {}),
            ...(step.id === "A.B.8" && isAdmin ? { approvedSpecId: draft.approvedSpecId ?? "", specManufacturerId: draft.specManufacturerId ?? "", specManufacturerName: draft.specManufacturerName ?? "", specManufacturerFallback: !!draft.specManufacturerFallback } : {}),
            ...(step.id === "A.B.9" && isAdmin ? { recipeCostLines: draft.recipeCostLines ?? [], recipeCostSource: draft.recipeCostSource ?? null } : {}),
          };
        } else {
          if (!current || current.approverUid !== uid || (action === "approve" && current.completedBy === uid)) throw new CodedError("onlyApprover");
          if (action === "approve" && current.approval !== "pending") throw new CodedError("notPending");
          if (action === "approve") validateCompletion(current);
          if (action === "reject" && !reason.trim()) throw new CodedError("rejectReasonMissing");
          const targets = affectedSteps([step.id, ...(step.returnTo || "").split("/").filter(id => config.steps.some(item => item.id === id))]).filter(id => id !== step.id);
          const targetSnapshots = [];
          if (action === "reject") for (const id of targets) targetSnapshots.push({ id, snapshot: await tx.get(taskRef(projectId, id, config.key)) });
          next = { approval: action === "approve" ? "approved" : "rejected", workflowStatus: action === "approve" ? "completed" : "incomplete", status: action === "approve" ? "Completed" : "Pending", rejectionReason: action === "reject" ? reason.trim() : "", decidedBy: uid, updatedAt: serverTimestamp() };
          for (const target of targetSnapshots) if (target.snapshot.exists()) tx.update(taskRef(projectId, target.id, config.key), { workflowStatus: "incomplete", status: "Pending", approval: "none", rejectionReason: `${step.id}: ${reason.trim()}`.slice(0,1500), returnedFrom: step.id, lastEventId: eventRef.id, updatedAt: serverTimestamp() });
        }
        tx.set(ref, { ...next, lastEventId: eventRef.id }, { merge: true });
        // Durum dilden bağımsız anahtarla saklanır (statusKey); ret gerekçesi kullanıcı metnidir.
        const statusKey = action === "approve" ? "approved" : action === "save" ? draft.workflowStatus : "";
        tx.set(eventRef, { ...eventData(`workflow_${action}`, step.id, action === "reject" ? reason : statusKey), ...(statusKey ? { statusKey } : {}), projectId });
      });
      setMessage(t.common.saved);
    } catch (error) { setMessage(errorMessage(t, error, t.common.saveFailed)); }
    finally { setBusy(false); }
  };
  // Archives an approved recurring step as a past period and reopens it for the next one.
  const startNewPeriod = async () => {
    if (!window.confirm(s.messages.newPeriodConfirm(step.id))) return;
    setBusy(true); setMessage("");
    try {
      const uid = auth.currentUser?.uid; if (!uid) throw new CodedError("signIn");
      await runTransaction(db, async tx => {
        const ref = taskRef(projectId, step.id, config.key); const current = (await tx.get(ref)).data() as TaskRecord | undefined;
        if (!current || current.approval !== "approved") throw new CodedError("newPeriodOnlyApproved");
        const history = current.periodHistory ?? [];
        if (history.length >= 200) throw new CodedError("periodHistoryFull");
        const eventRef = doc(operationCollection(projectId, "events"));
        tx.set(ref, {
          periodHistory: [...history, { period: history.length + 1, dueDate: current.dueDate || "", evidenceName: current.evidenceName || "", evidenceUrl: current.evidenceUrl || "", notes: current.notes || "", completedBy: current.completedBy || "", decidedBy: current.decidedBy || "", approvedAt: current.updatedAt ?? null }],
          workflowStatus: "not_started", status: "Pending", approval: "none", completedBy: "", rejectionReason: "", dueDate: "", evidenceName: "", evidenceUrl: "", notes: "",
          updatedAt: serverTimestamp(), lastEventId: eventRef.id,
        }, { merge: true });
        tx.set(eventRef, { ...eventData("workflow_period", step.id, String(history.length + 1)), detailKey: "periodClosed", detailParams: { period: String(history.length + 1) }, projectId });
      });
      setMessage(s.messages.newPeriodStarted);
    } catch (error) { setMessage(errorMessage(t, error, s.messages.newPeriodFailed)); }
    finally { setBusy(false); }
  };
  // Copies a long-list company into the A.A.5 record without touching that step's status.
  const shortlist = async (company: SupplierCandidate) => {
    setBusy(true); setMessage("");
    try {
      if (!auth.currentUser?.uid) throw new CodedError("signIn");
      await runTransaction(db, async tx => {
        const ref = taskRef(projectId, "A.A.5"); const snapshot = await tx.get(ref);
        const current = snapshot.data() as TaskRecord | undefined;
        if (current?.approval === "approved" || current?.approval === "pending") throw new CodedError("shortlistLocked");
        const list: SupplierCandidate[] = current?.supplierShortList ?? [];
        if (list.some(item => item.id === company.id)) return;
        const eventRef = doc(operationCollection(projectId, "events"));
        tx.set(ref, { ...(current ? {} : { id: "sourcing-A.A.5", projectId, workflow: "sourcing", stepId: "A.A.5", section: "A", workflowStatus: "not_started", status: "Pending", approval: "none" }), supplierShortList: [...list, { ...company }], updatedAt: serverTimestamp(), lastEventId: eventRef.id }, { merge: true });
        tx.set(eventRef, { ...eventData("workflow_save", "A.A.5", company.name), detailKey: "shortlisted", detailParams: { name: company.name }, projectId });
      });
      setMessage(s.messages.shortlisted(company.name));
    } catch (error) { setMessage(errorMessage(t, error, s.messages.shortlistFailed)); }
    finally { setBusy(false); }
  };
  return <details data-testid={`task-${step.id}`} className="workflow-task group rounded-xl border border-slate-200 bg-white open:border-teal-300">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 text-sm [&::-webkit-details-marker]:hidden">
      <span className="rounded-lg bg-indigo-50 px-2 py-1 font-bold text-indigo-700">{step.id}</span><span className="min-w-0 flex-1 font-semibold">{stepName(config, t, step)}</span>
      <span className={`rounded-full px-2 py-1 text-xs ${approved ? "bg-emerald-100 text-emerald-800" : record?.approval === "pending" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{approved ? t.status.approved : record?.approval === "pending" ? t.status.pending : t.status.workflow[record?.workflowStatus || "not_started"]}</span>{overdue && <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">{t.status.overdue}</span>}<span className="text-xs text-slate-500">{step.period ?? days(step.days)}</span><ChevronDown className="task-chevron h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
    </summary>
    <div className="space-y-4 border-t p-4">
      {config.logistics && inventorySteps.includes(step.id) && <InventoryStepPanel stepId={step.id} projectId={projectId} data={inventory.data} loading={inventory.loading} error={inventory.error} canPlan={isAdmin && !approved && !busy} />}
      {step.id === "A.A.2" && <TargetSpecificationEditor sections={draft.targetSpecification ?? createTargetSpecification()} onChange={sections => setDraft(previous => ({ ...previous, targetSpecification: sections }))} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.A.3" && <SupplierLongListEditor shortlistedIds={(records["A.A.5"]?.supplierShortList ?? []).map((item: SupplierCandidate) => item.id)} onShortlist={isAdmin ? company => { if (!busy) void shortlist(company); } : undefined} companies={draft.supplierLongList ?? []} onChange={companies => setDraft(previous => ({ ...previous, supplierLongList: companies }))} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.A.5" && <SupplierLongListEditor title={t.editors.suppliers.shortTitle} description={t.editors.suppliers.shortDescription} source={records["A.A.3"]?.supplierLongList ?? []} companies={draft.supplierShortList ?? []} onChange={companies => setDraft(previous => ({ ...previous, supplierShortList: companies }))} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.A.4" && <RfqSubmissionEditor forms={draft.rfqForms ?? [createRfqForm()]} onChange={forms => setDraft(previous => ({ ...previous, rfqForms: forms }))} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.A.6" && <ValueChainCostingEditor costing={draft.valueChainCosting ?? createValueChainCosting()} onChange={costing => setDraft(previous => ({ ...previous, valueChainCosting: costing }))} manufacturers={(records["A.A.5"]?.supplierShortList ?? []).map((item: SupplierCandidate) => item.name).filter(Boolean)} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.B.2" && <IntroductionMeetingEditor meetings={draft.introductionMeetings ?? []} onChange={meetings => setDraft(previous => ({ ...previous, introductionMeetings: meetings }))} manufacturers={(records["A.A.5"]?.supplierShortList ?? []).map((item: SupplierCandidate) => item.name).filter(Boolean)} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.B.6" && <RfqComparisonMatrix matrix={draft.rfqComparisonMatrix} onChange={matrix => setDraft(previous => ({ ...previous, rfqComparisonMatrix: matrix }))} isAdmin={isAdmin} shortlist={(records["A.A.5"]?.supplierShortList ?? []).map((item: SupplierCandidate) => item.name).filter(Boolean)} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.B.7" && <HighPotentialPicker manufacturers={manufacturers} value={draft.highPotentialManufacturerId} onChange={(id, name) => setDraft(previous => ({ ...previous, highPotentialManufacturerId: id, highPotentialManufacturerName: name }))} disabled={!isAdmin || busy || approved} />}
      {step.id === "A.B.8" && <SpecLinkPanel projectId={projectId} isAdmin={isAdmin} preparedBy={currentUser.displayName || currentUser.name || currentUser.companyName || ""} manufacturers={manufacturers} specs={specs} ab7={records["A.B.7"]} draft={draft} onChange={patch => setDraft(previous => ({ ...previous, ...patch }))} disabled={busy || approved} />}
      {step.id === "A.B.9" && <RecipeCostPreview spec={specs.find(spec => spec.id === records["A.B.8"]?.approvedSpecId && spec.status === "approved")} lines={draft.recipeCostLines} source={draft.recipeCostSource} canImport={isAdmin && !approved && !busy} onImport={(lines, source) => setDraft(previous => ({ ...previous, recipeCostLines: lines, recipeCostSource: source }))} />}
      <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2"><p><strong>{d.kpi}</strong> {translated?.kpi || step.metric}</p><p><strong>{d.output}</strong> {translated?.output || step.outputs}</p><p><strong>{d.prerequisite}</strong> {dependencies[step.id]?.join(", ") || d.none}</p><p><strong>{d.returnTo}</strong> {step.returnTo || d.sameStep}</p>{config.logistics && <><p><strong>{d.duration}</strong> {step.period ?? days(step.days)}{step.approvalDays !== null && d.approvalDays(step.approvalDays)}</p><p><strong>{d.roles}</strong> {d.roleLine(role(step.requester), role(step.owner), role(step.approver))}</p></>}</div>
      {blocked.length > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{d.waiting(blocked.join(", "))}</p>}
      {record?.rejectionReason && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{d.returnReason(record.rejectionReason)}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">{d.status}<select className={input} value={draft.workflowStatus} disabled={!canEdit || busy || approved} onChange={e => change("workflowStatus", e.target.value)}>{Object.keys(workflowStatuses).map(value => <option key={value} value={value}>{t.status.workflow[value]}</option>)}</select></label>
        <label className="text-sm">{d.assignee}<select className={input} value={draft.assigneeUid || ""} disabled={!isAdmin || busy || approved} onChange={e => change("assigneeUid", e.target.value)}><option value="">{d.choosePerson}</option>{record?.sampleProject === "t2t-sample-tortilla-v1" && draft.assigneeUid && !users.some(user => user.id === draft.assigneeUid) && <option value={draft.assigneeUid}>{record.assigneeName || draft.assigneeUid}</option>}{users.map(user => <option key={user.id} value={user.id}>{user.displayName || user.companyName} · {user.email}</option>)}</select></label>
        <label className="text-sm">{d.approver}<select className={input} value={draft.approverUid || ""} disabled={!isAdmin || busy || approved} onChange={e => change("approverUid", e.target.value)}><option value="">{d.choosePerson}</option>{users.filter(user => user.role === "admin").map(user => <option key={user.id} value={user.id}>{user.displayName || user.companyName} · {user.email}</option>)}</select></label>
        <label className="text-sm">{d.dueDate}<input ref={dueDateInput} type="date" className={input} value={draft.dueDate || ""} disabled={!canEdit || busy || approved} onChange={e => change("dueDate", e.target.value)} onInput={e => change("dueDate", e.currentTarget.value)} /></label>
        <label className="text-sm">{d.evidenceName}<input className={input} maxLength={250} value={draft.evidenceName || ""} disabled={!canEdit || busy || approved} onChange={e => change("evidenceName", e.target.value)} /></label>
        <label className="text-sm">{d.evidenceUrl}<input type="url" className={input} maxLength={2000} placeholder="https://drive.google.com/…" value={draft.evidenceUrl || ""} disabled={!canEdit || busy || approved} onChange={e => change("evidenceUrl", e.target.value)} /></label>
      </div>
      <label className="block text-sm">{d.notes}<textarea className={input} maxLength={3000} value={draft.notes || ""} disabled={!canEdit || busy || approved} onChange={e => change("notes", e.target.value)} /></label>
      {canEdit && !approved && <button onClick={() => void save("save")} disabled={busy} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? t.common.saving : draft.workflowStatus === "completed" ? d.submit : t.common.save}</button>}
      {record?.approverUid === currentUser.id && ["pending", "approved"].includes(record.approval || "") && <div className="space-y-3 rounded-xl bg-slate-50 p-4"><label className="block text-sm">{d.rejectReason}<input className={input} maxLength={1500} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="flex gap-2">{record.approval === "pending" && <button disabled={busy || record.completedBy === currentUser.id} onClick={() => void save("approve")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-40">{d.approve}</button>}<button disabled={busy} onClick={() => void save("reject")} className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white">{d.reject}</button></div></div>}
      {step.period && approved && isAdmin && <button onClick={() => void startNewPeriod()} disabled={busy} className="flex items-center gap-2 rounded-lg border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700 disabled:opacity-50"><RotateCcw className="h-4 w-4" /> {d.newPeriod}</button>}
      <p role="status" className="text-sm text-indigo-800">{message}</p>
      {(record?.cycleHistory?.length ?? 0) > 0 && <details><summary className="cursor-pointer text-sm font-semibold">{d.cycles(record!.cycleHistory.length)}</summary><ul className="mt-2 space-y-2 text-xs text-slate-600">{[...record!.cycleHistory].reverse().map((entry: any) => <li key={entry.cycle} className="rounded-lg bg-slate-50 p-2"><strong>{d.cycle(entry.cycle)}</strong> · {d.approvedOn(dateOf(entry.approvedAt))}{entry.evidenceUrl && <> · <a className="text-teal-700 hover:underline" href={entry.evidenceUrl} target="_blank" rel="noreferrer">{entry.evidenceName || t.common.document}</a></>}{entry.notes && <p className="mt-1 text-slate-500">{entry.notes}</p>}</li>)}</ul></details>}
      {step.period && (record?.periodHistory?.length ?? 0) > 0 && <details><summary className="cursor-pointer text-sm font-semibold">{d.periods(record!.periodHistory.length)}</summary><ul className="mt-2 space-y-2 text-xs text-slate-600">{[...record!.periodHistory].reverse().map((entry: any) => <li key={entry.period} className="rounded-lg bg-slate-50 p-2"><strong>{d.period(entry.period)}</strong> · {d.approvedOn(dateOf(entry.approvedAt))}{entry.dueDate && ` · ${d.target(entry.dueDate)}`} · {users.find(user => user.id === entry.completedBy)?.email || entry.completedBy || "—"}{entry.evidenceUrl && <> · <a className="text-teal-700 hover:underline" href={entry.evidenceUrl} target="_blank" rel="noreferrer">{entry.evidenceName || t.common.document}</a></>}{entry.notes && <p className="mt-1 text-slate-500">{entry.notes}</p>}</li>)}</ul></details>}
      <details><summary className="cursor-pointer text-sm font-semibold">{d.history(events.length)}</summary><ul className="mt-2 space-y-2 text-xs text-slate-600">{[...events].sort((a,b) => (b.at?.seconds || 0) - (a.at?.seconds || 0)).map(event => <li key={event.id}>{event.at?.toDate ? fmt.dateTime(event.at.toDate()) : d.historySaving} · {users.find(user => user.id === event.actorUid)?.email || event.actorUid} · {eventText(t, event)}</li>)}</ul></details>
      <details><summary className="cursor-pointer text-sm font-semibold">{d.documents}</summary><GoogleDriveFolder stepId={step.id} storageLocation={step.outputs} currentProjectId={projectId} clientMode={!isAdmin} /></details>
    </div>
  </details>;
}
