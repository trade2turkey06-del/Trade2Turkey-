import { ClipboardList, Clock, CornerUpLeft, FileText, ShieldCheck } from "lucide-react";
import { sourcingWorkflow } from "../data/sourcingWorkflow";
import { INITIAL_SOP_STEPS } from "../types";
import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../lib/firebase";

const statuses = {
  not_started: { label: "Başlanmadı", style: "bg-slate-100 text-slate-600" },
  in_progress: { label: "Devam ediyor", style: "bg-blue-50 text-blue-700" },
  incomplete: { label: "Tamamlanmadı", style: "bg-amber-50 text-amber-800" },
  completed: { label: "Tamamlandı", style: "bg-emerald-50 text-emerald-700" },
} as const;
type WorkflowStatus = keyof typeof statuses;
const isStatus = (value: unknown): value is WorkflowStatus => typeof value === "string" && Object.hasOwn(statuses, value);

const roles: Record<string, string> = {
  "General Manager": "Genel Müdür",
  "Project Manager": "Proje Yöneticisi",
  "Sourcing Manager": "Tedarik Yöneticisi",
};

export default function SourcingWorkflow({ projectId }: { projectId: string }) {
  const [stepStatuses, setStepStatuses] = useState<Record<string, WorkflowStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = onSnapshot(query(collection(db, "sopSteps"), where("projectId", "==", projectId)), snapshot => {
      const next: Record<string, WorkflowStatus> = {};
      snapshot.docs.forEach(item => {
        const data = item.data();
        if (data.workflow === "sourcing" && isStatus(data.workflowStatus)) next[data.stepId] = data.workflowStatus;
      });
      setStepStatuses(next);
      setLoading(false);
      setError("");
    }, () => {
      setLoading(false);
      setError("İş akışı durumları yüklenemedi. Bağlantınızı ve erişim yetkinizi kontrol edin.");
    });
    return () => { mounted.current = false; unsubscribe(); };
  }, [projectId]);

  const updateStatus = async (step: typeof sourcingWorkflow[number], value: WorkflowStatus) => {
    setSaving(previous => [...previous, step.id]);
    setNotice("");
    try {
      await setDoc(doc(db, "sopSteps", `${projectId}_sourcing-${step.id}`), {
        id: `sourcing-${step.id}`, projectId, workflow: "sourcing", stepId: step.id,
        section: "A", subsection: step.id.startsWith("A.A.") ? "Keşif ve Fizibilite" : "Teklif, Kalite ve Uyumluluk",
        task: step.task.trim(), requester: step.requester, taskOwner: step.owner,
        kpiMetric: step.metric.trim(), kpiTimeDays: step.days,
        status: value === "completed" ? "Completed" : value === "in_progress" ? "In Progress" : "Pending",
        workflowStatus: value, updatedAt: serverTimestamp(),
      }, { merge: true });
      if (mounted.current) setNotice(`${step.id}: ${statuses[value].label} kaydedildi.`);
    } catch {
      if (mounted.current) setNotice(`${step.id} kaydedilemedi. Bağlantınızı ve erişim yetkinizi kontrol edip yeniden deneyin.`);
    } finally {
      if (mounted.current) setSaving(previous => previous.filter(id => id !== step.id));
    }
  };
  return (
    <section aria-labelledby="sourcing-workflow-title" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 p-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-indigo-600" />
          <h2 id="sourcing-workflow-title" className="text-xl font-bold text-slate-900">Tedarik İş Akışı</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">Proje başlangıcından ticari sözleşmeye kadar SOP adımları, sorumlular ve gerekli çıktılar.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">21 adım</span>
          <span className="rounded-full bg-white px-3 py-1 text-slate-600">{loading ? "Durumlar yükleniyor…" : `${Object.values(stepStatuses).filter(value => value === "completed").length} / 21 tamamlandı`}</span>
        </div>
        <p className="mt-3 text-xs text-slate-500">Durumlar seçili proje için kaydedilir. Henüz güncellenmeyen adımlar başlanmadı olarak görünür.</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <p role="status" aria-live="polite" className="mt-2 text-sm text-slate-600">{notice}</p>
      </div>
      <div className="space-y-8 p-4 sm:p-6">
        {[
          { prefix: "A.A.", title: "Keşif ve Fizibilite", description: "Proje gereksinimleri, üretici araştırması, teklif toplama ve devam kararı." },
          { prefix: "A.B.", title: "Teklif, Kalite ve Uyumluluk", description: "Numune, maliyet, tedarikçi değerlendirmesi, nihai onay ve sözleşme." },
        ].map(group => (
          <div key={group.prefix}>
            <h3 className="font-bold text-slate-900">{group.prefix.slice(0, -1)} · {group.title}</h3>
            <p className="mb-4 mt-1 text-sm text-slate-500">{group.description}</p>
            <ol className="space-y-3">
              {sourcingWorkflow.filter(step => step.id.startsWith(group.prefix)).map(step => {
                const translated = INITIAL_SOP_STEPS.find(item => item.id === step.id);
                return (
                  <li key={step.id}>
                    <div className="mb-2 flex items-center justify-end gap-2">
                      <label htmlFor={`status-${step.id}`} className="text-xs text-slate-500">Durum</label>
                      <select
                        id={`status-${step.id}`}
                        aria-label={`${step.id} ${translated?.task || step.task} durumu`}
                        value={stepStatuses[step.id] || "not_started"}
                        disabled={loading || !!error || saving.includes(step.id)}
                        onChange={event => { if (isStatus(event.target.value)) void updateStatus(step, event.target.value); }}
                        className={`max-w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${statuses[stepStatuses[step.id] || "not_started"].style}`}
                      >
                        {Object.entries(statuses).map(([value, status]) => <option key={value} value={value}>{status.label}</option>)}
                      </select>
                      {saving.includes(step.id) && <span className="text-xs text-slate-500">Kaydediliyor…</span>}
                    </div>
                    <details className="group rounded-2xl border border-slate-200 open:border-indigo-200">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 rounded-2xl p-4 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 [&::-webkit-details-marker]:hidden">
                        <span className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700">{step.id}</span>
                        <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{translated?.task || step.task}</span>
                        <span className="flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" />{step.days} gün</span>
                        <span className="text-xs text-indigo-600 group-open:hidden">Ayrıntılar +</span>
                        <span className="hidden text-xs text-indigo-600 group-open:inline">Kapat −</span>
                      </summary>
                      <div className="grid gap-5 border-t border-slate-100 p-4 text-sm sm:grid-cols-2">
                        <dl className="space-y-3">
                          <div><dt className="text-xs text-slate-500">Talep eden</dt><dd className="mt-1 text-slate-800">{roles[step.requester] || step.requester}</dd></div>
                          <div><dt className="text-xs text-slate-500">Görev sorumlusu</dt><dd className="mt-1 text-slate-800">{roles[step.owner] || step.owner}</dd></div>
                          <div><dt className="flex items-center gap-1 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5" />Onaylayan / Onay süresi</dt><dd className="mt-1 text-slate-800">{roles[step.approver] || step.approver} · {step.approvalDays == null ? "Süre belirtilmemiş" : `${step.approvalDays} gün`}</dd></div>
                        </dl>
                        <dl className="space-y-3">
                          <div><dt className="text-xs text-slate-500">KPI / Başarı ölçütü</dt><dd className="mt-1 text-slate-800">{translated?.kpiMetric || step.metric}</dd></div>
                          <div><dt className="flex items-center gap-1 text-xs text-slate-500"><FileText className="h-3.5 w-3.5" />Gerekli çıktı / Belge</dt><dd className="mt-1 text-slate-800">{translated?.requiredOutputs || step.outputs}</dd></div>
                          {step.returnTo && <div><dt className="flex items-center gap-1 text-xs text-amber-700"><CornerUpLeft className="h-3.5 w-3.5" />Reddedilirse dönülecek adım</dt><dd className="mt-1 font-medium text-amber-800">{step.returnTo}</dd></div>}
                        </dl>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
