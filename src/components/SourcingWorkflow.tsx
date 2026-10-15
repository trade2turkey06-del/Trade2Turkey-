import { ClipboardList, Clock, CornerUpLeft, FileText, ShieldCheck } from "lucide-react";
import { sourcingWorkflow } from "../data/sourcingWorkflow";
import { INITIAL_SOP_STEPS } from "../types";

const roles: Record<string, string> = {
  "General Manager": "Genel Müdür",
  "Project Manager": "Proje Yöneticisi",
  "Sourcing Manager": "Tedarik Yöneticisi",
};

export default function SourcingWorkflow() {
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
          <span className="rounded-full bg-white px-3 py-1 text-slate-600">SOP süreç şablonu</span>
        </div>
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
