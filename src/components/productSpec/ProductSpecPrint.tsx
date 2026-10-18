import { formatPercent } from "../../i18n";
import type { ReactNode } from "react";
import { allergensFrom, claimStatus, effective, formulationTotal, LEVEL_NUTRIENTS, level, NUTRIENTS, proteinEnergyPct, type ProductSpec } from "../../domain/productSpec";
import { useI18n } from "../../i18n";
import { marketName, reasonText, type MarketOption } from "./ClaimCheckSection";
import { formatNumber } from "./fields";

// Müşteri ve üreticiye gönderilecek temiz çıktı. Ekranda gizlidir; yalnızca "PDF olarak dışa aktar" ile yazdırılır.
export const printCss = `
.spec-print-root { display: none; }
@media print {
  body.spec-printing > *:not(.spec-print-root) { display: none !important; }
  body.spec-printing .spec-print-root { display: block !important; }
  @page { size: A4 portrait; margin: 14mm 12mm; }
}
.spec-print-root { font-family: Inter, system-ui, sans-serif; color: #0f172a; font-size: 10.5px; line-height: 1.45; }
.spec-print-root h1 { font-size: 18px; margin: 0; color: #1b3058; }
.spec-print-root h2 { font-size: 12px; margin: 14px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid #1b3058; color: #1b3058; break-after: avoid; }
.spec-print-root table { width: 100%; border-collapse: collapse; margin-top: 2px; }
.spec-print-root th, .spec-print-root td { border: 1px solid #cbd5e1; padding: 3px 5px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
.spec-print-root th { background: #eef2f6; font-weight: 600; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.spec-print-root tr { break-inside: avoid; }
.spec-print-root .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 14px; }
.spec-print-root .muted { color: #64748b; }
.spec-print-root .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 8px; }
.spec-print-root .sign div { border: 1px solid #cbd5e1; padding: 8px; min-height: 64px; }
`;
const dash = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const num = (value: number | null) => value === null ? "—" : formatNumber(value, 4);
const Field = ({ label, children }: { label: string; children: ReactNode }) => <div><span className="muted">{label}: </span><strong>{children}</strong></div>;
function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return <table><thead><tr>{head.map(item => <th key={item}>{item}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={head.length} className="muted">—</td></tr>}</tbody></table>;
}

