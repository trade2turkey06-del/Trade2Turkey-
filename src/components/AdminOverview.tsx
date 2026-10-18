import { useI18n } from "../i18n";
import { message as msg } from "../i18n";
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
  const { t, fmt } = useI18n();
  const { data, error } = useProjectData(projectId, ["products", "stock", "shipmentRecords", "salesOrders", "events"]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskError, setTaskError] = useState("");
  useEffect(() => onSnapshot(query(collection(db,"sopSteps"),where("projectId","==",projectId)), snapshot => {
    setTasks(snapshot.docs.map(item => item.data()).filter(item => item.workflow === "sourcing" || item.workflow === "logistics")); setTaskError("");
  }, () => setTaskError(msg("actionCenter", "couldNotLoadTheTaskSummary"))), [projectId]);
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
  return <div className="space-y-5"><h2 className="text-2xl font-bold">{msg("actionCenter", "administratorActionCenter")}</h2><p className="text-sm text-slate-600">{fmt.date(today)} {msg("actionCenter", "liveTaskAndOperationsRecordsForTheSelectedProject")}</p>
    {(error || taskError) && <p role="alert" className="text-red-700">{error || taskError}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[[msg("actionCenter", "dueToday"),dueToday.length],[msg("actionCenter", "overdueTasks"),overdue.length],[msg("actionCenter", "pendingApproval"),approvals.length],[msg("actionCenter", "criticalInventory"),critical.length]].map(([label,count]) => <div key={label} className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold">{fmt.number(Number(count))}</p></div>)}</div>
    <div className="grid gap-5 lg:grid-cols-2"><Panel title={msg("actionCenter", "tasksApprovals")}><ul className="space-y-3 text-sm">{[...overdue,...dueToday,...approvals].filter((item,index,all) => all.findIndex(other => other.stepId === item.stepId) === index).map(task => <li key={task.stepId}><button className="text-left underline" onClick={() => onNavigate(task.workflow === "logistics" ? "logistics" : "sourcing")}>{task.stepId} · {(task.workflow === "logistics" ? t.logistics.steps[task.stepId]?.name : t.steps[task.stepId]?.name) || task.task}</button><p className="text-xs text-slate-500">{task.dueDate ? fmt.date(task.dueDate) : msg("actionCenter", "noDate")} · {task.approval === "pending" ? msg("actionCenter", "awaitingApproval") : msg("actionCenter", "awaitingAction")}</p></li>)}{!overdue.length && !dueToday.length && !approvals.length && <li>{msg("actionCenter", "noActionsDueTodayOrTasksAwaitingApproval")}</li>}</ul></Panel>
    <Panel title={msg("actionCenter", "inventoryDeliveryAlerts")}><ul className="space-y-3 text-sm">{critical.map(stock => <li key={stock.id}><button className="underline" onClick={() => onNavigate("logistics")}>{name(stock.productId)}{msg("actionCenter", "available")} {stockPlan(stock).available}{msg("actionCenter", "safetyStock")} {stock.safetyStock}</button></li>)}{lateShipments.map(shipment => <li key={shipment.id}>{msg("actionCenter", "overdueDelivery")} {shipment.tracking} · {fmt.date(shipment.expectedArrival)}</li>)}{!critical.length && !lateShipments.length && <li>{msg("actionCenter", "noCriticalAlertsForRecordedInventoryOrShipments")}</li>}</ul></Panel>
    <Panel title={msg("actionCenter", "missingDocuments")}><p className="text-sm">{fmt.number(missing.length)} {msg("actionCenter", "stepsHaveNoDocumentUrlYet")}</p><button className="text-sm text-indigo-700 underline" onClick={() => onNavigate("sourcing")}>{msg("actionCenter", "completeSopDocumentation")}</button><p className="text-xs text-slate-500">{msg("actionCenter", "thisCountIncludesStepsThatHaveNotStarted")}</p></Panel>
    <Panel title={msg("actionCenter", "connectionsServiceCosts")}><ul className="space-y-2 text-sm"><li>{msg("actionCenter", "aiApiCallsAreDisabledNoAdditionalUsageCharges")}</li><li>{msg("actionCenter", "shippingLabelsAndMarketplaceUpdatesAreConfirmedManually")}</li><li>{msg("actionCenter", "reportsCanBePrintedOrSavedAsPdfFrom")}</li><li>{msg("actionCenter", "taskAndInventoryAlertsAppearHereNoPaidNotification")}</li></ul></Panel></div>
  </div>;
}
