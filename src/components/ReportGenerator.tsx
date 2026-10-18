import { useI18n } from "../i18n";
import { message as msg } from "../i18n";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useProjectData } from "../lib/useProjectData";
import { Panel } from "./OperationsHub";

export default function ReportGenerator({ projectId }: { projectId: string }) {
  const { t, fmt, lang } = useI18n();
  const { data, error, loading } = useProjectData(projectId, ["products", "vendors", "purchaseOrders", "salesOrders", "shipmentRecords", "stock"]);
  const [tasks,setTasks] = useState<any[]>([]), [email,setEmail] = useState("");
  const [taskError,setTaskError] = useState("");
  useEffect(() => onSnapshot(query(collection(db,"sopSteps"),where("projectId","==",projectId)), snapshot=>{setTasks(snapshot.docs.map(item=>item.data()).filter(item=>item.workflow==="sourcing"));setTaskError("");},()=>setTaskError(msg("reports", "couldNotLoadSopRecords"))),[projectId]);
  const date = fmt.dateTime(new Date());
  const summary = msg("reports", "valueReportGeneratedValueApprovedSopStepsValue21", projectId, date, tasks.filter(task=>task.approval==="approved").length, tasks.filter(task=>task.approval==="pending").length, data.products?.length || 0, data.vendors?.length || 0, data.purchaseOrders?.length || 0, data.salesOrders?.length || 0, data.shipmentRecords?.length || 0);
  const download = () => { const url=URL.createObjectURL(new Blob([summary],{type:"text/plain;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download=`${projectId}-${lang === "en" ? "report" : "rapor"}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); };
  return <div className="space-y-5"><Panel title={msg("reports", "projectReport")}><p className="text-sm text-slate-600">{msg("reports", "thisReportIsGeneratedLocallyFromSavedRecordsNo")}</p>{(error||taskError)&&<p role="alert" className="text-red-700">{error||taskError}</p>}<fieldset disabled={loading||!!error||!!taskError} className="flex flex-wrap items-end gap-3 print:hidden"><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" onClick={()=>window.print()}>{msg("reports", "printSaveAsPdf")}</button><button className="rounded-lg border px-4 py-2 text-sm" onClick={download}>{msg("reports", "downloadTextReport")}</button><label className="text-sm">{msg("reports", "recipientEmail")}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="ml-2 rounded-lg border p-2" /></label><button className="rounded-lg border px-4 py-2 text-sm" disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)} onClick={()=>{window.location.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(msg("reports", "valueOperationsReport", projectId))}&body=${encodeURIComponent(summary)}`;}}>{msg("reports", "openEmailDraft")}</button></fieldset><p className="text-xs text-slate-500 print:hidden">{msg("reports", "theDraftOpensInYourOwnEmailApplicationThis")}</p></Panel><Panel title={msg("reports", "trade2turkeyOperationsSummary")}><pre className="whitespace-pre-wrap font-sans text-sm leading-7">{summary}</pre><h4 className="font-bold">{msg("reports", "inventoryDetails")}</h4><ul className="space-y-2 text-sm">{(data.stock||[]).map(stock=><li key={stock.id}>{data.products?.find(item=>item.id===stock.productId)?.name||stock.productId}{msg("reports", "physical")} {fmt.number(stock.physical)}{msg("reports", "reserved")} {fmt.number(stock.reserved)}{msg("reports", "available")} {fmt.number(stock.physical-stock.reserved)}</li>)}</ul></Panel></div>;
}
