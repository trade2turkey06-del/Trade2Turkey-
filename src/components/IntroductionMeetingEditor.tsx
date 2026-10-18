import { CodedError } from "../i18n/errors";
import { useI18n } from "../i18n";
import { CheckCircle2, Plus, Trash2, Users } from "lucide-react";

export interface MeetingTopic { id: string; topic: string; discussed: boolean; notes: string }
export interface IntroductionMeeting { id: string; manufacturer: string; date: string; attendees: string; followUp: string; topics: MeetingTopic[] }

// Agenda transcribed from the supplied Tanışma toplantısı PDF.
const agenda = ["Samples", "Product Development Options", "Open-book costing / Cost breakdown analysis", "Payment terms", "Production timeline (20 DC and 40 DC)", "Floor load numbers / Pallet Load Number", "Warranty Terms", "Specification sheets", "Certificates", "Claims", "Audits"];

export const createIntroductionMeeting = (manufacturer = ""): IntroductionMeeting => ({
  id: crypto.randomUUID(), manufacturer, date: "", attendees: "", followUp: "",
  topics: agenda.map(topic => ({ id: crypto.randomUUID(), topic, discussed: false, notes: "" })),
});

// Every agenda item must be gone through before the step can be completed.
export function validateMeetings(meetings: IntroductionMeeting[]) {
  if (!meetings.length) throw new CodedError("meetingsNone");
  for (const meeting of meetings) {
    if (!meeting.manufacturer.trim()) throw new CodedError("meetingsManufacturer");
    const open = meeting.topics.filter(topic => !topic.discussed);
    if (open.length) throw new CodedError("meetingsOpenTopics", { name: meeting.manufacturer.trim(), topics: open.map(topic => topic.topic || "—").join(", ") });
  }
}

const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 disabled:bg-slate-50";

export default function IntroductionMeetingEditor({ meetings, onChange, disabled, manufacturers = [] }: { meetings: IntroductionMeeting[]; onChange: (meetings: IntroductionMeeting[]) => void; disabled: boolean; manufacturers?: string[] }) {
  const { t, fmt } = useI18n();
  const m = t.editors.meetings;
  const update = (id: string, patch: Partial<IntroductionMeeting>) => onChange(meetings.map(meeting => meeting.id === id ? { ...meeting, ...patch } : meeting));
  const updateTopic = (meeting: IntroductionMeeting, id: string, patch: Partial<MeetingTopic>) => update(meeting.id, { topics: meeting.topics.map(topic => topic.id === id ? { ...topic, ...patch } : topic) });
  const missing = manufacturers.filter(name => !meetings.some(meeting => fmt.lower(meeting.manufacturer.trim()) === fmt.lower(name.trim())));

  return <fieldset disabled={disabled} className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
    <legend className="px-2 font-semibold text-navy">{m.title(meetings.length)}</legend>
    <p className="text-sm text-slate-600">{m.help}</p>
    <datalist id="meeting-manufacturers">{manufacturers.map(name => <option key={name} value={name} />)}</datalist>
    {!meetings.length && <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">{m.empty}</p>}
    {meetings.map((meeting, index) => {
      const done = meeting.topics.filter(topic => topic.discussed).length;
      const complete = meeting.topics.length > 0 && done === meeting.topics.length;
      return <details key={meeting.id} open className="rounded-xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4 font-semibold text-navy"><Users className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-words">{index + 1}. {meeting.manufacturer || m.newMeeting}</span>
          <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{complete && <CheckCircle2 className="h-3.5 w-3.5" />}{m.topicsDone(done, meeting.topics.length)}</span></summary>
        <div className="space-y-4 border-t border-slate-100 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-slate-600">{m.manufacturer}<input className={input} maxLength={250} list="meeting-manufacturers" value={meeting.manufacturer} onChange={e => update(meeting.id, { manufacturer: e.target.value })} /></label>
            <label className="text-xs text-slate-600">{m.date}<input type="date" className={input} value={meeting.date} onChange={e => update(meeting.id, { date: e.target.value })} /></label>
            <label className="text-xs text-slate-600">{m.attendees}<input className={input} maxLength={500} placeholder={m.attendeesPlaceholder} value={meeting.attendees} onChange={e => update(meeting.id, { attendees: e.target.value })} /></label>
          </div>
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-navy">{m.agenda}</h5>
            {meeting.topics.map(topic => <div key={topic.id} className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[24px_1fr_1.5fr_28px] sm:items-start ${topic.discussed ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200"}`}>
              <input type="checkbox" aria-label={m.discussed(topic.topic || m.defaultTopic)} className="mt-3 h-4 w-4 accent-teal-700" checked={topic.discussed} onChange={e => updateTopic(meeting, topic.id, { discussed: e.target.checked })} />
              <label className="text-xs text-slate-500">{m.topic}<input className={input} maxLength={200} value={topic.topic} onChange={e => updateTopic(meeting, topic.id, { topic: e.target.value })} /></label>
              <label className="text-xs text-slate-500">{m.notes}<textarea className={input} rows={1} maxLength={2000} value={topic.notes} onChange={e => updateTopic(meeting, topic.id, { notes: e.target.value })} /></label>
              <button type="button" aria-label={m.deleteTopic(topic.topic || m.defaultTopic)} className="mt-3 text-red-700 disabled:opacity-40" onClick={() => { if (window.confirm(m.deleteTopicConfirm(topic.topic || m.defaultTopic))) update(meeting.id, { topics: meeting.topics.filter(item => item.id !== topic.id) }); }}><Trash2 className="h-4 w-4" /></button>
            </div>)}
            <button type="button" className="flex items-center gap-2 text-sm font-semibold text-teal-700 disabled:opacity-40" onClick={() => update(meeting.id, { topics: [...meeting.topics, { id: crypto.randomUUID(), topic: "", discussed: false, notes: "" }] })}><Plus className="h-4 w-4" /> {m.addTopic}</button>
          </div>
          <label className="block text-xs text-slate-600">{m.followUp}<textarea className={input} rows={3} maxLength={3000} value={meeting.followUp} onChange={e => update(meeting.id, { followUp: e.target.value })} /></label>
          <button type="button" className="flex items-center gap-1 text-sm text-red-700 disabled:opacity-40" onClick={() => { if (window.confirm(m.removeConfirm(meeting.manufacturer || m.newMeeting))) onChange(meetings.filter(item => item.id !== meeting.id)); }}><Trash2 className="h-4 w-4" /> {m.remove}</button>
        </div>
      </details>;
    })}
    <div className="flex flex-wrap gap-3">
      <button type="button" className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={() => onChange([...meetings, createIntroductionMeeting()])}><Plus className="h-4 w-4" /> {m.add}</button>
      {missing.length > 0 && <button type="button" className="flex items-center gap-2 rounded-lg border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700 disabled:opacity-40" onClick={() => onChange([...meetings, ...missing.map(name => createIntroductionMeeting(name))])}><Users className="h-4 w-4" /> {m.createForShortlist(missing.length)}</button>}
    </div>
  </fieldset>;
}
