export const workflowStatuses = { not_started: "Başlanmadı", in_progress: "Devam ediyor", incomplete: "Tamamlanmadı", completed: "Tamamlandı" } as const;
export type WorkflowStatus = keyof typeof workflowStatuses;
export interface TaskRecord {
  stepId: string; workflowStatus: WorkflowStatus; assigneeUid?: string; approverUid?: string; dueDate?: string;
  notes?: string; evidenceUrl?: string; evidenceName?: string; approval?: "none" | "pending" | "approved" | "rejected";
  completedBy?: string; rejectionReason?: string; updatedAt?: any; [key: string]: any;
}
export const dependencies: Record<string, string[]> = {
  "A.A.1": [], "A.A.2": ["A.A.1"], "A.A.3": ["A.A.2"], "A.A.4": ["A.A.3"], "A.A.5": ["A.A.4"],
  "A.A.6": ["A.A.5"], "A.A.7": ["A.A.6"], "A.B.1": ["A.A.7"], "A.B.2": ["A.B.1"], "A.B.3": ["A.B.2"],
  "A.B.4": ["A.B.3"], "A.B.5": ["A.B.4"], "A.B.6": ["A.B.5"], "A.B.7": ["A.B.6"], "A.B.8": ["A.B.7"],
  "A.B.9": ["A.B.8"], "A.B.10": ["A.B.9"], "A.B.11": ["A.B.7"], "A.B.12": ["A.B.10", "A.B.11"],
  "A.B.13": ["A.B.12"], "A.B.14": ["A.B.13"],
};
export function canAdvance(stepId: string, records: Record<string, TaskRecord>) {
  return (dependencies[stepId] || []).filter(id => records[id]?.workflowStatus !== "completed" || records[id]?.approval !== "approved");
}
export function affectedSteps(ids: string[]) {
  const affected = new Set(ids);
  let changed = true;
  while (changed) { changed = false; for (const [id, prerequisites] of Object.entries(dependencies)) if (!affected.has(id) && prerequisites.some(item => affected.has(item))) { affected.add(id); changed = true; } }
  return [...affected];
}
export function validateCompletion(task: TaskRecord) {
  if (!task.assigneeUid || !task.approverUid || task.assigneeUid === task.approverUid) throw new Error("Görev sorumlusu ve onaylayan farklı kişiler olmalı.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate || "")) throw new Error("Hedef bitiş tarihi seçin.");
  let valid = false;
  try { const url = new URL(task.evidenceUrl || ""); valid = url.protocol === "https:" && !url.username && !url.password; } catch {}
  if (!valid || !task.evidenceName?.trim()) throw new Error("Gerekli çıktı için gerçek belge adı ve HTTPS bağlantısı ekleyin.");
}
