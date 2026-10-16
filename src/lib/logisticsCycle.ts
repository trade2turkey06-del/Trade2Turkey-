import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { eventData, operationCollection } from "./operationsStore";
import { logisticsWorkflow } from "../data/logisticsWorkflow";

const purchaseSteps = logisticsWorkflow.filter(step => step.id.startsWith("B.A.")).map(step => step.id);

// Opens B.A.1 for a new purchase cycle. The first cycle only annotates B.A.1; later cycles require the previous one to be
// closed (B.A.15 approved) and archive every B.A step into cycleHistory before reopening the chain.
export async function startPurchaseCycle(projectId: string, trigger: string) {
  await runTransaction(db, async tx => {
    const refs = purchaseSteps.map(id => doc(db, "sopSteps", `${projectId}_logistics-${id}`));
    const records = await Promise.all(refs.map(async ref => (await tx.get(ref)).data()));
    const closed = records[records.length - 1]?.approval === "approved";
    const active = records.findIndex(record => record && (record.workflowStatus !== "not_started" || record.approval !== "none"));
    if (active >= 0 && !closed) throw new Error(`Açık bir PO döngüsü var (${purchaseSteps[active]}). Yeni PO için önceki döngüde B.A.15 Sevkiyat Teslimat Onayı tamamlanmalı.`);
    const eventRef = doc(operationCollection(projectId, "events"));
    const note = `Yeni PO döngüsü: ${trigger}`.slice(0, 3000);
    const cycle = (records[0]?.cycleHistory?.length ?? 0) + 1;
    refs.forEach((ref, index) => {
      const record = records[index];
      if (!closed && index > 0) return;
      if (!record) { if (index === 0) tx.set(ref, { id: `logistics-${purchaseSteps[0]}`, projectId, workflow: "logistics", stepId: purchaseSteps[0], section: "B", subsection: "Stratejik Proje Uyumu ve Koordinasyon", workflowStatus: "not_started", status: "Pending", approval: "none", notes: note, updatedAt: serverTimestamp(), lastEventId: eventRef.id }); return; }
      tx.set(ref, {
        ...(closed ? { cycleHistory: [...(record.cycleHistory ?? []), { cycle, workflowStatus: record.workflowStatus, approval: record.approval, dueDate: record.dueDate || "", evidenceName: record.evidenceName || "", evidenceUrl: record.evidenceUrl || "", notes: record.notes || "", completedBy: record.completedBy || "", decidedBy: record.decidedBy || "", approvedAt: record.updatedAt ?? null }],
          workflowStatus: "not_started", status: "Pending", approval: "none", completedBy: "", rejectionReason: "", dueDate: "", evidenceName: "", evidenceUrl: "" } : {}),
        notes: index === 0 ? note : "", updatedAt: serverTimestamp(), lastEventId: eventRef.id,
      }, { merge: true });
    });
    tx.set(eventRef, { ...eventData("workflow_cycle", purchaseSteps[0], closed ? `PO döngüsü ${cycle} kapatıldı. ${note}` : note), projectId });
  });
}
