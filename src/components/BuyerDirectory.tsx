import React, {useEffect, useMemo, useState} from 'react';
import {collection, doc, onSnapshot, runTransaction, serverTimestamp, setDoc, arrayUnion, deleteField} from 'firebase/firestore';
import {Archive, Building2, ChevronDown, Download, Globe, Pencil, Plus, Search, Users, X} from 'lucide-react';
import {db} from '../lib/firebase';
import {previousManualFields,contactEditPatch, TRACKING_COLUMNS, validTrackingValue, istanbulToday, matchesTracking, hasLeftCompany, type TrackingFilters} from '../domain/buyerTracking';
import {BuyerTrackingFilters,CountryTrackingSummary,ContactTrackingDetail,TrackingEditorFields,TrackingBadge,ContactWarnings,LinkedInContact} from './BuyerTracking';
import {useI18n} from '../i18n';
import {BUYER_COLLECTIONS, BUYER_STATUSES, DEFAULT_BUYER_COUNTRIES, DEFAULT_BUYER_TYPES, buyerFlag, companyMatches, contactMatches, exportBuyers, normalizeBuyerKey, type BuyerCountry, type BuyerCompanyType, type BuyerCompany, type BuyerContact} from '../domain/buyers';

const input='mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900';
const button='inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 disabled:opacity-40';
const primary=button+' !border-teal-700 !bg-teal-700 !text-white';
const panel='rounded-2xl border border-slate-200 bg-white p-4';
type Editor={kind:'country';value:BuyerCountry}|{kind:'type';value:BuyerCompanyType}|{kind:'company';value:BuyerCompany}|{kind:'contact';value:BuyerContact;original?:BuyerContact};
const collections={country:'buyerCountries',type:'buyerCompanyTypes',company:'buyerCompanies',contact:'buyerContacts'};
const freshCompany=(countryId:string,typeId:string):BuyerCompany=>({id:crypto.randomUUID(),countryId,typeId,name:'',website:'',city:'',categories:'',notes:'',archived:false});
const freshContact=(companyId:string):BuyerContact=>({id:crypto.randomUUID(),companyId,name:'',title:'',category:'',email:'',phone:'',outreachBatch:'',status:'Not contacted',lastContacted:'',notes:'',sharedMailbox:false,archived:false});

