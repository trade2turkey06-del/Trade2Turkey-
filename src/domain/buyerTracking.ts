import type {BuyerContact} from './buyers';
export const EMAIL_STATUSES=['Not sent','Draft','Sent','Replied','Bounced'] as const;
export const LINKEDIN_STATUSES=['Queued','Invite sent','Connected','No invite','Profile not found'] as const;
export const REPLY_CHANNELS=['None','Auto-reply','Email','LinkedIn'] as const;
export const TRACKING_COLUMNS=[
 {csv:'priority',key:'priority',kind:'select',max:1,options:['A','B','C']},
 {csv:'email_status',key:'emailStatus',kind:'select',max:20,options:EMAIL_STATUSES},
 {csv:'planned_send_date',key:'plannedSendDate',kind:'date',max:10},
 {csv:'sent_date',key:'sentDate',kind:'date',max:10},
 {csv:'follow_up_date',key:'followUpDate',kind:'date',max:10},
 {csv:'salutation',key:'salutation',kind:'text',max:250},
 {csv:'email_subject',key:'emailSubject',kind:'text',max:1000},
 {csv:'call_to_action',key:'callToAction',kind:'select',max:30,options:['20-min call','Referral + call']},
 {csv:'reply_channel',key:'replyChannel',kind:'select',max:20,options:REPLY_CHANNELS},
 {csv:'reply_summary',key:'replySummary',kind:'textarea',max:8000},
 {csv:'linkedin_url',key:'linkedinUrl',kind:'url',max:2000},
 {csv:'linkedin_status',key:'linkedinStatus',kind:'select',max:30,options:LINKEDIN_STATUSES},
 {csv:'linkedin_message_sent',key:'linkedinMessageSent',kind:'select',max:3,options:['Yes','No']},
 {csv:'linkedin_degree',key:'linkedinDegree',kind:'select',max:3,options:['1st','2nd','3rd']},
 {csv:'linkedin_invite_order',key:'linkedinInviteOrder',kind:'number',max:1000000},
 {csv:'linkedin_invite_date',key:'linkedinInviteDate',kind:'date',max:10},
 {csv:'linkedin_current_title',key:'linkedinCurrentTitle',kind:'text',max:500},
 {csv:'linkedin_current_company',key:'linkedinCurrentCompany',kind:'text',max:250},
 {csv:'still_at_company',key:'stillAtCompany',kind:'text',max:250},
 {csv:'last_checked',key:'lastChecked',kind:'date',max:10},
] as const;
export type TrackingKey=typeof TRACKING_COLUMNS[number]['key'];
export type BuyerTracking=Partial<Record<Exclude<TrackingKey,'linkedinInviteOrder'>,string>> & {linkedinInviteOrder?:number};
export const CONTACT_EDITABLE_FIELDS=['name','title','category','email','phone','outreachBatch','status','lastContacted','notes','sharedMailbox',...TRACKING_COLUMNS.map(c=>c.key)] as const;
export function validIsoDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function validTrackingValue(key:TrackingKey,value:unknown){
 const field=TRACKING_COLUMNS.find(c=>c.key===key)!;
 if(value==='')return true;
 if(field.kind==='number')return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=field.max;
 if(typeof value!=='string'||value.length>field.max)return false;
 if(field.kind==='date')return validIsoDate(value);
 if('options'in field)return (field.options as readonly string[]).includes(value);
 if(key==='linkedinUrl')return safeLinkedInUrl(value)!==null;
 if(key==='stillAtCompany')return ['Yes','Unclear','Left'].includes(value)||/^Left \(moved to .+\)$/.test(value);
 return true;
}
export function safeLinkedInUrl(value:string|undefined){try{const url=new URL(value||'');return url.protocol==='https:'&&(url.hostname==='linkedin.com'||url.hostname.endsWith('.linkedin.com'))&&!url.username&&!url.password&&!url.port?url.href:null;}catch{return null;}}
export const activityEntries=(value?:string)=>(value||'').split(' | ').map(s=>s.trim()).filter(Boolean);
export const hasContactWarning=(c:BuyerContact)=>/DO NOT SEND|ON HOLD|WARNING|BOUNCED/i.test(c.notes||'');
export const hasLeftCompany=(c:BuyerContact)=>(c.stillAtCompany||'').startsWith('Left');
export const effectiveEmailStatus=(c:BuyerContact)=>c.emailStatus||'Not sent';
export function isFollowUpDue(c:BuyerContact,today:string){return !c.archived&&!!c.followUpDate&&validIsoDate(c.followUpDate)&&c.followUpDate<=today&&effectiveEmailStatus(c)==='Sent'&&['None','Auto-reply'].includes(c.replyChannel||'None');}
export function trackingSummary(contacts:BuyerContact[],today:string){const active=contacts.filter(c=>!c.archived);return {email:Object.fromEntries(EMAIL_STATUSES.map(s=>[s,active.filter(c=>effectiveEmailStatus(c)===s).length])),linkedin:Object.fromEntries(LINKEDIN_STATUSES.map(s=>[s,active.filter(c=>c.linkedinStatus===s).length])),due:active.filter(c=>isFollowUpDue(c,today)).sort((a,b)=>a.followUpDate!.localeCompare(b.followUpDate!))};}
export type TrackingFilters=Partial<Record<'emailStatus'|'linkedinStatus'|'priority'|'stillAtCompany'|'outreachBatch',string>>;
export function matchesTracking(c:BuyerContact,filters:TrackingFilters){return Object.entries(filters).every(([key,value])=>!value||(key==='stillAtCompany'&&value==='Left'?hasLeftCompany(c):(key==='emailStatus'?effectiveEmailStatus(c):c[key as keyof BuyerContact])===value));}
export function istanbulToday(now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-');}
// Persist manual overrides across repeated imports; only actual editor changes are marked.
export function contactEditPatch(original:BuyerContact|undefined,edited:BuyerContact){return Object.fromEntries(CONTACT_EDITABLE_FIELDS.filter(key=>JSON.stringify(original?.[key]??'')!==JSON.stringify(edited[key]??'')).map(key=>[key,edited[key]??'']));}

export function previousManualFields(contact:BuyerContact){
 const millis=(v:any):number=>typeof v==='string'?Date.parse(v):v?.toMillis?.()??0;
 const unknownEdit=!!contact.updatedAt&&(!contact.importedAt||millis(contact.updatedAt)>millis(contact.importedAt))&&(!contact.manualUpdatedAt||millis(contact.updatedAt)>millis(contact.manualUpdatedAt));
 return [...new Set([...(contact.manualFields||[]),...(unknownEdit?CONTACT_EDITABLE_FIELDS.filter(key=>contact[key]!==undefined&&contact[key]!==''):[])])];
}
