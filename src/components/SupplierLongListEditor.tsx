import { Building2, Plus, Trash2 } from "lucide-react";

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

export default function SupplierLongListEditor({ companies, onChange, disabled }: {
  companies: SupplierCandidate[];
  onChange: (companies: SupplierCandidate[]) => void;
  disabled: boolean;
}) {
  const update = (id: string, key: keyof SupplierCandidate, value: string) => onChange(companies.map(company => company.id === id ? { ...company, [key]: value } : company));
  return <fieldset disabled={disabled} className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
    <legend className="px-2 font-semibold text-navy">Geniş Tedarikçi Listesi ({companies.length} firma)</legend>
    <p className="text-sm text-slate-600">Araştırdığınız firmaları ekleyin, bilgilerini düzenleyin veya listeden çıkarın. Değişiklikleri aşağıdaki Kaydet düğmesiyle kaydedin.</p>
    {!companies.length && <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Henüz firma eklenmedi. İlk firmanızı ekleyerek başlayın.</p>}
    {companies.map((company, index) => <section key={company.id} aria-label={`Firma ${index + 1}`} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex min-w-0 items-center gap-2 font-semibold text-navy"><Building2 className="h-4 w-4 shrink-0" /><span className="break-words">{index + 1}. {company.name || "Yeni firma"}</span></h4>
        <button type="button" className="flex shrink-0 items-center gap-1 text-sm text-red-700 disabled:opacity-40" aria-label={`${company.name || `Firma ${index + 1}`} firmasını çıkar`} onClick={() => { if (window.confirm(`“${company.name || "Yeni firma"}” listeden çıkarılsın mı? Değişiklik Kaydet düğmesine bastığınızda uygulanır.`)) onChange(companies.filter(item => item.id !== company.id)); }}><Trash2 className="h-4 w-4" /> Çıkar</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([key, label, limit]) => <label key={key} className="text-xs text-slate-600">{label}<input className={input} maxLength={limit} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} value={company[key]} onChange={e => update(company.id, key, e.target.value)} /></label>)}</div>
      <label className="block text-xs text-slate-600">Araştırma notları<textarea className={input} rows={3} maxLength={3000} value={company.notes} onChange={e => update(company.id, "notes", e.target.value)} /></label>
    </section>)}
    <button type="button" className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={() => onChange([...companies, { id: crypto.randomUUID(), name: "", product: "", location: "", contact: "", email: "", phone: "", website: "", notes: "" }])}><Plus className="h-4 w-4" /> Firma ekle</button>
  </fieldset>;
}
