import { useEffect, useState } from "react";
import { deleteField, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useI18n } from "../i18n";
import { Panel } from "./OperationsHub";

// Admin: edit the active project's Turkish name and optional English name. Only these two fields are written.
export default function ProjectNamesPanel({ project }: { project?: { id: string; name?: string; nameEn?: string } }) {
  const p = useI18n().t.shell.projectNames;
  const [name, setName] = useState(""), [nameEn, setNameEn] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { setName(project?.name ?? ""); setNameEn(project?.nameEn ?? ""); }, [project?.id, project?.name, project?.nameEn]);
  // The status message survives the snapshot that follows a save; it is cleared only when another project is selected.
  useEffect(() => setMessage(""), [project?.id]);
  if (!project) return null;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setMessage(p.nameRequired); return; }
    setBusy(true); setMessage("");
    try {
      await updateDoc(doc(db, "projects", project.id), { name: name.trim(), nameEn: nameEn.trim() ? nameEn.trim() : deleteField() });
      setMessage(p.saved);
    } catch { setMessage(p.failed); } finally { setBusy(false); }
  };
  const input = "mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm";
  return <Panel title={p.title}>
    <p className="text-sm text-slate-600">{p.help(project.id)}</p>
    <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
      <label className="text-sm">{p.name}<input required maxLength={200} className={input} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="text-sm">{p.nameEn}<input maxLength={200} className={input} placeholder={name} value={nameEn} onChange={e => setNameEn(e.target.value)} /><span className="mt-1 block text-xs text-slate-500">{p.nameEnHint}</span></label>
      <div><button disabled={busy} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? p.saving : p.save}</button></div>
    </form>
    <p role="status" className="text-sm text-indigo-800">{message}</p>
  </Panel>;
}
