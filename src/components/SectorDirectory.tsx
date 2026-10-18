import { useI18n } from "../i18n";
import { message as msg } from "../i18n";
import React, { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { Archive, BookOpen, Building2, ChevronDown, Globe, Layers, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { db } from "../lib/firebase";

export interface Sector { id: string; name: string; archived?: boolean }
export interface DirectoryContact { id: string; name: string; title: string; phone: string; email: string }
export interface DirectoryCompany {
  id: string; sectorId: string; name: string; website: string; catalogUrl: string; description: string; foundedYear: string; employees: string;
  location: string; address: string; phone: string; email: string; products: string; certificates: string; capacity: string;
  markets: string; notes: string; contacts: DirectoryContact[];
  // Optional detail fields; older records simply lack them and read as "".
  productSummary?: string; companyType?: string; locationNote?: string; technicalSpecs?: string; packaging?: string; missingCertificates?: string;
  // Fictional sample records are flagged so they are never mistaken for real suppliers.
  isDemo?: boolean;
}

const emptyCompany = (sectorId: string): DirectoryCompany => ({ id: crypto.randomUUID(), sectorId, name: "", website: "", catalogUrl: "", description: "", foundedYear: "", employees: "", location: "", address: "", phone: "", email: "", products: "", certificates: "", capacity: "", markets: "", notes: "", contacts: [], productSummary: "", companyType: "", locationNote: "", technicalSpecs: "", packaging: "", missingCertificates: "" });

// First sector and company requested for the trial; written once when the directory is empty.
// Company facts were taken from www.mtclinen.com and should be verified with the manufacturer.
const seedSector: Sector = { id: "havlu", name: "Havlu" };
const seedCompany: DirectoryCompany = {
  id: "mtc-linen", sectorId: "havlu", name: "MTC Linen", website: "https://www.mtclinen.com", catalogUrl: "",
  description: "1978'den beri faaliyet gösteren, Denizli merkezli havlu ve ev tekstili üreticisi. İplikten konfeksiyona dikey üretim; sürdürülebilirlik odaklı.",
  foundedYear: "1978", employees: "300+", location: "Denizli, Türkiye", address: "Bozburun, 7060. Sk. No:5, 20100 Merkezefendi/Denizli",
  phone: "+90 258 371 37 07", email: "contact@mtclinen.com",
  products: "Havlu, plaj havlusu / peştemal, bornoz, spa, otel tekstili, mutfak tekstili, paspas, yatak örtüsü / battaniye, çocuk ürünleri, duş perdesi",
  certificates: "Made in Green, GOTS, OCS, GRS, RCS",
  capacity: "5.000 m² üretim alanı; 4 tesis (iplik, boya, çözgü, dokuma, konfeksiyon)",
  markets: "ABD (West Haven, CT) ve Almanya (Bornheim) ofisleri; Amazon, Walmart, Target, Wayfair üzerinden satış",
  notes: "Bilgiler firmanın web sitesinden alınmıştır; doğrulanacak.",
  contacts: [{ id: "mtc-export", name: "Şenay Karakozak", title: "İhracat Müdürü", phone: "+90 506 463 49 00", email: "contact@mtclinen.com" }],
};

const fields = (): [keyof DirectoryCompany, string, number, string?][] => [
  ["name", msg("sectors", "companyName"), 250], ["website", msg("sectors", "website"), 2000, "https://"], ["catalogUrl", msg("sectors", "catalogueUrl"), 2000, "https://"], ["location", msg("sectors", "cityCountry"), 250], ["address", msg("sectors", "address"), 500],
  ["phone", msg("sectors", "phone"), 100], ["email", msg("sectors", "email"), 254], ["foundedYear", msg("sectors", "yearEstablished"), 10], ["employees", msg("sectors", "numberOfEmployees"), 50],
  ["companyType", msg("sectors", "companyType"), 250], ["productSummary", msg("sectors", "cardSummaryProductsBrief"), 250],
];
// Multi-line fields; one item per line renders as a list in the detail view.
const longFields = (): [keyof DirectoryCompany, string][] => [
  ["locationNote", msg("sectors", "locationNote")], ["products", msg("sectors", "products")], ["capacity", msg("sectors", "capacityFacilities")], ["technicalSpecs", msg("sectors", "technicalSpecifications")], ["packaging", msg("sectors", "packaging")],
  ["certificates", msg("sectors", "certifications")], ["missingCertificates", msg("sectors", "missingCertifications")], ["markets", msg("sectors", "exportMarkets")], ["description", msg("sectors", "companyProfile")],
];
const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900";
const link = (url: string) => /^https?:\/\//i.test(url) ? url : `https://${url}`;

export default function SectorDirectory() {
  const { fmt } = useI18n();
  const [sectors, setSectors] = useState<Sector[] | null>(null);
  const [companies, setCompanies] = useState<DirectoryCompany[]>([]);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<DirectoryCompany | null>(null);
  const [newSector, setNewSector] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fail = (e: Error) => setError(msg("sectors", "couldNotLoadDataValue", e.message));
    const stopSectors = onSnapshot(collection(db, "sectors"), snapshot => {
      if (snapshot.empty && !snapshot.metadata.fromCache) void seed();
      setSectors(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Sector)).filter(item => !item.archived).sort((a, b) => a.name.localeCompare(b.name, fmt.locale)));
    }, fail);
    const stopCompanies = onSnapshot(collection(db, "directoryCompanies"), snapshot => setCompanies(snapshot.docs.map(item => ({ ...emptyCompany(""), ...item.data(), id: item.id } as DirectoryCompany))), fail);
    return () => { stopSectors(); stopCompanies(); };
  }, []);
  useEffect(() => { if (sectors?.length && !sectors.some(sector => sector.id === selected)) setSelected(sectors[0].id); }, [sectors, selected]);

  const seed = () => runTransaction(db, async tx => {
    const ref = doc(db, "sectors", seedSector.id);
    if ((await tx.get(ref)).exists()) return;
    tx.set(ref, { name: seedSector.name, archived: false, updatedAt: serverTimestamp() });
    const { id, ...company } = seedCompany;
    tx.set(doc(db, "directoryCompanies", id), { ...company, updatedAt: serverTimestamp() });
  }).catch(e => setError(msg("sectors", "couldNotCreateInitialRecordsValue", e.message)));

  const run = async (task: () => Promise<unknown>) => { setBusy(true); setError(""); try { await task(); return true; } catch (e) { setError(e instanceof Error ? e.message : msg("sectors", "operationFailed")); return false; } finally { setBusy(false); } };
  const addSector = () => { const name = newSector.trim(); if (!name) return; if (sectors?.some(s => s.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) { setError(msg("sectors", "thisSectorAlreadyExists")); return; } const ref = doc(collection(db, "sectors")); void run(() => setDoc(ref, { name, archived: false, updatedAt: serverTimestamp() })).then(ok => { if (ok) { setNewSector(""); setSelected(ref.id); } }); };
  const renameSector = (id: string, name: string) => { if (!name.trim()) return; void run(() => setDoc(doc(db, "sectors", id), { name: name.trim(), updatedAt: serverTimestamp() }, { merge: true })).then(() => setRenaming(null)); };
  const archiveSector = (sector: Sector) => { if (window.confirm(msg("sectors", "archiveTheSectorValueItsCompaniesWillBePreserved", sector.name))) void run(() => setDoc(doc(db, "sectors", sector.id), { archived: true, updatedAt: serverTimestamp() }, { merge: true })); };
  const saveCompany = (company: DirectoryCompany) => {
    if (!company.name.trim()) { setError(msg("sectors", "enterACompanyName")); return; }
    const { id, ...data } = company;
    void run(() => setDoc(doc(db, "directoryCompanies", id), { ...data, name: data.name.trim(), contacts: data.contacts.filter(c => c.name.trim() || c.email.trim() || c.phone.trim()), updatedAt: serverTimestamp() })).then(ok => { if (ok) setEditing(null); });
  };
  const removeCompany = (company: DirectoryCompany) => { if (window.confirm(msg("sectors", "permanentlyDeleteValue", company.name))) void run(() => deleteDoc(doc(db, "directoryCompanies", company.id))); };

  const sector = sectors?.find(item => item.id === selected);
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    return companies.filter(c => c.sectorId === selected && (!term || [c.name, c.location, c.products, c.productSummary || "", c.certificates, ...c.contacts.map(p => p.name)].join(" ").toLocaleLowerCase("tr-TR").includes(term))).sort((a, b) => a.name.localeCompare(b.name, fmt.locale));
  }, [companies, selected, search, fmt.locale]);

  if (!sectors) return <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{error || msg("sectors", "loadingSectors")}</div>;
  return <section aria-labelledby="sectors-title" className="grid gap-6 lg:grid-cols-[260px_1fr]">
    <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 lg:self-start">
      <h2 id="sectors-title" className="flex items-center gap-2 text-lg font-semibold text-navy"><Layers className="h-5 w-5 text-teal-700" /> {msg("sectors", "sectors")}</h2>
      <nav aria-label={msg("sectors", "sectors2")} className="space-y-1">{sectors.map(item => <button key={item.id} onClick={() => { setSelected(item.id); setEditing(null); }} aria-current={item.id === selected ? "page" : undefined} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${item.id === selected ? "bg-navy font-semibold text-white" : "text-slate-600 hover:bg-slate-50"}`}><span className="truncate">{item.name}</span><span className={`ml-2 rounded-full px-2 text-xs ${item.id === selected ? "bg-white/20" : "bg-slate-100"}`}>{fmt.number(companies.filter(c => c.sectorId === item.id).length)}</span></button>)}</nav>
      {!sectors.length && <p className="text-sm text-slate-500">{msg("sectors", "noSectorsYet")}</p>}
      <form className="flex gap-2 border-t border-slate-100 pt-3" onSubmit={e => { e.preventDefault(); addSector(); }}><input aria-label={msg("sectors", "newSectorName")} className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2 text-sm" maxLength={100} placeholder={msg("sectors", "newSector")} value={newSector} onChange={e => setNewSector(e.target.value)} /><button disabled={busy || !newSector.trim()} aria-label={msg("sectors", "addSector")} className="rounded-lg bg-teal-700 px-3 text-white disabled:opacity-40"><Plus className="h-4 w-4" /></button></form>
    </aside>

    <div className="space-y-4">
      {error && <p role="alert" className="flex items-start justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={() => setError("")} aria-label={msg("sectors", "close")}><X className="h-4 w-4" /></button></p>}
      {sector && <>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          {renaming !== null ? <form className="flex flex-1 gap-2" onSubmit={e => { e.preventDefault(); renameSector(sector.id, renaming); }}><input autoFocus aria-label={msg("sectors", "sectorName")} className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2 text-sm" maxLength={100} value={renaming} onChange={e => setRenaming(e.target.value)} /><button disabled={busy} className="rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white">{msg("sectors", "save")}</button><button type="button" onClick={() => setRenaming(null)} className="px-2 text-sm text-slate-500">{msg("sectors", "cancel")}</button></form>
            : <><h3 className="flex-1 text-xl font-semibold text-navy">{sector.name} <span className="text-sm font-normal text-slate-400">· {fmt.number(companies.filter(c => c.sectorId === sector.id).length)} {companies.filter(c => c.sectorId === sector.id).length === 1 ? msg("sectors", "company") : msg("sectors", "companies")}</span></h3>
              <button onClick={() => setRenaming(sector.name)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-navy"><Pencil className="h-4 w-4" /> {msg("sectors", "rename")}</button>
              <button onClick={() => archiveSector(sector)} className="flex items-center gap-1 text-sm text-red-700"><Archive className="h-4 w-4" /> {msg("sectors", "archive")}</button></>}
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3"><Search className="h-4 w-4 text-slate-400" /><input type="search" aria-label={msg("sectors", "searchCompanies")} className="w-full py-2 text-sm outline-none" placeholder={msg("sectors", "searchCompanyProductCertificationOrContact")} value={search} onChange={e => setSearch(e.target.value)} /></label>
          <button onClick={() => setEditing(emptyCompany(sector.id))} className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {msg("sectors", "addCompany")}</button>
        </div>
        {editing && !companies.some(c => c.id === editing.id) && <CompanyForm company={editing} onChange={setEditing} onSave={saveCompany} onCancel={() => setEditing(null)} busy={busy} />}
        {!visible.length && !editing && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{search ? msg("sectors", "noCompaniesMatchYourSearch") : msg("sectors", "noCompaniesInThisSectorYet")}</p>}
        {visible.map(company => editing?.id === company.id ? <CompanyForm key={company.id} company={editing} onChange={setEditing} onSave={saveCompany} onCancel={() => setEditing(null)} busy={busy} />
          : <CompanyCard key={company.id} company={company} onEdit={() => setEditing(structuredClone(company))} onRemove={() => removeCompany(company)} />)}
      </>}
    </div>
  </section>;
}

// Turns e-mail addresses and web links inside free text into clickable links.
function Linkify({ text }: { text: string }) {
  return <>{text.split(/((?:https?:\/\/|www\.)[^\s,;()]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g).map((part, index) => index % 2 === 0 ? part
    : part.includes("@") && !part.startsWith("http") ? <a key={index} className="text-teal-700 hover:underline" href={`mailto:${part}`}>{part}</a>
    : <a key={index} className="text-teal-700 hover:underline" href={link(part)} target="_blank" rel="noreferrer">{part}</a>)}</>;
}
function Lines({ text }: { text: string }) {
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  return lines.length > 1 ? <ul className="list-disc space-y-1 pl-5">{lines.map((line, index) => <li key={index}><Linkify text={line.replace(/^[-•]\s*/, "")} /></li>)}</ul> : <p><Linkify text={lines[0] ?? ""} /></p>;
}
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="grid gap-1 border-t border-slate-100 pt-3 sm:grid-cols-[150px_1fr] sm:gap-4"><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4><div className="space-y-2 text-slate-700">{children}</div></section>;
}

export function CompanyCard({ company, onEdit, onRemove }: { company: DirectoryCompany; onEdit: () => void; onRemove: () => void }) {
  const { fmt } = useI18n();
  const meta = [company.companyType, company.foundedYear && msg("sectors", "establishedValue", company.foundedYear), company.employees && msg("sectors", "valueEmployees", company.employees)].filter(Boolean);
  const contactName = company.contacts.find(person => person.name.trim())?.name;
  const hasContact = company.website || company.catalogUrl || company.phone || company.email || company.contacts.length > 0;
  const text = (value?: string) => value?.trim() ? <Lines text={value} /> : null;
  const sections: [string, React.ReactNode][] = [
    [msg("sectors", "location"), (company.location || company.address || company.locationNote) && <>{company.address ? <p className="flex gap-1"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{company.address}</p> : company.location && <p className="flex gap-1"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{company.location}</p>}{text(company.locationNote)}</>],
    [msg("sectors", "products"), text(company.products)],
    [msg("sectors", "capacityFacilities2"), text(company.capacity)],
    [msg("sectors", "technicalSpecifications2"), text(company.technicalSpecs)],
    [msg("sectors", "packaging"), text(company.packaging)],
    [msg("sectors", "certifications"), (company.certificates || company.missingCertificates) && <>{text(company.certificates)}{company.missingCertificates?.trim() && <p className="text-amber-800"><span className="font-semibold">{msg("sectors", "missing")}</span> <Linkify text={company.missingCertificates} /></p>}</>],
    [msg("sectors", "exportMarkets"), text(company.markets)],
    [msg("sectors", "contactDetails"), hasContact && <>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {company.website && <a className="flex items-center gap-1 text-teal-700 hover:underline" href={link(company.website)} target="_blank" rel="noreferrer"><Globe className="h-4 w-4" /> {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>}
        {company.catalogUrl && <a className="flex items-center gap-1 font-semibold text-teal-700 hover:underline" href={link(company.catalogUrl)} target="_blank" rel="noreferrer"><BookOpen className="h-4 w-4" /> {msg("sectors", "catalogue")}</a>}
        {company.phone && <a className="flex items-center gap-1 hover:text-navy" href={`tel:${company.phone.replace(/[^\d+]/g, "")}`}><Phone className="h-4 w-4" /> {company.phone}</a>}
        {company.email && <a className="flex items-center gap-1 text-teal-700 hover:underline" href={`mailto:${company.email}`}><Mail className="h-4 w-4" /> {company.email}</a>}
      </div>
      {company.contacts.length > 0 && <ul className="grid gap-2 sm:grid-cols-2">{company.contacts.map(person => <li key={person.id} className="rounded-lg bg-slate-50 p-3"><p className="font-semibold text-navy">{person.name || person.title}</p>{person.name && person.title && <p className="text-xs text-slate-500">{person.title}</p>}<div className="mt-1 space-y-0.5 text-xs">{person.phone && <a className="block hover:text-navy" href={`tel:${person.phone.replace(/[^\d+]/g, "")}`}>{person.phone}</a>}{person.email && <a className="block text-teal-700 hover:underline" href={`mailto:${person.email}`}>{person.email}</a>}</div></li>)}</ul>}
    </>],
    [msg("sectors", "notes"), text(company.notes)],
  ];
  return <details className="group rounded-2xl border border-slate-200 bg-white open:border-teal-300">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Building2 className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-2 font-semibold text-navy">{company.name}{company.isDemo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">{msg("sectors", "demo")}</span>}</p><p className="truncate text-xs text-slate-500">{[company.location, company.productSummary || company.products].filter(Boolean).join(" · ")}</p></div>
      {contactName && <span className="hidden items-center gap-1 text-xs text-slate-500 sm:flex"><UserRound className="h-3.5 w-3.5" /> {contactName}</span>}
      <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
    </summary>
    <div className="space-y-3 border-t border-slate-100 p-4 text-sm">
      {company.description && <div className="text-slate-600"><Lines text={company.description} /></div>}
      {meta.length > 0 && <p className="flex flex-wrap gap-2">{meta.map(item => <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{item}</span>)}</p>}
      {sections.filter(([, content]) => content).map(([title, content]) => <Block key={title} title={title}>{content}</Block>)}
      <div className="flex gap-4 border-t border-slate-100 pt-3"><button onClick={onEdit} className="flex items-center gap-1 font-semibold text-teal-700"><Pencil className="h-4 w-4" /> {msg("sectors", "edit")}</button><button onClick={onRemove} className="flex items-center gap-1 text-red-700"><Trash2 className="h-4 w-4" /> {msg("sectors", "delete")}</button></div>
    </div>
  </details>;
}
function CompanyForm({ company, onChange, onSave, onCancel, busy }: { company: DirectoryCompany; onChange: (company: DirectoryCompany) => void; onSave: (company: DirectoryCompany) => void; onCancel: () => void; busy: boolean }) {
  const { fmt } = useI18n();
  const set = (patch: Partial<DirectoryCompany>) => onChange({ ...company, ...patch });
  const setContact = (id: string, patch: Partial<DirectoryContact>) => set({ contacts: company.contacts.map(person => person.id === id ? { ...person, ...patch } : person) });
  return <form className="space-y-4 rounded-2xl border border-teal-300 bg-teal-50/30 p-4" onSubmit={e => { e.preventDefault(); onSave(company); }}>
    <h4 className="font-semibold text-navy">{company.name || msg("sectors", "newCompany")}</h4>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields().map(([key, label, max, placeholder]) => <label key={key} className="text-xs text-slate-600">{label}<input className={input} maxLength={max} placeholder={placeholder} type={key === "email" ? "email" : "text"} value={(company[key] as string | undefined) ?? ""} onChange={e => set({ [key]: e.target.value })} /></label>)}</div>
    <p className="text-xs text-slate-500">{msg("sectors", "eachLineInTheFollowingFieldsAppearsAsA")}</p>
    <div className="grid gap-3 sm:grid-cols-2">{longFields().map(([key, label]) => <label key={key} className="text-xs text-slate-600">{label}<textarea className={input} rows={3} maxLength={4000} value={(company[key] as string | undefined) ?? ""} onChange={e => set({ [key]: e.target.value })} /></label>)}</div>
    <div className="space-y-2"><h5 className="text-sm font-semibold text-navy">{msg("sectors", "contacts")}</h5>
      {company.contacts.map(person => <div key={person.id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_28px]">
        {(["name", "title", "phone", "email"] as const).map(key => <label key={key} className="text-xs text-slate-500">{{ name: msg("sectors", "fullName"), title: msg("sectors", "jobTitleDepartment"), phone: msg("sectors", "phone"), email: msg("sectors", "email") }[key]}<input className={input} maxLength={key === "email" ? 254 : 200} type={key === "email" ? "email" : "text"} value={person[key]} onChange={e => setContact(person.id, { [key]: e.target.value })} /></label>)}
        <button type="button" aria-label={msg("sectors", "removeContactValue", person.name || "Kişi")} className="mt-5 text-red-700" onClick={() => set({ contacts: company.contacts.filter(item => item.id !== person.id) })}><Trash2 className="h-4 w-4" /></button>
      </div>)}
      <button type="button" className="flex items-center gap-2 text-sm font-semibold text-teal-700" onClick={() => set({ contacts: [...company.contacts, { id: crypto.randomUUID(), name: "", title: "", phone: "", email: "" }] })}><Plus className="h-4 w-4" /> {msg("sectors", "addContact")}</button>
    </div>
    <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={!!company.isDemo} onChange={e => set({ isDemo: e.target.checked })} /> {msg("sectors", "demoFictionalRecord")}</label>
    <label className="block text-xs text-slate-600">{msg("sectors", "notes")}<textarea className={input} rows={2} maxLength={3000} value={company.notes} onChange={e => set({ notes: e.target.value })} /></label>
    <div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? msg("sectors", "saving") : msg("sectors", "save")}</button><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">{msg("sectors", "cancel")}</button></div>
  </form>;
}
