import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { parseDecimal } from "../../domain/productSpec";
import { specText as t } from "../../i18n/productSpec";

export const input = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:border-transparent disabled:bg-transparent disabled:px-0";
export const formatNumber = (value: number | null | undefined, digits = 6) => value === null || value === undefined ? "" : value.toLocaleString("tr-TR", { maximumFractionDigits: digits, useGrouping: false });

// Ondalık alan: "5,87" ve "5.87" kabul edilir; yazarken metin korunur, okunamayan giriş kırmızı çerçeveyle gösterilir.
export function NumberField({ value, onChange, disabled, label, className = "" }: { value: number | null; onChange: (value: number | null) => void; disabled?: boolean; label: string; className?: string }) {
  const [text, setText] = useState(formatNumber(value));
  useEffect(() => { if ((text.trim() ? parseDecimal(text) : null) !== value) setText(formatNumber(value)); }, [value]);
  const invalid = text.trim() !== "" && parseDecimal(text) === null;
  return <input aria-label={label} aria-invalid={invalid} inputMode="decimal" className={`${input} ${invalid ? "border-red-500" : ""} ${className}`} value={text} disabled={disabled}
    onChange={event => { setText(event.target.value); onChange(event.target.value.trim() ? parseDecimal(event.target.value) : null); }} />;
}
export function TextField({ value, onChange, disabled, label, placeholder, maxLength = 300, type = "text" }: { value: string; onChange: (value: string) => void; disabled?: boolean; label: string; placeholder?: string; maxLength?: number; type?: string }) {
  return <input aria-label={label} type={type} className={input} value={value} maxLength={maxLength} placeholder={disabled ? "" : placeholder} disabled={disabled} onChange={event => onChange(event.target.value)} />;
}
export function Labeled({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block text-xs font-medium text-slate-600 ${className}`}>{label}<div className="mt-1">{children}</div></label>;
}
export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return <details open className="spec-section rounded-xl border border-slate-200 bg-white">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden"><h3 className="text-sm font-semibold text-navy">{title}</h3>{actions && <div className="ml-auto flex flex-wrap gap-2" onClick={event => event.stopPropagation()}>{actions}</div>}</summary>
    <div className="space-y-3 border-t border-slate-100 p-4">{children}</div>
  </details>;
}
export const Notice = ({ tone = "amber", children }: { tone?: "amber" | "red" | "slate" | "teal"; children: ReactNode }) => {
  const tones = { amber: "bg-amber-50 text-amber-900", red: "bg-red-50 text-red-800", slate: "bg-slate-50 text-slate-600", teal: "bg-teal-50 text-teal-900" };
  return <div role={tone === "red" || tone === "amber" ? "alert" : undefined} className={`rounded-lg p-3 text-xs ${tones[tone]}`}>{children}</div>;
};
export const SmallButton = ({ onClick, disabled, children, title }: { onClick: () => void; disabled?: boolean; children: ReactNode; title?: string }) =>
  <button type="button" title={title} onClick={onClick} disabled={disabled} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-semibold text-teal-700 disabled:opacity-40">{children}</button>;

// Serbest satırlı tablo: ekleme, silme ve yukarı/aşağı sıralama.
export interface Column<T> { label: string; className?: string; render: (row: T, update: (patch: Partial<T>) => void) => ReactNode }
export function RowTable<T extends { id: string }>({ rows, columns, onChange, create, disabled, empty, sortable = true, footer }: { rows: T[]; columns: Column<T>[]; onChange: (rows: T[]) => void; create?: () => T; disabled: boolean; empty?: string; sortable?: boolean; footer?: ReactNode }) {
  const update = (id: string, patch: Partial<T>) => onChange(rows.map(row => row.id === id ? { ...row, ...patch } : row));
  const move = (index: number, delta: number) => { const next = [...rows]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; onChange(next); };
  return <div className="space-y-2">
    <div className="spec-scroll overflow-x-auto"><table>
      <thead><tr>{columns.map(column => <th key={column.label} className={column.className}>{column.label}</th>)}{!disabled && create && <th className="spec-no-print w-24"><span className="sr-only">İşlem</span></th>}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row.id}>
        {columns.map(column => <td key={column.label} className={column.className}>{column.render(row, patch => update(row.id, patch))}</td>)}
        {!disabled && create && <td className="spec-no-print whitespace-nowrap">
          {sortable && <><button type="button" aria-label={t.moveUp} title={t.moveUp} disabled={index === 0} onClick={() => move(index, -1)} className="rounded p-1 text-slate-500 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label={t.moveDown} title={t.moveDown} disabled={index === rows.length - 1} onClick={() => move(index, 1)} className="rounded p-1 text-slate-500 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button></>}
          <button type="button" aria-label={t.removeRow} title={t.removeRow} onClick={() => onChange(rows.filter(item => item.id !== row.id))} className="rounded p-1 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
        </td>}
      </tr>)}
      {!rows.length && <tr><td colSpan={columns.length + 1} className="text-center text-xs text-slate-400">{empty ?? t.none}</td></tr>}</tbody>
      {footer}
    </table></div>
    {!disabled && create && <SmallButton onClick={() => onChange([...rows, create()])}><Plus className="h-3.5 w-3.5" /> {t.addRow}</SmallButton>}
  </div>;
}
