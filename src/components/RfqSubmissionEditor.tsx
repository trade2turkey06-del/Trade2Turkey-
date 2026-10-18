import { Plus, Trash2 } from "lucide-react";
import TargetSpecificationEditor, { SpecificationSection } from "./TargetSpecificationEditor";
import { rfqTemplate } from "../data/rfqTemplate";
import { getMessages, useI18n } from "../i18n";

export interface RfqForm { id: string; name: string; sections: SpecificationSection[] }
// Varsayılan form adı kullanıcının düzenleyebildiği veridir; oluşturulduğu andaki dilde yazılır.
export const createRfqForm = (id = "initial-rfq"): RfqForm => ({ id, name: getMessages().editors.rfqForms.defaultName, sections: structuredClone(rfqTemplate) });

export default function RfqSubmissionEditor({ forms, onChange, disabled }: { forms: RfqForm[]; onChange: (forms: RfqForm[]) => void; disabled: boolean }) {
  const m = useI18n().t.editors.rfqForms;
  const update = (id: string, patch: Partial<RfqForm>) => onChange(forms.map(form => form.id === id ? { ...form, ...patch } : form));
  return <fieldset disabled={disabled} className="space-y-4 rounded-xl border border-teal-200 p-4">
    <legend className="px-2 font-semibold text-navy">{m.title}</legend>
    <p className="text-sm text-slate-600">{m.help}</p>
    {!forms.length && <p className="text-sm text-slate-500">{m.empty}</p>}
    {forms.map(form => <details key={form.id} open className="space-y-3 rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer font-semibold text-navy">{form.name || m.unnamed}</summary>
      <div className="flex items-end gap-3"><label className="flex-1 text-sm">{m.name}<input className="mt-1 w-full rounded-lg border border-slate-300 p-2 disabled:bg-slate-50" maxLength={250} value={form.name} onChange={e => update(form.id, { name: e.target.value })} /></label>
        <button type="button" className="flex items-center gap-1 p-2 text-sm text-red-700 disabled:opacity-40" onClick={() => { if (window.confirm(m.removeConfirm(form.name))) onChange(forms.filter(item => item.id !== form.id)); }}><Trash2 className="h-4 w-4" /> {m.remove}</button></div>
      <TargetSpecificationEditor title={m.questions} answerLabel={m.answer} showCompletion={false} sections={form.sections} onChange={sections => update(form.id, { sections })} disabled={disabled} />
    </details>)}
    <button type="button" className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={() => onChange([...forms, createRfqForm(crypto.randomUUID())])}><Plus className="h-4 w-4" /> {m.add}</button>
  </fieldset>;
}
