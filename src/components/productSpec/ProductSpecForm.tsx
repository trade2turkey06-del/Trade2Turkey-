import { useState } from "react";
import { DatabaseZap } from "lucide-react";
import {
  allergensFrom, applyVaultNutrition, applyVaultPackaging, emptyFormulationRow, formulationTotal, newId, NUTRIENTS, nutritionDiff, packagingDiff,
  parseVaultNutrition, totalIsComplete, UNIT_WEIGHT_ROW, withinTolerance,
  type FormulationRow, type MicroRow, type NutrientKey, type OpenItem, type PackagingRow, type PhysicalRow, type ProcessRow, type ProductSpec, type VaultIssue, type VaultPackaging,
} from "../../domain/productSpec";
import type { VaultManufacturer } from "../../lib/productSpecStore";
import { useI18n } from "../../i18n";
import GoogleDriveFolder from "../GoogleDriveFolder";
import ClaimCheckSection, { type MarketOption } from "./ClaimCheckSection";
import { formatNumber, input, Labeled, Notice, NumberField, RowTable, Section, SmallButton, TextField } from "./fields";

interface Props { spec: ProductSpec; onChange: (spec: ProductSpec) => void; disabled: boolean; isAdmin: boolean; manufacturer?: VaultManufacturer; packagingConfig?: VaultPackaging; markets: MarketOption[] }

