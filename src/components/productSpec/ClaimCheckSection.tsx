import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  CLAIM_METRICS, claimStatus, DEFAULT_THRESHOLDS, effective, LEVEL_NUTRIENTS, level, newId, proteinEnergyPct,
  type ClaimReason, type ClaimRule, type MarketThresholds, type ProductSpec,
} from "../../domain/productSpec";
import { saveThresholds } from "../../lib/productSpecStore";
import { specText as t } from "../../i18n/productSpec";
import { formatNumber, input, Labeled, Notice, NumberField, Section, SmallButton, TextField } from "./fields";

export type MarketOption = MarketThresholds & { stored: boolean };
const levelTone: Record<string, string> = { low: "bg-emerald-100 text-emerald-800", medium: "bg-amber-100 text-amber-800", high: "bg-red-100 text-red-800", unknown: "bg-slate-100 text-slate-600" };
const statusTone: Record<string, string> = { ok: "bg-emerald-100 text-emerald-800", check: "bg-amber-100 text-amber-800", fail: "bg-red-100 text-red-800" };
export function reasonText(reason: ClaimReason) {
  if (reason.code === "formulationFail") return t.claims.reasons.formulationFail(reason.names.join(", "));
  if (reason.code === "compare") return t.claims.reasons.compare(formatNumber(reason.value, 2), reason.operator, formatNumber(reason.threshold, 2));
  return t.claims.reasons[reason.code];
}

