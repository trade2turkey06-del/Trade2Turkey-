import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useProjectData } from "../lib/useProjectData";
import { stockPlan, todayIstanbul } from "../domain/operations";
import { sourcingWorkflow } from "../data/sourcingWorkflow";
import { INITIAL_SOP_STEPS } from "../types";
import { logisticsWorkflow } from "../data/logisticsWorkflow";
import { Panel } from "./OperationsHub";

export default function AdminOverview({ projectId, onNavigate }: { projectId: string; onNavigate: (tab: string) => void }) {
  const { data, error } = useProjectData(projectId, ["products", "stock", "shipmentRecords", "salesOrders", "events"]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskError, setTaskError] = useState("");
  useEffect(() => onSnapshot(query(collection(db,"sopSteps"),where("projectId","==",projectId)), snapshot => {
    setTasks(snapshot.docs.map(item => item.data()).filter(item => item.workflow === "sourcing" || item.workflow === "logistics")); setTaskError("");
  }, () => setTaskError("Görev özeti yüklenemedi.")), [projectId]);
  const today = todayIstanbul();
  // Logistics steps count towards pending approvals only; the other tiles stay sourcing-based.
  const sourcingTasks = tasks.filter(task => task.workflow === "sourcing");
  const overdue = sourcingTasks.filter(task => task.dueDate && task.dueDate < today && task.approval !== "approved");
  const dueToday = sourcingTasks.filter(task => task.dueDate === today && task.approval !== "approved");
  const approvals = tasks.filter(task => task.approval === "pending");
  const missing = sourcingWorkflow.filter(step => !sourcingTasks.find(task => task.stepId === step.id)?.evidenceUrl);
  const critical = (data.stock || []).filter(stock => stockPlan(stock, (data.products || []).find(item => item.id === stock.productId)).needsReorder);
  const lateShipments = (data.shipmentRecords || []).filter(shipment => shipment.expectedArrival < today && shipment.status !== "delivered");
  const name = (id: string) => (data.products || []).find(item => item.id === id)?.name || id;
  return <div className="space-y-5"><h2 className="text-2xl font-bold">Yönetici Aksiyon Merkezi</h2><p className="text-sm text-slate-600">{today} · Seçili projenin canlı görev ve operasyon kayıtları</p>
    {(error || taskError) && <p role="alert" className="text-red-700">{error || taskError}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Bugün yapılacak",dueToday.length],["Geciken görev",overdue.length],["Onay bekleyen",approvals.length],["Kritik stok",critical.length]].map(([label,count]) => <div key={label} className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold">{count}</p></div>)}</div>
    <div className="grid gap-5 lg:grid-cols-2"><Panel title="Görevler ve onaylar"><ul className="space-y-3 text-sm">{[...overdue,...dueToday,...approvals].filter((item,index,all) => all.findIndex(other => other.stepId === item.stepId) === index).map(task => <li key={task.stepId}><button className="text-left underline" onClick={() => onNavigate(task.workflow === "logistics" ? "logistics" : "sourcing")}>{task.stepId} · {(task.workflow === "logistics" ? logisticsWorkflow.find(step => step.id === task.stepId)?.task : INITIAL_SOP_STEPS.find(step => step.id === task.stepId)?.task) || task.task}</button><p className="text-xs text-slate-500">{task.dueDate || "Tarih yok"} · {task.approval === "pending" ? "Onay bekliyor" : "İşlem bekliyor"}</p></li>)}{!overdue.length && !dueToday.length && !approvals.length && <li>Bugüne ait açık aksiyon veya onay bekleyen görev yok.</li>}</ul></Panel>
    <Panel title="Stok ve teslimat uyarıları"><ul className="space-y-3 text-sm">{critical.map(stock => <li key={stock.id}><button className="underline" onClick={() => onNavigate("logistics")}>{name(stock.productId)}: kullanılabilir {stockPlan(stock).available}, emniyet stoğu {stock.safetyStock}</button></li>)}{lateShipments.map(shipment => <li key={shipment.id}>Teslimatı geciken: {shipment.tracking} · {shipment.expectedArrival}</li>)}{!critical.length && !lateShipments.length && <li>Kayıtlı stok veya sevkiyatlar için kritik uyarı yok.</li>}</ul></Panel>
    <Panel title="Eksik belgeler"><p className="text-sm">{missing.length} adımın belge bağlantısı henüz girilmemiş.</p><button className="text-sm text-indigo-700 underline" onClick={() => onNavigate("sourcing")}>SOP belgelerini tamamla</button><p className="text-xs text-slate-500">Başlanmamış adımlar da bu sayıya dahildir.</p></Panel>
    <Panel title="Bağlantı ve maliyet durumu"><ul className="space-y-2 text-sm"><li>Yapay zekâ API çağrıları kapalı; ek kullanım ücreti oluşturulmaz.</li><li>Kargo etiketi ve pazaryeri güncellemeleri manuel doğrulanır.</li><li>Raporlar tarayıcıdan yazdırılır / PDF olarak kaydedilir; uygulama e-posta göndermez.</li><li>Görev ve stok uyarıları burada gösterilir; ücretli bildirim servisi kullanılmaz.</li></ul></Panel></div>
  </div>;
}
