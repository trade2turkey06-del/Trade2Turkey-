// Stacked horizontal cost bars shared by the A.B.5 COGS sheet and the A.B.9 BOM comparison: one bar per manufacturer,
// segments as shares of its total. Exact values are in the sheet's table (the chart's table view); segments carry tooltips.
export interface BarSegment { key: string; value: number }
export interface BarRow { id: string; name: string; total: number | null; segments: BarSegment[] }

export default function CostBars({ title, empty, legend, rows, money, pct }: {
  title: string; empty: string; legend: { key: string; label: string; color: string }[]; rows: BarRow[];
  money: (value: number | null) => string; pct: (value: number | null) => string;
}) {
  const colors = Object.fromEntries(legend.map(item => [item.key, item])), any = rows.some(row => row.total);
  return <figure className="space-y-2 rounded-lg border border-slate-200 p-3" aria-label={title}>
    <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"><span className="mr-2 font-semibold text-slate-700">{title}</span>
      {legend.map(item => <span key={item.key} className="flex items-center gap-1 text-slate-600"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />{item.label}</span>)}
    </figcaption>
    {!any ? <p className="text-xs text-slate-500">{empty}</p> : rows.map(row => {
      const total = row.total ?? 0, parts = row.segments.filter(part => part.value > 0);
      return <div key={row.id} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-2 text-xs">
        <span className="truncate text-slate-700" title={row.name}>{row.name}</span>
        <div className="flex h-3.5 gap-[2px]" role="img" aria-label={`${row.name}: ${row.segments.map(part => `${colors[part.key]?.label} ${pct(total ? part.value / total * 100 : null)}`).join(", ")}`}>
          {total > 0 && parts.map((part, index) => <span key={part.key} title={`${colors[part.key]?.label}: ${pct(part.value / total * 100)} · ${money(part.value)}`} className={`${index === 0 ? "rounded-l" : ""} ${index === parts.length - 1 ? "rounded-r" : ""}`} style={{ width: `${part.value / total * 100}%`, backgroundColor: colors[part.key]?.color, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }} />)}
        </div>
        <span className="tabular-nums text-slate-700">{row.total === null ? "–" : money(row.total)}</span>
      </div>;
    })}
  </figure>;
}
