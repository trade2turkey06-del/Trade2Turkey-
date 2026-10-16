import { Plus, Trash2 } from "lucide-react";

export interface SpecificationSection {
  id: string;
  title: string;
  rows: { id: string; parameter: string; value: string; completed: boolean }[];
}

// Transcribed from the supplied Creation of Target Spesification PDF.
export function createTargetSpecification(): SpecificationSection[] {
  return [
    { title: "1. Identification", parameters: ["Product Category", "Product Description"] },
    { title: "2. Materials", parameters: ["Primary Material", "Secondary Material", "Component 1", "Component 2", "Component 3", "Component 4", "Component 5"] },
    { title: "3. Technical & Quality Data", parameters: ["Quality control system", "Certificates", "Warranty Terms", "Audit"] },
    { title: "4. Commercial Data", parameters: ["Target Price", "Estimated Volume"] },
    { title: "5. Logistic", parameters: ["Primary Packaging Detail", "Configuration", "Incoterms"] },
  ].map((section, index) => ({ id: `section-${index}`, title: section.title, rows: section.parameters.map((parameter, row) => ({ id: `row-${index}-${row}`, parameter, value: "", completed: index === 0 && row === 0 })) }));
}

const input = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:bg-slate-50";

export default function TargetSpecificationEditor({ sections, onChange, disabled }: { sections: SpecificationSection[]; onChange: (sections: SpecificationSection[]) => void; disabled: boolean }) {
  const updateSection = (id: string, patch: Partial<SpecificationSection>) => onChange(sections.map(section => section.id === id ? { ...section, ...patch } : section));
  return <fieldset disabled={disabled} className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
    <legend className="px-2 font-semibold text-navy">Hedef Ürün Özellikleri</legend>
    <p className="text-sm text-slate-600">Bölüm ve özellik adlarını, verileri ve tamamlanma durumlarını düzenleyebilirsiniz. Değişiklikleri aşağıdaki Kaydet düğmesiyle kaydedin.</p>
    {sections.map(section => <div key={section.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-3"><label className="flex-1 text-xs text-slate-500">Bölüm adı<input aria-label={`Bölüm adı: ${section.title}`} className={input} maxLength={200} value={section.title} onChange={e => updateSection(section.id, { title: e.target.value })} /></label>
        <button type="button" className="text-sm text-red-700 disabled:opacity-40" onClick={() => { if (window.confirm(`“${section.title}” bölümü ve içindeki tüm satırlar silinsin mi?`)) onChange(sections.filter(item => item.id !== section.id)); }} aria-label={`${section.title} bölümünü sil`}><Trash2 className="h-4 w-4" /></button></div>
      {section.rows.map(row => <div key={row.id} className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-[1fr_1.5fr_160px_32px]">
        <label className="text-xs text-slate-500">Özellik / Parametre<input className={input} maxLength={200} value={row.parameter} onChange={e => updateSection(section.id, { rows: section.rows.map(item => item.id === row.id ? { ...item, parameter: e.target.value } : item) })} /></label>
        <label className="text-xs text-slate-500">Veri<textarea className={input} rows={2} maxLength={4000} placeholder="Buraya girin" value={row.value} onChange={e => updateSection(section.id, { rows: section.rows.map(item => item.id === row.id ? { ...item, value: e.target.value } : item) })} /></label>
        <label className="text-xs text-slate-500">Tamamlanma durumu<select className={input} value={row.completed ? "completed" : "incomplete"} onChange={e => updateSection(section.id, { rows: section.rows.map(item => item.id === row.id ? { ...item, completed: e.target.value === "completed" } : item) })}><option value="incomplete">Tamamlanmadı</option><option value="completed">Tamamlandı</option></select></label>
        <button type="button" aria-label={`${row.parameter || "Özellik"} satırını sil`} className="self-center text-red-700 disabled:opacity-40" onClick={() => { if (window.confirm(`“${row.parameter || "Özellik"}” satırı silinsin mi?`)) updateSection(section.id, { rows: section.rows.filter(item => item.id !== row.id) }); }}><Trash2 className="h-4 w-4" /></button>
      </div>)}
      <button type="button" className="flex items-center gap-2 text-sm font-semibold text-teal-700 disabled:opacity-40" onClick={() => updateSection(section.id, { rows: [...section.rows, { id: crypto.randomUUID(), parameter: "", value: "", completed: false }] })}><Plus className="h-4 w-4" /> Özellik ekle</button>
    </div>)}
    {!sections.length && <p className="text-sm text-slate-500">Henüz bölüm yok. Yeni bir bölüm ekleyebilirsiniz.</p>}
    <button type="button" className="flex items-center gap-2 rounded-lg border border-teal-600 px-3 py-2 text-sm font-semibold text-teal-700 disabled:opacity-40" onClick={() => onChange([...sections, { id: crypto.randomUUID(), title: "Yeni bölüm", rows: [] }])}><Plus className="h-4 w-4" /> Bölüm ekle</button>
  </fieldset>;
}