export default function BuyerDirectory(){
 const {t,fmt}=useI18n(), labels=t.buyers;
 const [records,setRecords]=useState<Record<string,any[]>>({});
 const [selected,setSelected]=useState('gb'),[type,setType]=useState(''),[globalQuery,setGlobalQuery]=useState('');
 const [filters,setFilters]=useState<TrackingFilters>({}),[contactDetail,setContactDetail]=useState(''),[today,setToday]=useState(istanbulToday);
 useEffect(()=>{const timer=setInterval(()=>setToday(istanbulToday()),60000);return()=>clearInterval(timer);},[]);
 const [contactQuery,setContactQuery]=useState(''),[status,setStatus]=useState(''),[detail,setDetail]=useState('');
 const [editor,setEditor]=useState<Editor|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 // Sectors-style real-time listeners keep counts, filters and edits in sync across admin sessions.
 useEffect(()=>{
  const stops=BUYER_COLLECTIONS.map(name=>onSnapshot(collection(db,name),snapshot=>setRecords(old=>({...old,[name]:snapshot.docs.map(d=>({...d.data(),id:d.id}))})),()=>setError(labels.error)));
  const defaults=[...DEFAULT_BUYER_COUNTRIES.map(value=>({name:'buyerCountries',value})),...DEFAULT_BUYER_TYPES.map(value=>({name:'buyerCompanyTypes',value}))];
  void runTransaction(db,async tx=>{
   const refs=defaults.map(d=>doc(db,d.name,d.value.id)), snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
   snapshots.forEach((snapshot,i)=>{if(!snapshot.exists()){const {id,...data}=defaults[i].value;tx.set(refs[i],{...data,updatedAt:serverTimestamp()});}});
  }).catch(()=>setError(labels.error));
  return ()=>stops.forEach(stop=>stop());
 },[]);
 const countries=(records.buyerCountries||[]) as BuyerCountry[],types=(records.buyerCompanyTypes||[]) as BuyerCompanyType[];
 const companies=(records.buyerCompanies||[]) as BuyerCompany[],contacts=(records.buyerContacts||[]) as BuyerContact[];
 const activeCountries=countries.filter(c=>!c.archived).sort((a,b)=>a.name.localeCompare(b.name,'en'));
 const activeCompanies=companies.filter(c=>!c.archived&&activeCountries.some(country=>country.id===c.countryId));
 const activeContacts=contacts.filter(c=>!c.archived&&activeCompanies.some(company=>company.id===c.companyId));
 const country=activeCountries.find(c=>c.id===selected),company=activeCompanies.find(c=>c.id===detail);
 useEffect(()=>{if(!country&&activeCountries.length)setSelected(activeCountries[0].id);},[selected,records.buyerCountries]);
 const visible=useMemo(()=>activeCompanies.filter(c=>(globalQuery.trim()||c.countryId===selected)&&(!type||globalQuery.trim()||c.typeId===type)&&companyMatches(c,activeContacts,globalQuery)&&(!Object.values(filters).some(Boolean)||activeContacts.some(p=>p.companyId===c.id&&matchesTracking(p,filters)))).sort((a,b)=>a.name.localeCompare(b.name,'en')),[records,selected,type,globalQuery,filters]);
 const shownContacts=activeContacts.filter(c=>c.companyId===detail&&contactMatches(c,contactQuery)&&(!status||c.status===status)&&matchesTracking(c,filters)).sort((a,b)=>(a.name||a.email).localeCompare(b.name||b.email,'en'));
 const run=async(task:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await task();return true;}catch{setError(labels.error);return false;}finally{setBusy(false);}};
 const archive=(kind:Editor['kind'],id:string)=>{if(window.confirm(labels.archiveConfirm))void run(()=>kind==='contact'?runTransaction(db,async tx=>{const ref=doc(db,'buyerContacts',id),snapshot=await tx.get(ref);if(!snapshot.exists())throw Error('Contact missing');tx.update(ref,{archived:true,updatedAt:serverTimestamp(),manualFields:arrayUnion('archived',...previousManualFields(snapshot.data() as BuyerContact)),manualUpdatedAt:serverTimestamp()});}):setDoc(doc(db,collections[kind],id),{archived:true,updatedAt:serverTimestamp()},{merge:true})).then(ok=>{if(ok){setEditor(null);if(kind==='company')setDetail('');}});};
 const save=()=>{
  if(!editor)return;
  const value=editor.value;
  if((editor.kind!=='contact'&&!value.name.trim())||(editor.kind==='contact'&&!editor.value.name.trim()&&!editor.value.email.trim())){setError(labels.invalid);return;}
  const duplicates=editor.kind==='country'?countries.some(c=>c.id!==value.id&&normalizeBuyerKey(c.name)===normalizeBuyerKey(value.name)):
   editor.kind==='type'?types.some(c=>c.id!==value.id&&normalizeBuyerKey(c.name)===normalizeBuyerKey(value.name)):
   editor.kind==='company'?companies.some(c=>c.id!==value.id&&c.countryId===editor.value.countryId&&normalizeBuyerKey(c.name)===normalizeBuyerKey(value.name)):
   contacts.some(c=>c.id!==value.id&&((editor.value.email.trim()&&normalizeBuyerKey(c.email)===normalizeBuyerKey(editor.value.email))||(!editor.value.email.trim()&&c.companyId===editor.value.companyId&&normalizeBuyerKey(c.name)===normalizeBuyerKey(editor.value.name))));
  if(duplicates){setError(labels.duplicate);return;}
  if(editor.kind==='contact'){
   const currentEditor=editor;
   if(TRACKING_COLUMNS.some(field=>currentEditor.value[field.key]!==undefined&&!validTrackingValue(field.key,currentEditor.value[field.key]))){setError(labels.invalid);return;}
   const patch=contactEditPatch(currentEditor.original,currentEditor.value),ref=doc(db,'buyerContacts',value.id);
   if(!Object.keys(patch).length&&currentEditor.original){setEditor(null);return;}
   void run(()=>runTransaction(db,async tx=>{
    const snapshot=await tx.get(ref);
    if(snapshot.exists()){
     for(const key of Object.keys(patch))if(currentEditor.original&&JSON.stringify(snapshot.data()[key]??'')!==JSON.stringify(currentEditor.original[key as keyof BuyerContact]??''))throw Error('Concurrent edit');
     tx.update(ref,{...patch,...(patch.linkedinInviteOrder===''?{linkedinInviteOrder:deleteField()}:{}),manualFields:arrayUnion(...Object.keys(patch),...previousManualFields(snapshot.data() as BuyerContact)),manualUpdatedAt:serverTimestamp(),updatedAt:serverTimestamp()});
    }else{const {id,importedAt,updatedAt,...data}=currentEditor.value;tx.set(ref,{...Object.fromEntries(Object.entries(data).filter(([,v])=>v!==undefined)),manualFields:Object.keys(patch),manualUpdatedAt:serverTimestamp(),updatedAt:serverTimestamp()});}
   })).then(ok=>{if(ok)setEditor(null);});return;
  }
  const {id,...data}=value;
  void run(()=>setDoc(doc(db,collections[editor.kind],id),{...data,updatedAt:serverTimestamp()},{merge:true})).then(ok=>{if(ok)setEditor(null);});
 };
 const download=(scope:'country'|'company')=>{
  const rows=scope==='company'?activeCompanies.filter(c=>c.id===detail):activeCompanies.filter(c=>c.countryId===selected);
  const blob=new Blob([exportBuyers(countries,types,rows,contacts)],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`buyers-${scope}-${scope==='company'?detail:selected}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const chooseCountry=(id:string)=>{setSelected(id);setDetail('');setType('');setEditor(null);setGlobalQuery('');setContactQuery('');setStatus('');setFilters({});setContactDetail('');};
 const openCompany=(c:BuyerCompany)=>{setDetail(c.id);setSelected(c.countryId);setGlobalQuery('');setContactQuery('');setStatus('');setEditor(null);};
 const typeName=(id:string)=>types.find(t=>t.id===id)?.name||'';
 const companyContacts=(id:string)=>activeContacts.filter(c=>c.companyId===id);
 if(BUYER_COLLECTIONS.some(name=>!records[name]))return <div role="status" className={panel}>{error||labels.loading}</div>;
 return <section aria-labelledby="buyers-title" className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="buyers-title" className="flex items-center gap-2 text-xl font-semibold text-navy"><Users className="h-5 w-5 text-teal-700"/>{labels.title}</h2><p className="mt-1 text-xs text-slate-500">{labels.dataHint}</p></div>
   <label className="flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 lg:w-1/2"><Search className="h-4 w-4 shrink-0 text-slate-400"/><input type="search" aria-label={labels.globalSearch} placeholder={labels.globalSearch} value={globalQuery} onChange={e=>{setGlobalQuery(e.target.value);setDetail('');setEditor(null);}} className="w-full py-2 text-sm outline-none"/></label>
  </div>
  {error&&<div role="alert" className="flex justify-between rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}<button aria-label={labels.close} onClick={()=>setError('')}><X className="h-4 w-4"/></button></div>}
  <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
   <aside className={panel+' space-y-3 lg:self-start'}><h3 className="flex items-center gap-2 font-semibold text-navy"><Globe className="h-5 w-5 text-teal-700"/>{labels.countries}</h3>
    <nav aria-label={labels.countries} className="space-y-2">{activeCountries.map(c=>{const list=activeCompanies.filter(v=>v.countryId===c.id),count=activeContacts.filter(v=>!v.sharedMailbox&&list.some(co=>co.id===v.companyId)).length,mailboxes=activeContacts.filter(v=>v.sharedMailbox&&list.some(co=>co.id===v.companyId)).length;return <button key={c.id} onClick={()=>chooseCountry(c.id)} aria-current={c.id===selected?'page':undefined} className={`w-full rounded-xl p-3 text-left ${c.id===selected?'bg-navy text-white':'bg-slate-50 text-slate-600 hover:bg-teal-50'}`}><span className="flex items-center gap-2 font-medium"><span aria-hidden="true" className="text-xl">{buyerFlag(c.isoCode)}</span>{c.name}</span><span className="mt-1 block text-xs opacity-70">{fmt.number(list.length)} {labels.companyCount} · {fmt.number(count)} {labels.people}{mailboxes>0&&<> · {fmt.number(mailboxes)} {labels.generalAddress}</>}</span></button>;})}</nav>
    <button disabled={busy} className={button+' w-full'} onClick={()=>setEditor({kind:'country',value:{id:crypto.randomUUID(),name:'',isoCode:'',archived:false}})}><Plus className="h-4 w-4"/>{labels.addCountry}</button>
   </aside>
   <div className="min-w-0 space-y-4">
    {editor&&<BuyerEditor editor={editor} onChange={setEditor} onSave={save} onCancel={()=>setEditor(null)} busy={busy} countries={activeCountries} types={types.filter(t=>!t.archived)}/>}
    {country&&<div className={panel+' flex flex-wrap items-center gap-2'}><h3 className="mr-auto text-lg font-semibold text-navy">{buyerFlag(country.isoCode)} {country.name}</h3><button disabled={busy} className={button} onClick={()=>setEditor({kind:'country',value:{...country}})}><Pencil className="h-4 w-4"/>{labels.rename}</button><button disabled={busy} className={button} onClick={()=>archive('country',country.id)}><Archive className="h-4 w-4"/>{labels.archive}</button><button className={button} onClick={()=>download('country')}><Download className="h-4 w-4"/>{labels.exportCountry}</button></div>}
    {country&&!company&&!globalQuery.trim()&&<CountryTrackingSummary contacts={activeContacts.filter(c=>activeCompanies.some(co=>co.id===c.companyId&&co.countryId===selected))} companies={activeCompanies} today={today} onOpen={c=>{const co=activeCompanies.find(co=>co.id===c.companyId)!;openCompany(co);setFilters({});setContactDetail(c.id);}}/>}
    <BuyerTrackingFilters filters={filters} onChange={setFilters} batches={[...new Set(activeContacts.filter(c=>activeCompanies.some(co=>co.id===c.companyId&&co.countryId===selected)).map(c=>c.outreachBatch).filter(Boolean))].sort()}/>
    {!country&&!activeCountries.length&&<p className={panel}>{labels.noCountries}</p>}
    {!company&&<>
     <div className="flex flex-wrap gap-2" role="group" aria-label={labels.companyType}><button aria-pressed={!type} className={!type?primary:button} onClick={()=>setType('')}>{labels.all}</button>{types.filter(t=>!t.archived).sort((a,b)=>a.name.localeCompare(b.name,'en')).map(t=><button key={t.id} aria-pressed={type===t.id} className={type===t.id?primary:button} onClick={()=>{setType(t.id);setGlobalQuery('');}}>{t.name}</button>)}<button disabled={busy} className={button} onClick={()=>setEditor({kind:'type',value:{id:crypto.randomUUID(),name:'',archived:false}})}><Plus className="h-4 w-4"/>{labels.addType}</button></div>
     {country&&<button disabled={busy} className={primary} onClick={()=>setEditor({kind:'company',value:freshCompany(selected,type||types.find(t=>!t.archived)?.id||'')})}><Plus className="h-4 w-4"/>{labels.addCompany}</button>}
     {!visible.length&&<p className={panel+' text-center text-sm text-slate-500'}>{labels.noResults}</p>}
     <div className="grid gap-3 xl:grid-cols-2">{visible.map(c=><article key={c.id} className="rounded-2xl border border-slate-200 bg-white hover:border-teal-300"><button className="w-full p-4 text-left" onClick={()=>openCompany(c)}><div className="flex items-center gap-3"><Building2 className="h-8 w-8 shrink-0 rounded-lg bg-teal-50 p-1.5 text-teal-700"/><div className="min-w-0 flex-1"><h4 className="font-semibold text-navy">{c.name}</h4><p className="text-xs text-slate-500">{typeName(c.typeId)} · {countries.find(co=>co.id===c.countryId)?.name}</p></div><ChevronDown className="h-4 w-4 text-slate-400"/></div><p className="mt-3 break-words text-xs text-slate-500">{[c.city,c.categories,c.website].filter(Boolean).join(' · ')}</p><p className="mt-2 text-xs font-medium text-teal-700">{fmt.number(companyContacts(c.id).filter(p=>!p.sharedMailbox).length)} {labels.people}{companyContacts(c.id).some(p=>p.sharedMailbox)&&<> · {fmt.number(companyContacts(c.id).filter(p=>p.sharedMailbox).length)} {labels.generalAddress}</>}</p></button><div className="flex gap-2 border-t border-slate-100 px-4 py-2"><button disabled={busy} className={button} onClick={()=>setEditor({kind:'company',value:{...c}})}><Pencil className="h-3 w-3"/>{labels.edit}</button><button disabled={busy} className={button} onClick={()=>archive('company',c.id)}><Archive className="h-3 w-3"/>{labels.archive}</button></div></article>)}</div>
    </>}
    {company&&<div className={panel+' space-y-4'}>
     <div className="flex flex-wrap gap-2"><button className={button} onClick={()=>{setDetail('');setEditor(null);}}>{labels.back}</button><button disabled={busy} className={button} onClick={()=>setEditor({kind:'company',value:{...company}})}><Pencil className="h-4 w-4"/>{labels.edit}</button><button disabled={busy} className={button} onClick={()=>archive('company',company.id)}><Archive className="h-4 w-4"/>{labels.archive}</button><button className={button} onClick={()=>download('company')}><Download className="h-4 w-4"/>{labels.exportCompany}</button></div>
     <div><h3 className="text-xl font-semibold text-navy">{company.name}</h3><p className="text-sm text-slate-500">{[typeName(company.typeId),company.city,company.categories].filter(Boolean).join(' · ')}</p>{/^https:\/\//i.test(company.website)&&<a className="text-sm text-teal-700 underline" href={company.website} target="_blank" rel="noreferrer">{company.website}</a>}{company.notes&&<p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{company.notes}</p>}</div>
     <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-xs text-slate-500">{labels.contactSearch}<input type="search" className={input} value={contactQuery} onChange={e=>setContactQuery(e.target.value)}/></label><label className="text-xs text-slate-500">{labels.status}<select className={input} value={status} onChange={e=>setStatus(e.target.value)}><option value="">{labels.all}</option>{BUYER_STATUSES.map(s=><option key={s} value={s}>{labels.statuses[s]}</option>)}</select></label><button disabled={busy} className={primary} onClick={()=>setEditor({kind:'contact',value:freshContact(company.id)})}><Plus className="h-4 w-4"/>{labels.addContact}</button></div>
     {contactDetail&&activeContacts.some(c=>c.id===contactDetail&&c.companyId===company.id)&&<ContactTrackingDetail contact={activeContacts.find(c=>c.id===contactDetail)!} onClose={()=>setContactDetail('')}/>}
     <div className="overflow-x-auto"><table className="w-full min-w-[1700px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{[labels.name,labels.titleField,labels.category,labels.email,labels.phone,labels.outreachBatch,labels.status,labels.lastContacted,labels.trackingFields.priority,labels.trackingFields.emailStatus,labels.trackingFields.sentDate,labels.trackingFields.followUpDate,labels.linkedin,labels.trackingFields.stillAtCompany,labels.notes,labels.edit].map((label,i)=><th key={i} className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{shownContacts.map(c=><tr key={c.id} onClick={()=>setContactDetail(c.id)} className={`cursor-pointer border-b border-slate-100 align-top hover:bg-teal-50/40 ${hasLeftCompany(c)?'opacity-50':''}`}><td className="p-3 font-medium text-navy"><button className="text-left underline decoration-teal-200" aria-expanded={contactDetail===c.id} onClick={e=>{e.stopPropagation();setContactDetail(contactDetail===c.id?'':c.id);}}>{c.name||c.email}</button> <ContactWarnings contact={c}/>{c.sharedMailbox&&<span className="mt-1 block rounded bg-teal-50 px-1 py-0.5 text-[10px] text-teal-700">{labels.generalAddress}</span>}</td><td className="p-3">{c.title}</td><td className="p-3">{c.category}</td><td className="p-3">{c.email&&<a onClick={e=>e.stopPropagation()} className="text-teal-700 underline" href={`mailto:${c.email}`}>{c.email}</a>}</td><td className="p-3">{c.phone&&<a onClick={e=>e.stopPropagation()} href={`tel:${c.phone.replace(/[^+\d]/g,'')}`}>{c.phone}</a>}</td><td className="p-3">{c.outreachBatch}</td><td className="p-3">{labels.statuses[c.status]}</td><td className="p-3">{c.lastContacted}</td><td className="p-3"><TrackingBadge value={c.priority}/></td><td className="p-3"><TrackingBadge value={c.emailStatus||'Not sent'}/></td><td className="p-3">{c.sentDate}</td><td className="p-3">{c.followUpDate}</td><td className="p-3"><LinkedInContact contact={c}/></td><td className="p-3"><TrackingBadge value={c.stillAtCompany}/></td><td className="max-w-48 truncate p-3">{c.notes}</td><td className="space-y-2 p-3"><button disabled={busy} className={button} onClick={e=>{e.stopPropagation();setEditor({kind:'contact',value:{...c},original:{...c}});}} aria-label={`${labels.edit}: ${c.name||c.email}`}><Pencil className="h-3 w-3"/></button><button disabled={busy} className={button} onClick={e=>{e.stopPropagation();archive('contact',c.id);}} aria-label={`${labels.archive}: ${c.name||c.email}`}><Archive className="h-3 w-3"/></button></td></tr>)}</tbody></table>{!shownContacts.length&&<p className="p-6 text-center text-sm text-slate-500">{labels.noResults}</p>}</div>
    </div>}
   </div>
  </div>
 </section>;
}

function BuyerEditor({editor,onChange,onSave,onCancel,busy,countries,types}:{editor:Editor;onChange:(value:Editor)=>void;onSave:()=>void;onCancel:()=>void;busy:boolean;countries:BuyerCountry[];types:BuyerCompanyType[]}){
 const {t}=useI18n(),l=t.buyers;
 const update=(key:string,value:string|number|boolean|undefined)=>onChange({...editor,value:{...editor.value,[key]:value}} as Editor);
 const field=(key:string,label:string,max:number,required=false,kind='text')=><label key={key} className="text-xs text-slate-600">{label}<input className={input} type={kind} required={required} maxLength={max} value={String((editor.value as any)[key]??'')} onChange={e=>update(key,key==='isoCode'?e.target.value.toUpperCase():e.target.value)} {...(key==='isoCode'?{pattern:'[A-Z]{2}'}:{})} {...(key==='website'?{pattern:'https://[^\\s]+'}:{})}/></label>;
 const select=(key:string,label:string,options:{id:string;name:string}[])=><label className="text-xs text-slate-600">{label}<select required className={input} value={(editor.value as any)[key]} onChange={e=>update(key,e.target.value)}><option value="" disabled>—</option>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>;
 return <form className="space-y-3 rounded-2xl border border-teal-300 bg-teal-50/30 p-4" onSubmit={e=>{e.preventDefault();onSave();}}>
  <div className="flex justify-between"><h3 className="font-semibold text-navy">{editor.kind==='country'?l.country:editor.kind==='type'?l.companyType:editor.kind==='company'?l.company:l.contacts}</h3><button type="button" aria-label={l.close} onClick={onCancel}><X className="h-4 w-4"/></button></div><p className="text-xs text-slate-500">{l.dataHint}</p>
  <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   {field('name',l.name,editor.kind==='country'||editor.kind==='type'?100:250,editor.kind!=='contact')}
   {editor.kind==='country'&&field('isoCode',l.isoCode,2,true)}
   {editor.kind==='company'&&<>{select('countryId',l.country,countries)}{select('typeId',l.companyType,types)}{field('website',l.website,2000,false,'url')}{field('city',l.city,250)}{field('categories',l.categories,2000)}</>}
   {editor.kind==='contact'&&<>{field('title',l.titleField,250)}{field('category',l.category,1000)}{field('email',l.email,254,!editor.value.name.trim(),'email')}{field('phone',l.phone,100,false,'tel')}{field('outreachBatch',l.outreachBatch,250)}{select('status',l.status,BUYER_STATUSES.map(s=>({id:s,name:l.statuses[s]})))}{field('lastContacted',l.lastContacted,10,false,'date')}<label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={editor.value.sharedMailbox} onChange={e=>update('sharedMailbox',e.target.checked)}/>{l.sharedMailbox}</label></>}
   {editor.kind==='contact'&&<TrackingEditorFields contact={editor.value} onChange={update}/>}
   {(editor.kind==='company'||editor.kind==='contact')&&<label className="text-xs text-slate-600 sm:col-span-2">{l.notes}<textarea className={input} rows={3} maxLength={4000} value={editor.value.notes} onChange={e=>update('notes',e.target.value)}/></label>}
  </fieldset>
  <div className="flex gap-2"><button disabled={busy} className={primary}>{l.save}</button><button type="button" className={button} onClick={onCancel}>{l.cancel}</button></div>
 </form>;
}