export default function ProductSpecPrint({ spec, claims, market }: { spec: ProductSpec; claims: string[]; market?: MarketOption }) {
  const { t: messages, fmt } = useI18n();
  const t = messages.productSpec;
  const protein = proteinEnergyPct(spec.nutrition);
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #1b3058", paddingBottom: 6 }}>
      <div><p className="muted" style={{ margin: 0 }}>Trade2Turkey</p><h1>{t.print.documentTitle}</h1></div>
      <div style={{ textAlign: "right" }}><strong>{spec.general.productName}{spec.general.variant && ` — ${spec.general.variant}`}</strong><br />{spec.version} · {t.status[spec.status]}<br /><span className="muted">{t.print.generated(fmt.date(new Date(), { day: "numeric", month: "long", year: "numeric" }))}</span></div>
    </div>

    <h2>{t.general.heading}</h2>
    <div className="grid"><Field label={t.general.manufacturer}>{spec.manufacturerName}</Field><Field label={t.general.markets}>{dash(spec.general.markets)}</Field><Field label={t.general.preparedBy}>{dash(spec.general.preparedBy)}</Field><Field label={t.general.date}>{dash(spec.general.date)}</Field><Field label={t.general.version}>{spec.version}</Field><Field label={t.general.status}>{t.status[spec.status]}</Field></div>

    <h2>{t.formulation.heading}</h2>
    <Table head={[t.formulation.name, t.formulation.ratio, t.formulation.function, t.formulation.supplier, t.formulation.allergen, t.formulation.halal, t.formulation.vegan, t.formulation.ratioSource, t.formulation.note]}
      rows={[...spec.formulation.map(row => [row.name, num(row.ratio), dash(row.function), dash(row.supplier), row.allergen ? `${t.yes}${row.allergenName ? ` (${row.allergenName})` : ""}` : t.no, row.halal ? t.yes : t.no, row.vegan ? t.yes : t.no, t.formulation.sources[row.ratioSource], dash(row.note)]),
        [<strong>{t.formulation.total}</strong>, <strong>{formatPercent(formulationTotal(spec.formulation), 2)}</strong>, "", "", "", "", "", "", ""]]} />

    <h2>{t.nutrition.heading}</h2>
    <Table head={[t.nutrition.nutrient, t.nutrition.target, t.nutrition.actual, t.nutrition.tolerance]} rows={NUTRIENTS.map(key => [t.nutrition.labels[key], num(spec.nutrition[key].target), num(spec.nutrition[key].actual), num(spec.nutrition[key].tolerance)])} />

    <h2>{t.claims.heading}</h2>
    <p className="muted" style={{ margin: "0 0 4px" }}>{t.claims.disclaimer} {market && `(${market.id} — ${marketName(t, market)})`}</p>
    <Field label={t.claims.proteinEnergy}>{protein === null ? "—" : formatPercent(protein, 1)}</Field>
    <Field label={t.claims.levelsHeading}>{LEVEL_NUTRIENTS.map(key => `${t.claims.levelNutrients[key]}: ${t.claims.levels[level(effective(spec.nutrition[key]), market?.levels[key])]}`).join(" · ")}</Field>
    {claims.length > 0 && <Table head={[t.claims.ruleLabel, t.nutrition.check, t.formulation.note]} rows={claims.map(claim => { const result = claimStatus(claim, spec, market); return [claim, t.claims.statuses[result.status], reasonText(t, result.reason)]; })} />}

    <h2>{t.physical.heading}</h2>
    <Table head={[t.physical.name, t.physical.target, t.physical.unit, t.physical.tolerance]} rows={spec.physical.map(row => [row.name || (row.key ? t.physical.defaults[row.key] : ""), dash(row.target), dash(row.unit), dash(row.tolerance)])} />

    <h2>{t.micro.heading}</h2>
    <Table head={[t.micro.parameter, t.micro.limit, t.micro.unit, t.micro.method]} rows={spec.micro.map(row => [row.parameter, row.limit, dash(row.unit), dash(row.method)])} />

    <h2>{t.allergens.heading}</h2>
    <Field label={t.allergens.contains}>{allergensFrom(spec.formulation).join(", ") || "—"}</Field>
    <Field label={t.allergens.mayContain}>{dash(spec.allergens.mayContain)}</Field>

    <h2>{t.process.heading}</h2>
    <Table head={[t.process.step, t.process.parameter, t.process.control]} rows={spec.process.map(row => [row.step, dash(row.parameter), dash(row.control)])} />

    <h2>{t.packaging.heading}</h2>
    <Table head={[t.packaging.level, t.packaging.material, t.packaging.size, t.packaging.quantity, t.packaging.perUnits]} rows={spec.packaging.map(row => [t.packaging.levels[row.level], dash(row.material), dash(row.size), num(row.quantity), num(row.perUnits)])} />

    <h2>{t.storage.heading}</h2>
    <div className="grid"><Field label={t.storage.frozen}>{dash(spec.storage.frozen)}</Field><Field label={t.storage.ambient}>{dash(spec.storage.ambient)}</Field><Field label={t.storage.shelfLife}>{dash(spec.storage.shelfLife)}</Field><Field label={t.storage.labelLanguage}>{dash(spec.storage.labelLanguage)}</Field></div>
    {spec.storage.mandatoryInfo && <p style={{ whiteSpace: "pre-wrap" }}><span className="muted">{t.storage.mandatoryInfo}: </span>{spec.storage.mandatoryInfo}</p>}

    <h2>{t.openItems.heading}</h2>
    <Table head={[t.openItems.question, t.openItems.owner, t.openItems.status]} rows={spec.openItems.map(row => [row.question, dash(row.owner), t.openItems.statuses[row.status]])} />

    <h2>{t.approval.heading}</h2>
    <div className="grid"><Field label={t.approval.goldenCode}>{dash(spec.goldenSample.code)}</Field><Field label={t.approval.goldenLocation}>{spec.goldenSample.location ? t.approval.goldenLocations[spec.goldenSample.location] : "—"}</Field><Field label={t.approval.goldenDate}>{dash(spec.goldenSample.date)}</Field></div>
    <div className="sign">
      <div><strong>{t.approval.t2t}</strong><br />{t.approval.name}: {dash(spec.approval.trade2turkey.name)}<br />{t.approval.date}: {dash(spec.approval.trade2turkey.date)}</div>
      <div><strong>{t.approval.manufacturer}</strong> ({spec.manufacturerName})<br />{t.approval.name}: {dash(spec.approval.manufacturer.name)}<br />{t.approval.date}: {dash(spec.approval.manufacturer.date)}</div>
    </div>
  </div>;
}