export default function ClaimCheckSection({ spec, onChange, disabled, isAdmin, claims, markets }: { spec: ProductSpec; onChange: (spec: ProductSpec) => void; disabled: boolean; isAdmin: boolean; claims: string[]; markets: MarketOption[] }) {
  const market = markets.find(item => item.id === spec.general.claimMarket) ?? markets[0];
  const proteinPct = proteinEnergyPct(spec.nutrition);
  return <Section title={t.claims.heading}>
    <Notice>{t.claims.disclaimer}</Notice>
    <div className="grid gap-4 sm:grid-cols-3">
      <Labeled label={t.claims.market}><select className={input} value={market?.id ?? ""} disabled={disabled} onChange={event => onChange({ ...spec, general: { ...spec.general, claimMarket: event.target.value } })}>{markets.map(item => <option key={item.id} value={item.id}>{item.id} — {item.market}</option>)}</select></Labeled>
      <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2"><p className="text-xs text-slate-500">{t.claims.proteinEnergy} <span className="font-mono">{t.claims.proteinEnergyFormula}</span></p><p className="mt-1 text-lg font-semibold text-navy">{proteinPct === null ? <span className="text-sm font-normal text-slate-500">{t.claims.proteinEnergyMissing}</span> : `%${formatNumber(proteinPct, 1)}`}</p><p className="text-[11px] text-slate-400">{t.claims.basis}</p></div>
    </div>
    <div><p className="mb-2 text-xs font-semibold text-slate-600">{t.claims.levelsHeading}</p><div className="flex flex-wrap gap-2">{LEVEL_NUTRIENTS.map(key => {
      const value = effective(spec.nutrition[key]), result = level(value, market?.levels[key]);
      return <span key={key} className={`rounded-full px-3 py-1 text-xs font-medium ${levelTone[result]}`}>{t.claims.levelNutrients[key]}: {t.claims.levels[result]}{value !== null && ` (${formatNumber(value, 2)} g)`}</span>;
    })}</div></div>
    <div><p className="mb-2 text-xs font-semibold text-slate-600">{t.claims.claimsHeading}</p>
      {claims.length ? <ul className="space-y-1.5">{claims.map(claim => { const result = claimStatus(claim, spec, market); return <li key={claim} className="flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone[result.status]}`}>{t.claims.statuses[result.status]}</span><span className="font-medium">{claim}</span><span className="text-xs text-slate-500">{reasonText(result.reason)}</span></li>; })}</ul>
        : <p className="text-xs text-slate-400">{t.claims.noClaims}</p>}
    </div>
    {market && <ThresholdSettings key={market.id} market={market} markets={markets} isAdmin={isAdmin} />}
  </Section>;
}

// Pazar ayarları: koddaki değerler yalnızca kayıt yoksa gösterilen örneklerdir; kaydedilen değerler claimThresholds koleksiyonuna yazılır.
function ThresholdSettings({ market, markets, isAdmin }: { market: MarketOption; markets: MarketOption[]; isAdmin: boolean }) {
  const [draft, setDraft] = useState<MarketThresholds>(structuredClone(market));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(structuredClone(market)), [market.updatedAt?.seconds, market.stored]);
  const readOnly = !isAdmin || busy;
  const setRule = (id: string, patch: Partial<ClaimRule>) => setDraft(previous => ({ ...previous, claims: previous.claims.map(item => item.id === id ? { ...item, ...patch } : item) }));
  const save = async (value: MarketThresholds) => { setBusy(true); setMessage(""); try { await saveThresholds(value); setMessage(t.saved); } catch { setMessage("Kaydedilemedi. Yönetici yetkisi gerekli."); } finally { setBusy(false); } };
  const addMarket = () => {
    const code = window.prompt(t.claims.newMarketPrompt)?.trim().toUpperCase();
    if (!code) return;
    if (!/^[A-Z0-9-]{2,20}$/.test(code)) { setMessage("Pazar kodu 2–20 harf/rakam olmalı."); return; }
    if (markets.some(item => item.id === code)) { setMessage(t.claims.marketExists); return; }
    void save({ ...structuredClone(DEFAULT_THRESHOLDS[0]), id: code, market: code });
  };
  return <details className="rounded-lg border border-slate-200">
    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">{t.claims.settings}</summary>
    <div className="space-y-3 border-t border-slate-100 p-3">
      <p className="text-[11px] text-slate-500">{t.claims.settingsHelp}</p>
      {!market.stored && <Notice tone="slate">{t.claims.usingDefaults}</Notice>}
      <Labeled label={t.claims.marketName} className="max-w-xs"><TextField label={t.claims.marketName} value={draft.market} maxLength={100} disabled={readOnly} onChange={value => setDraft({ ...draft, market: value })} /></Labeled>
      <div className="spec-scroll overflow-x-auto"><table><thead><tr><th>{t.claims.levelsHeading}</th><th>{t.claims.levelLow}</th><th>{t.claims.levelHigh}</th></tr></thead><tbody>{LEVEL_NUTRIENTS.map(key => <tr key={key}>
        <td>{t.claims.levelNutrients[key]} (g/100 g)</td>
        <td><NumberField label={`${t.claims.levelNutrients[key]} ${t.claims.levelLow}`} value={draft.levels[key]?.low ?? null} disabled={readOnly} onChange={value => setDraft({ ...draft, levels: { ...draft.levels, [key]: { ...draft.levels[key], low: value } } })} /></td>
        <td><NumberField label={`${t.claims.levelNutrients[key]} ${t.claims.levelHigh}`} value={draft.levels[key]?.high ?? null} disabled={readOnly} onChange={value => setDraft({ ...draft, levels: { ...draft.levels, [key]: { ...draft.levels[key], high: value } } })} /></td>
      </tr>)}</tbody></table></div>
      <p className="text-xs font-semibold text-slate-600">{t.claims.rules}</p>
      <div className="spec-scroll overflow-x-auto"><table><thead><tr><th>{t.claims.ruleLabel}</th><th>{t.claims.ruleAliases}</th><th>{t.claims.ruleMetric}</th><th>{t.claims.ruleOperator}</th><th>{t.claims.ruleValue}</th>{!readOnly && <th />}</tr></thead><tbody>{draft.claims.map(item => <tr key={item.id}>
        <td><TextField label={t.claims.ruleLabel} value={item.label} maxLength={100} disabled={readOnly} onChange={value => setRule(item.id, { label: value })} /></td>
        <td><TextField label={t.claims.ruleAliases} value={item.aliases.join(", ")} maxLength={500} disabled={readOnly} onChange={value => setRule(item.id, { aliases: value.split(",").map(alias => alias.trim()).filter(Boolean) })} /></td>
        <td><select aria-label={t.claims.ruleMetric} className={input} value={item.metric} disabled={readOnly} onChange={event => setRule(item.id, { metric: event.target.value as ClaimRule["metric"] })}>{CLAIM_METRICS.map(metric => <option key={metric} value={metric}>{t.claims.metrics[metric]}</option>)}</select></td>
        <td><select aria-label={t.claims.ruleOperator} className={input} value={item.operator} disabled={readOnly || ["vegan", "halal", "manual"].includes(item.metric)} onChange={event => setRule(item.id, { operator: event.target.value as ClaimRule["operator"] })}><option value=">=">≥</option><option value="<=">≤</option></select></td>
        <td><NumberField label={t.claims.ruleValue} value={item.value} disabled={readOnly || ["vegan", "halal", "manual"].includes(item.metric)} onChange={value => setRule(item.id, { value })} /></td>
        {!readOnly && <td><button type="button" aria-label={t.removeRow} onClick={() => setDraft({ ...draft, claims: draft.claims.filter(other => other.id !== item.id) })} className="p-1 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></td>}
      </tr>)}</tbody></table></div>
      {isAdmin && <div className="flex flex-wrap gap-2">
        <SmallButton disabled={busy} onClick={() => setDraft({ ...draft, claims: [...draft.claims, { id: newId(), label: "", aliases: [], metric: "manual", operator: ">=", value: null }] })}><Plus className="h-3.5 w-3.5" /> {t.claims.addRule}</SmallButton>
        <button type="button" disabled={busy || !draft.market.trim()} onClick={() => void save(draft)} className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{t.claims.saveSettings}</button>
        <SmallButton disabled={busy} onClick={addMarket}><Plus className="h-3.5 w-3.5" /> {t.claims.addMarket}</SmallButton>
      </div>}
      <p role="status" className="text-xs text-indigo-800">{message}</p>
    </div>
  </details>;
}