export default function ProductSpecForm({ spec, onChange, disabled, isAdmin, manufacturer, packagingConfig, markets }: Props) {
  const t = useI18n().t.productSpec;
  const [issues, setIssues] = useState<VaultIssue[] | null>(null);
  const physicalName = (row: PhysicalRow) => row.name || (row.key ? t.physical.defaults[row.key] : "");
  const set = <K extends keyof ProductSpec>(key: K, value: ProductSpec[K]) => onChange({ ...spec, [key]: value });
  const general = (patch: Partial<ProductSpec["general"]>) => set("general", { ...spec.general, ...patch });
  const total = formulationTotal(spec.formulation);
  const vaultNutrition = manufacturer?.vaultDetails?.nutritionalValues;
  const parsed = parseVaultNutrition(vaultNutrition);
  const hasVaultNutrition = !!vaultNutrition && Object.values(vaultNutrition).some(value => String(value || "").trim());
  const nutritionDiffs = hasVaultNutrition ? nutritionDiff(spec.nutrition, parsed.values) : [];
  const packagingDiffs = packagingDiff(spec, packagingConfig, t.packaging.defaultMaterials);
  const setNutrient = (key: NutrientKey, patch: Partial<ProductSpec["nutrition"][NutrientKey]>) => set("nutrition", { ...spec.nutrition, [key]: { ...spec.nutrition[key], ...patch } });
  const fillNutrition = () => { set("nutrition", applyVaultNutrition(spec.nutrition, parsed.values)); setIssues(parsed.issues); };
  const fillStorage = () => { const vault = manufacturer?.vaultDetails?.storageShelfLife; set("storage", { ...spec.storage, frozen: vault?.frozenProducts?.trim() || spec.storage.frozen, ambient: vault?.ambientProducts?.trim() || spec.storage.ambient }); };
  const allergens = allergensFrom(spec.formulation);
  const check = (value: boolean, update: (value: boolean) => void, label: string) => <input type="checkbox" aria-label={label} checked={value} disabled={disabled} onChange={event => update(event.target.checked)} className="h-4 w-4" />;

  return <div className="space-y-4">
    <Section title={t.general.heading}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Labeled label={t.general.productName}><TextField label={t.general.productName} value={spec.general.productName} disabled={disabled} onChange={value => general({ productName: value })} /></Labeled>
        <Labeled label={t.general.variant}><TextField label={t.general.variant} value={spec.general.variant} disabled={disabled} onChange={value => general({ variant: value })} /></Labeled>
        <Labeled label={t.general.version}><p className="py-1.5 font-mono text-sm">{spec.version}</p></Labeled>
        <Labeled label={t.general.markets}><TextField label={t.general.markets} value={spec.general.markets} placeholder={t.general.marketsHint} maxLength={500} disabled={disabled} onChange={value => general({ markets: value })} /></Labeled>
        <Labeled label={t.general.preparedBy}><TextField label={t.general.preparedBy} value={spec.general.preparedBy} disabled={disabled} onChange={value => general({ preparedBy: value })} /></Labeled>
        <Labeled label={t.general.date}><TextField type="date" label={t.general.date} value={spec.general.date} disabled={disabled} onChange={value => general({ date: value })} /></Labeled>
        <Labeled label={t.general.manufacturer}><p className="py-1.5 text-sm">{spec.manufacturerName}</p></Labeled>
      </div>
    </Section>

    <Section title={t.formulation.heading}>
      <RowTable<FormulationRow> rows={spec.formulation} onChange={rows => set("formulation", rows)} create={emptyFormulationRow} disabled={disabled} empty={t.formulation.empty} columns={[
        { label: t.formulation.name, className: "min-w-40", render: (row, update) => <TextField label={t.formulation.name} value={row.name} disabled={disabled} onChange={name => update({ name })} /> },
        { label: t.formulation.ratio, className: "w-24", render: (row, update) => <NumberField label={t.formulation.ratio} value={row.ratio} disabled={disabled} onChange={ratio => update({ ratio })} /> },
        { label: t.formulation.function, className: "min-w-32", render: (row, update) => <TextField label={t.formulation.function} value={row.function} disabled={disabled} onChange={value => update({ function: value })} /> },
        { label: t.formulation.supplier, className: "min-w-32", render: (row, update) => <TextField label={t.formulation.supplier} value={row.supplier} disabled={disabled} onChange={supplier => update({ supplier })} /> },
        { label: t.formulation.allergen, className: "min-w-36", render: (row, update) => <div className="flex items-center gap-2">{check(row.allergen, allergen => update({ allergen }), t.formulation.allergen)}{row.allergen ? <TextField label={t.formulation.allergenName} placeholder={t.formulation.allergenName} value={row.allergenName} disabled={disabled} onChange={allergenName => update({ allergenName })} /> : <span className="text-xs text-slate-400">{t.no}</span>}</div> },
        { label: t.formulation.halal, className: "w-16 text-center", render: (row, update) => check(row.halal, halal => update({ halal }), t.formulation.halal) },
        { label: t.formulation.vegan, className: "w-16 text-center", render: (row, update) => check(row.vegan, vegan => update({ vegan }), t.formulation.vegan) },
        { label: t.formulation.ratioSource, className: "min-w-40", render: (row, update) => <select aria-label={t.formulation.ratioSource} className={input} value={row.ratioSource} disabled={disabled} onChange={event => update({ ratioSource: event.target.value as FormulationRow["ratioSource"] })}>{Object.entries(t.formulation.sources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> },
        { label: t.formulation.note, className: "min-w-32", render: (row, update) => <TextField label={t.formulation.note} value={row.note} maxLength={500} disabled={disabled} onChange={note => update({ note })} /> },
      ]} footer={<tfoot><tr><td className="font-semibold">{t.formulation.total}</td><td className={`font-semibold ${totalIsComplete(total) ? "text-emerald-700" : "text-red-700"}`} data-testid="formulation-total">%{formatNumber(total, 2)}</td><td colSpan={8} /></tr></tfoot>} />
      {spec.formulation.length > 0 && !totalIsComplete(total) && <Notice>{t.formulation.totalWarning(formatNumber(total, 2))}</Notice>}
    </Section>

    <Section title={t.nutrition.heading} actions={!disabled && <SmallButton title={t.nutrition.fromVaultHelp} disabled={!hasVaultNutrition} onClick={fillNutrition}><DatabaseZap className="h-3.5 w-3.5" /> {t.nutrition.fromVault}</SmallButton>}>
      {!hasVaultNutrition && !disabled && <Notice tone="slate">{t.nutrition.noVault}</Notice>}
      {issues && issues.length > 0 && <Notice><ul className="list-disc space-y-0.5 pl-4">{issues.map(issue => <li key={issue.key}>{issue.kind === "unreadable" ? t.nutrition.unreadable(t.nutrition.labels[issue.key], issue.raw) : t.nutrition.missingInVault(t.nutrition.labels[issue.key])}</li>)}</ul></Notice>}
      <div className="spec-scroll overflow-x-auto"><table><thead><tr><th>{t.nutrition.nutrient}</th><th>{t.nutrition.target}</th><th>{t.nutrition.actual}</th><th>{t.nutrition.tolerance}</th><th>{t.nutrition.check}</th></tr></thead><tbody>
        {NUTRIENTS.map(key => { const value = spec.nutrition[key], ok = withinTolerance(value); return <tr key={key}>
          <td className="whitespace-nowrap">{t.nutrition.labels[key]}</td>
          <td><NumberField label={`${t.nutrition.labels[key]} ${t.nutrition.target}`} value={value.target} disabled={disabled} onChange={target => setNutrient(key, { target })} /></td>
          <td><NumberField label={`${t.nutrition.labels[key]} ${t.nutrition.actual}`} value={value.actual} disabled={disabled} onChange={actual => setNutrient(key, { actual })} /></td>
          <td><NumberField label={`${t.nutrition.labels[key]} ${t.nutrition.tolerance}`} value={value.tolerance} disabled={disabled} onChange={tolerance => setNutrient(key, { tolerance })} /></td>
          <td className="text-xs">{ok === null ? t.none : ok ? <span className="text-emerald-700">{t.nutrition.within}</span> : <span className="font-semibold text-red-700">{t.nutrition.outside}</span>}</td>
        </tr>; })}
      </tbody></table></div>
      {nutritionDiffs.length > 0 && <Notice tone="slate"><p className="font-semibold">{t.nutrition.diffHeading}</p><ul className="mt-1 list-disc pl-4">{nutritionDiffs.map(item => <li key={item.key}>{t.nutrition.diff(t.nutrition.labels[item.key], formatNumber(item.vault), item.spec === null ? t.none : formatNumber(item.spec))}</li>)}</ul></Notice>}
    </Section>

    <ClaimCheckSection spec={spec} onChange={onChange} disabled={disabled} isAdmin={isAdmin} claims={manufacturer?.vaultDetails?.productClaims ?? []} markets={markets} />

    <Section title={t.physical.heading}>
      <RowTable<PhysicalRow> rows={spec.physical} onChange={rows => set("physical", rows.some(row => row.id === UNIT_WEIGHT_ROW) ? rows : [spec.physical.find(row => row.id === UNIT_WEIGHT_ROW)!, ...rows].filter(Boolean))} disabled={disabled} create={() => ({ id: newId(), name: "", target: "", unit: "", tolerance: "" })} columns={[
        { label: t.physical.name, render: (row, update) => row.id === UNIT_WEIGHT_ROW ? <span className="font-medium">{physicalName(row)}</span> : disabled ? <span>{physicalName(row)}</span> : <TextField label={t.physical.name} value={row.name} placeholder={row.key ? t.physical.defaults[row.key] : undefined} disabled={disabled} onChange={name => update({ name })} /> },
        { label: t.physical.target, render: (row, update) => <TextField label={`${physicalName(row)} ${t.physical.target}`} value={row.target} disabled={disabled} onChange={target => update({ target })} /> },
        { label: t.physical.unit, className: "w-24", render: (row, update) => row.id === UNIT_WEIGHT_ROW ? <span>g</span> : <TextField label={`${physicalName(row)} ${t.physical.unit}`} value={row.unit} maxLength={30} disabled={disabled} onChange={unit => update({ unit })} /> },
        { label: t.physical.tolerance, render: (row, update) => <TextField label={`${physicalName(row)} ${t.physical.tolerance}`} value={row.tolerance} disabled={disabled} onChange={tolerance => update({ tolerance })} /> },
      ]} />
      <p className="text-[11px] text-slate-500">{t.physical.unitWeightHint}</p>
    </Section>

    <Section title={t.micro.heading}>
      <RowTable<MicroRow> rows={spec.micro} onChange={rows => set("micro", rows)} disabled={disabled} create={() => ({ id: newId(), parameter: "", limit: "", unit: "", method: "" })} columns={[
        { label: t.micro.parameter, render: (row, update) => <TextField label={t.micro.parameter} value={row.parameter} disabled={disabled} onChange={parameter => update({ parameter })} /> },
        { label: t.micro.limit, render: (row, update) => <TextField label={t.micro.limit} value={row.limit} disabled={disabled} onChange={limit => update({ limit })} /> },
        { label: t.micro.unit, className: "w-28", render: (row, update) => <TextField label={t.micro.unit} value={row.unit} maxLength={30} disabled={disabled} onChange={unit => update({ unit })} /> },
        { label: t.micro.method, render: (row, update) => <TextField label={t.micro.method} value={row.method} disabled={disabled} onChange={method => update({ method })} /> },
      ]} />
    </Section>

    <Section title={t.allergens.heading}>
      <Labeled label={t.allergens.contains}><p className="py-1 text-sm font-medium">{allergens.length ? allergens.join(", ") : <span className="font-normal text-slate-400">{t.allergens.containsNone}</span>}</p></Labeled>
      <Labeled label={t.allergens.mayContain}><TextField label={t.allergens.mayContain} value={spec.allergens.mayContain} maxLength={500} disabled={disabled} onChange={mayContain => set("allergens", { mayContain })} /></Labeled>
    </Section>

    <Section title={t.process.heading}>
      <RowTable<ProcessRow> rows={spec.process} onChange={rows => set("process", rows)} disabled={disabled} create={() => ({ id: newId(), step: "", parameter: "", control: "" })} columns={[
        { label: t.process.step, render: (row, update) => <TextField label={t.process.step} value={row.step} disabled={disabled} onChange={step => update({ step })} /> },
        { label: t.process.parameter, render: (row, update) => <TextField label={t.process.parameter} value={row.parameter} disabled={disabled} onChange={parameter => update({ parameter })} /> },
        { label: t.process.control, render: (row, update) => <TextField label={t.process.control} value={row.control} disabled={disabled} onChange={control => update({ control })} /> },
      ]} />
    </Section>

    <Section title={t.packaging.heading} actions={!disabled && <SmallButton title={t.packaging.fromVaultHelp} disabled={!packagingConfig} onClick={() => onChange(applyVaultPackaging(spec, packagingConfig, t.packaging.defaultMaterials))}><DatabaseZap className="h-3.5 w-3.5" /> {t.packaging.fromVault}</SmallButton>}>
      {!packagingConfig && !disabled && <Notice tone="slate">{t.packaging.noVault}</Notice>}
      <RowTable<PackagingRow> rows={spec.packaging} onChange={rows => set("packaging", rows)} disabled={disabled} sortable={false} columns={[
        { label: t.packaging.level, className: "whitespace-nowrap", render: row => t.packaging.levels[row.level] },
        { label: t.packaging.material, render: (row, update) => <TextField label={`${t.packaging.levels[row.level]} ${t.packaging.material}`} value={row.material} disabled={disabled} onChange={material => update({ material })} /> },
        { label: t.packaging.size, render: (row, update) => <TextField label={`${t.packaging.levels[row.level]} ${t.packaging.size}`} value={row.size} disabled={disabled} onChange={size => update({ size })} /> },
        { label: t.packaging.quantity, className: "w-24", render: (row, update) => <NumberField label={`${t.packaging.levels[row.level]} ${t.packaging.quantity}`} value={row.quantity} disabled={disabled} onChange={quantity => update({ quantity })} /> },
        { label: t.packaging.perUnits, className: "w-28", render: (row, update) => <NumberField label={`${t.packaging.levels[row.level]} ${t.packaging.perUnits}`} value={row.perUnits} disabled={disabled} onChange={perUnits => update({ perUnits })} /> },
      ]} />
      <p className="text-[11px] text-slate-500">{t.packaging.perUnitsHelp}</p>
      {packagingDiffs.length > 0 && <Notice tone="slate"><p className="font-semibold">{t.packaging.diffHeading}</p><ul className="mt-1 list-disc pl-4">{packagingDiffs.map(item => <li key={`${item.level}-${item.field}`}>{t.packaging.diffItem(item.field === "unitWeight" ? t.packaging.unitWeight : `${t.packaging.levels[item.level]} · ${({ material: t.packaging.material, size: t.packaging.size, quantity: t.packaging.quantity, perUnits: t.packaging.perUnits } as Record<string, string>)[item.field]}`, item.vault, item.spec || t.none)}</li>)}</ul></Notice>}
    </Section>

    <Section title={t.storage.heading} actions={!disabled && <SmallButton disabled={!manufacturer?.vaultDetails?.storageShelfLife} onClick={fillStorage}><DatabaseZap className="h-3.5 w-3.5" /> {t.storage.fromVault}</SmallButton>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["frozen", "ambient", "shelfLife", "labelLanguage"] as const).map(key => <Labeled key={key} label={t.storage[key]}><TextField label={t.storage[key]} value={spec.storage[key]} maxLength={500} disabled={disabled} onChange={value => set("storage", { ...spec.storage, [key]: value })} /></Labeled>)}
      </div>
      <Labeled label={t.storage.mandatoryInfo}><textarea aria-label={t.storage.mandatoryInfo} className={input} rows={3} maxLength={3000} value={spec.storage.mandatoryInfo} disabled={disabled} onChange={event => set("storage", { ...spec.storage, mandatoryInfo: event.target.value })} /></Labeled>
    </Section>

    <Section title={t.openItems.heading}>
      <RowTable<OpenItem> rows={spec.openItems} onChange={rows => set("openItems", rows)} disabled={disabled} create={() => ({ id: newId(), question: "", owner: "", status: "open" })} columns={[
        { label: t.openItems.question, className: "min-w-60", render: (row, update) => <TextField label={t.openItems.question} placeholder={t.openItems.placeholder} value={row.question} maxLength={1000} disabled={disabled} onChange={question => update({ question })} /> },
        { label: t.openItems.owner, render: (row, update) => <TextField label={t.openItems.owner} value={row.owner} disabled={disabled} onChange={owner => update({ owner })} /> },
        { label: t.openItems.status, className: "w-32", render: (row, update) => <select aria-label={t.openItems.status} className={input} value={row.status} disabled={disabled} onChange={event => update({ status: event.target.value as OpenItem["status"] })}>{Object.entries(t.openItems.statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> },
      ]} />
    </Section>

    <Section title={t.approval.heading}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Labeled label={t.approval.goldenCode}><TextField label={t.approval.goldenCode} value={spec.goldenSample.code} maxLength={100} disabled={disabled} onChange={code => set("goldenSample", { ...spec.goldenSample, code })} /></Labeled>
        <Labeled label={t.approval.goldenLocation}><select className={input} value={spec.goldenSample.location} disabled={disabled} onChange={event => set("goldenSample", { ...spec.goldenSample, location: event.target.value as ProductSpec["goldenSample"]["location"] })}>{Object.entries(t.approval.goldenLocations).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Labeled>
        <Labeled label={t.approval.goldenDate}><TextField type="date" label={t.approval.goldenDate} value={spec.goldenSample.date} disabled={disabled} onChange={date => set("goldenSample", { ...spec.goldenSample, date })} /></Labeled>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["trade2turkey", "manufacturer"] as const).map(party => <fieldset key={party} className="rounded-lg border border-slate-200 p-3"><legend className="px-1 text-xs font-semibold text-slate-700">{party === "trade2turkey" ? t.approval.t2t : t.approval.manufacturer}</legend><div className="grid gap-3 sm:grid-cols-2">
          <Labeled label={t.approval.name}><TextField label={`${party} ${t.approval.name}`} value={spec.approval[party].name} maxLength={200} disabled={disabled} onChange={name => set("approval", { ...spec.approval, [party]: { ...spec.approval[party], name } })} /></Labeled>
          <Labeled label={t.approval.date}><TextField type="date" label={`${party} ${t.approval.date}`} value={spec.approval[party].date} disabled={disabled} onChange={date => set("approval", { ...spec.approval, [party]: { ...spec.approval[party], date } })} /></Labeled>
        </div></fieldset>)}
      </div>
      <fieldset className="rounded-lg border border-slate-200 p-3"><legend className="px-1 text-xs font-semibold text-slate-700">{t.approval.signedDoc}</legend>
        <p className="mb-3 text-[11px] text-slate-500">{t.approval.signedDocHelp}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label={t.approval.signedDocName}><TextField label={t.approval.signedDocName} value={spec.approval.signedDocName} maxLength={250} disabled={disabled} onChange={signedDocName => set("approval", { ...spec.approval, signedDocName })} /></Labeled>
          <Labeled label={t.approval.signedDocUrl}>{disabled && spec.approval.signedDocUrl ? <a className="block truncate py-1.5 text-sm text-teal-700 underline" href={spec.approval.signedDocUrl} target="_blank" rel="noreferrer">{spec.approval.signedDocUrl}</a> : <TextField type="url" label={t.approval.signedDocUrl} placeholder="https://drive.google.com/…" value={spec.approval.signedDocUrl} maxLength={2000} disabled={disabled} onChange={signedDocUrl => set("approval", { ...spec.approval, signedDocUrl })} />}</Labeled>
        </div>
        <details className="spec-no-print mt-3"><summary className="cursor-pointer text-xs font-semibold">{t.approval.upload}</summary><GoogleDriveFolder stepId={`spec-${spec.lineageId}`} storageLocation={`Ürün Reçetesi - ${spec.general.productName || spec.manufacturerName}`} currentProjectId={spec.projectId} clientMode={!isAdmin} /></details>
      </fieldset>
    </Section>
  </div>;
}
