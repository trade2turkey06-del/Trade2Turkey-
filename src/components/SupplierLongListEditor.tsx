import { useState } from "react";
import { Building2, Check, ListPlus, Plus, Trash2 } from "lucide-react";

export interface SupplierCandidate {
  id: string;
  name: string;
  product: string;
  location: string;
  contact: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
}

const fields = [
  ["name", "Firma adı *", 250],
  ["product", "Ürün / faaliyet alanı", 250],
  ["location", "Şehir / ülke", 250],
  ["contact", "Yetkili kişi", 250],
  ["email", "E-posta", 250],
  ["phone", "Telefon", 100],
  ["website", "Web sitesi", 2000],
] as const;
const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:bg-slate-50";

export default function SupplierLongListEditor({ companies, onChange, disabled, title = "Geniş Tedarikçi Listesi", description = "Araştırdığınız firmaları ekleyin, bilgilerini düzenleyin veya listeden çıkarın.", source, shortlistedIds = [], onShortlist }: {
  companies: SupplierCandidate[];
  onChange: (companies: SupplierCandidate[]) => void;
  disabled: boolean;
  title?: string;
  description?: string;
  // When set, companies can only be added by picking them from this list.
  source?: SupplierCandidate[];
  // Long list only: sends a company straight to the A.A.5 shortlist.
  shortlistedIds?: string[];
  onShortlist?: (company: SupplierCandidate) => void;
}) {
  const [picked, setPicked] = useState("");
  const available = (source ?? []).filter(candidate => candidate.name.trim() && !companies.some(company => company.id === candidate.id));
  const update = (id: string, key: keyof SupplierCandidate, value: string) => onChange(companies.map(company => company.id === id ? { ...company, [key]: value } : company));
  return <fieldset aria-disabled={disabled} className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
    <legend className="px-2 font-semibold text-navy">{title} ({companies.length} firma)</legend>
    <p className="text-sm text-slate-600">{description} Değişiklikleri aşağıdaki Kaydet düğmesiyle kaydedin.</p>
    {!companies.length && <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">{source ? "Henüz firma eklenmedi. Aşağıdan geniş listeden firma seçin." : "Henüz firma eklenmedi. İlk firmanızı ekleyerek başlayın."}</p>}
    {companies.map((company, index) => <section key={company.id} aria-label={`Firma ${index + 1}`} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex min-w-0 items-center gap-2 font-semibold text-navy"><Building2 className="h-4 w-4 shrink-0" /><span className="break-words">{index + 1}. {company.name || "Yeni firma"}</span></h4>
        <div className="flex shrink-0 items-center gap-4">{onShortlist && (shortlistedIds.includes(company.id) ? <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" /> Kısa listede</span> : <button type="button" disabled={!company.name.trim()} title={company.name.trim() ? undefined : "Önce firma adını girin"} className="flex items-center gap-1 text-sm font-semibold text-teal-700 disabled:opacity-40" onClick={() => onShortlist(company)}><ListPlus className="h-4 w-4" /> Kısa listeye ekle</button>)}
        <fieldset disabled={disabled} className="contents"><button type="button" className="flex shrink-0 items-center gap-1 text-sm text-red-700 disabled:opacity-40" aria-label={`${company.name || `Firma ${index + 1}`} firmasını çıkar`} onClick={() => { if (window.confirm(`“${company.name || "Yeni firma"}” listeden çıkarılsın mı? Değişiklik Kaydet düğmesine bastığınızda uygulanır.`)) onChange(companies.filter(item => item.id !== company.id)); }}><Trash2 className="h-4 w-4" /> Çıkar</button></fieldset></div>
      </div>
      <fieldset disabled={disabled} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([key, label, limit]) => <label key={key} className="text-xs text-slate-600">{label}<input className={input} maxLength={limit} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} value={company[key]} onChange={e => update(company.id, key, e.target.value)} /></label>)}</div>
      <label className="block text-xs text-slate-600">Araştırma notları<textarea className={input} rows={3} maxLength={3000} value={company.notes} onChange={e => update(company.id, "notes", e.target.value)} /></label></fieldset>
    </section>)}
    <fieldset disabled={disabled}>{source ? <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-xs text-slate-600">Geniş tedarikçi listesinden firma seçin<select className={input} value={picked} onChange={e => setPicked(e.target.value)}>
        <option value="">{available.length ? "Firma seçin…" : source.length ? "Listedeki tüm firmalar eklendi" : "A.A.3 listesinde kayıtlı firma yok"}</option>
        {available.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.location ? ` · ${candidate.location}` : ""}</option>)}
      </select></label>
      <button type="button" disabled={!picked} className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={() => { const candidate = available.find(item => item.id === picked); if (candidate) onChange([...companies, { ...candidate }]); setPicked(""); }}><Plus className="h-4 w-4" /> Kısa listeye ekle</button>
    </div> : <button type="button" className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={() => onChange([...companies, { id: crypto.randomUUID(), name: "", product: "", location: "", contact: "", email: "", phone: "", website: "", notes: "" }])}><Plus className="h-4 w-4" /> Firma ekle</button>}</fieldset>
  </fieldset>;
}
