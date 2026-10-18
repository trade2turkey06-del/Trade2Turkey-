// Ürün Reçetesi (A.B.8): veri modeli ve saf hesaplamalar. Firestore: projects/{projectId}/productSpecs/{id}.
// Her versiyon ayrı belgedir; aynı ürün + üretici zinciri lineageId ile bağlanır. Onaylı versiyon kurallarla kilitlidir.
export type SpecStatus = "draft" | "review" | "approved";
export type RatioSource = "manufacturer" | "estimated";
export interface FormulationRow { id: string; name: string; ratio: number | null; function: string; supplier: string; allergen: boolean; allergenName: string; halal: boolean; vegan: boolean; ratioSource: RatioSource; note: string }
export const NUTRIENTS = ["energyKj", "energyKcal", "fat", "saturatedFat", "carbohydrate", "sugar", "fiber", "protein", "salt"] as const;
export type NutrientKey = typeof NUTRIENTS[number];
export interface NutrientValue { target: number | null; actual: number | null; tolerance: number | null }
// Varsayılan satırlar dilden bağımsız bir anahtarla saklanır (name boş kalır, ekranda çevrilir); kullanıcı adı girerse o gösterilir.
export type PhysicalKey = "unitWeight" | "diameter" | "thickness" | "color" | "moisture";
export interface PhysicalRow { id: string; key?: PhysicalKey; name: string; target: string; unit: string; tolerance: string }
export interface MicroRow { id: string; parameter: string; limit: string; unit: string; method: string }
export interface ProcessRow { id: string; step: string; parameter: string; control: string }
export const PACKAGING_LEVELS = ["primary", "secondary", "pallet", "label"] as const;
export type PackagingLevel = typeof PACKAGING_LEVELS[number];
// quantity adet ambalaj, perUnits ürün birimi içindir (ör. 1 koli / 12 paket).
export interface PackagingRow { id: string; level: PackagingLevel; material: string; size: string; quantity: number | null; perUnits: number | null }
export interface OpenItem { id: string; question: string; owner: string; status: "open" | "resolved" }
export interface Approval { name: string; date: string }
export interface ProductSpec {
  id: string; projectId: string; lineageId: string; manufacturerId: string; manufacturerName: string;
  version: string; previousVersionId: string; status: SpecStatus;
  general: { productName: string; variant: string; markets: string; claimMarket: string; preparedBy: string; date: string };
  formulation: FormulationRow[];
  nutrition: Record<NutrientKey, NutrientValue>;
  physical: PhysicalRow[];
  micro: MicroRow[];
  allergens: { mayContain: string };
  process: ProcessRow[];
  packaging: PackagingRow[];
  storage: { frozen: string; ambient: string; shelfLife: string; labelLanguage: string; mandatoryInfo: string };
  openItems: OpenItem[];
  goldenSample: { code: string; location: "" | "trade2turkey" | "manufacturer"; date: string };
  approval: { trade2turkey: Approval; manufacturer: Approval; signedDocName: string; signedDocUrl: string };
  createdBy: string; createdAt?: any; updatedAt?: any; approvedAt?: any; approvedBy?: string;
}

export const UNIT_WEIGHT_ROW = "unit-weight";
export const newId = () => globalThis.crypto.randomUUID();
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

export const emptyFormulationRow = (): FormulationRow => ({ id: newId(), name: "", ratio: null, function: "", supplier: "", allergen: false, allergenName: "", halal: false, vegan: false, ratioSource: "manufacturer", note: "" });
export const emptyNutrition = (): Record<NutrientKey, NutrientValue> => Object.fromEntries(NUTRIENTS.map(key => [key, { target: null, actual: null, tolerance: null }])) as Record<NutrientKey, NutrientValue>;

export function createSpec(input: { projectId: string; manufacturerId: string; manufacturerName: string; productName: string; preparedBy: string; createdBy: string }): ProductSpec {
  return {
    id: newId(), projectId: input.projectId, lineageId: newId(), manufacturerId: input.manufacturerId, manufacturerName: input.manufacturerName,
    version: "v1.0", previousVersionId: "", status: "draft",
    general: { productName: input.productName, variant: "", markets: "", claimMarket: "EU", preparedBy: input.preparedBy, date: today() },
    formulation: [],
    nutrition: emptyNutrition(),
    physical: [
      { id: UNIT_WEIGHT_ROW, key: "unitWeight", name: "", target: "", unit: "g", tolerance: "" },
      { id: newId(), key: "diameter", name: "", target: "", unit: "mm", tolerance: "" },
      { id: newId(), key: "thickness", name: "", target: "", unit: "mm", tolerance: "" },
      { id: newId(), key: "color", name: "", target: "", unit: "", tolerance: "" },
      { id: newId(), key: "moisture", name: "", target: "", unit: "%", tolerance: "" },
    ],
    micro: [], allergens: { mayContain: "" }, process: [],
    packaging: PACKAGING_LEVELS.map(level => ({ id: newId(), level, material: "", size: "", quantity: null, perUnits: null })),
    storage: { frozen: "", ambient: "", shelfLife: "", labelLanguage: "", mandatoryInfo: "" },
    openItems: [],
    goldenSample: { code: "", location: "", date: "" },
    approval: { trade2turkey: { name: "", date: "" }, manufacturer: { name: "", date: "" }, signedDocName: "", signedDocUrl: "" },
    createdBy: input.createdBy,
  };
}

export function nextVersion(version: string) {
  const match = /^v(\d+)\.(\d+)$/.exec(version);
  return match ? `v${match[1]}.${Number(match[2]) + 1}` : "v1.1";
}
// Onaylı versiyonun kopyası: içerik aynı, onaylar ve altın numune tarihi temizlenir.
export function newVersionFrom(spec: ProductSpec, createdBy: string): ProductSpec {
  const { createdAt: _c, updatedAt: _u, approvedAt: _a, approvedBy: _b, ...rest } = spec;
  return {
    ...structuredClone(rest), id: newId(), version: nextVersion(spec.version), previousVersionId: spec.id, status: "draft", createdBy,
    general: { ...spec.general, date: today() },
    approval: { trade2turkey: { name: "", date: "" }, manufacturer: { name: "", date: "" }, signedDocName: "", signedDocUrl: "" },
  };
}
export const versionOrder = (version: string) => { const match = /^v(\d+)\.(\d+)$/.exec(version); return match ? Number(match[1]) * 10000 + Number(match[2]) : 0; };

export const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
export function formulationTotal(rows: FormulationRow[]) { return round(rows.reduce((sum, row) => sum + (row.ratio ?? 0), 0), 4); }
export const totalIsComplete = (total: number) => Math.abs(total - 100) < 0.005;

export function allergensFrom(rows: FormulationRow[]) {
  const names = new Map<string, string>();
  for (const row of rows) if (row.allergen) for (const name of (row.allergenName || row.name).split(/[,;]/)) {
    const clean = name.trim(); if (clean) names.set(clean.toLocaleLowerCase("tr-TR"), clean);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, "tr"));
}

// Türkçe ve İngilizce ondalık yazımlarını okur: "5,87" ve "5.87" → 5.87, "1.108,5" → 1108.5. Okunamazsa null.
export function parseDecimal(raw: string, thousandsDotAllowed = false): number | null {
  const token = raw.trim();
  if (!/^-?\d[\d.,]*$/.test(token)) return null;
  let normalized = token;
  if (token.includes(",") && token.includes(".")) normalized = token.lastIndexOf(",") > token.lastIndexOf(".") ? token.replace(/\./g, "").replace(",", ".") : token.replace(/,/g, "");
  else if (token.includes(",")) { if ((token.match(/,/g) || []).length > 1) return null; normalized = token.replace(",", "."); }
  else if ((token.match(/\./g) || []).length > 1 || (thousandsDotAllowed && /^\d{1,3}\.\d{3}$/.test(token))) { if (!/^\d{1,3}(\.\d{3})+$/.test(token)) return null; normalized = token.replace(/\./g, ""); }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
const NUMBER = String.raw`-?\d[\d.,]*`;
const PER_100 = String.raw`(?:\s*(?:/|per|başına)?\s*100\s*(?:g|gr|gram))?`;
// Besin öğesi metni: "5,87g", "32.00 g", "350 mg", "5,87 g / 100 g". Birim yoksa gram kabul edilir; başka birim okunamaz sayılır.
export function parseGrams(raw: string): number | null {
  const match = new RegExp(String.raw`^\s*(${NUMBER})\s*(mg|g|gr|gram)?${PER_100}\s*$`, "i").exec(raw || "");
  if (!match) return null;
  const value = parseDecimal(match[1]);
  if (value === null || value < 0) return null;
  return match[2]?.toLowerCase() === "mg" ? round(value / 1000, 4) : value;
}
// Enerji metni: "1108 kJ / 263 kcal", "1.108 kJ", "263 kcal". Her birim ayrı okunur.
export function parseEnergy(raw: string): { kj: number | null; kcal: number | null } {
  const read = (unit: string) => {
    const matches = [...(raw || "").matchAll(new RegExp(String.raw`(${NUMBER})\s*${unit}\b`, "gi"))];
    if (matches.length !== 1) return null;
    const value = parseDecimal(matches[0][1], true);
    return value !== null && value >= 0 ? value : null;
  };
  return { kj: read("kj"), kcal: read("kcal") };
}

export interface VaultNutrition { energy?: string; fat?: string; fatSaturated?: string; carbohydrates?: string; sugar?: string; protein?: string; fiber?: string; salt?: string }
export interface VaultIssue { key: NutrientKey; raw: string; kind: "unreadable" | "missing" }
// Kasa metinlerini sayıya çevirir. Okunamayan değer 0 olmaz: sonuçta yer almaz ve issues listesine girer.
export function parseVaultNutrition(source: VaultNutrition | undefined) {
  const values: Partial<Record<NutrientKey, number>> = {}, issues: VaultIssue[] = [];
  const fields: [NutrientKey, keyof VaultNutrition][] = [["fat", "fat"], ["saturatedFat", "fatSaturated"], ["carbohydrate", "carbohydrates"], ["sugar", "sugar"], ["fiber", "fiber"], ["protein", "protein"], ["salt", "salt"]];
  const energyRaw = (source?.energy || "").trim();
  if (!energyRaw) issues.push({ key: "energyKj", raw: "", kind: "missing" }, { key: "energyKcal", raw: "", kind: "missing" });
  else {
    const energy = parseEnergy(energyRaw);
    if (energy.kj !== null) values.energyKj = energy.kj; else issues.push({ key: "energyKj", raw: energyRaw, kind: "unreadable" });
    if (energy.kcal !== null) values.energyKcal = energy.kcal; else issues.push({ key: "energyKcal", raw: energyRaw, kind: "unreadable" });
  }
  for (const [key, field] of fields) {
    const raw = (source?.[field] || "").trim();
    if (!raw) { issues.push({ key, raw: "", kind: "missing" }); continue; }
    const value = parseGrams(raw);
    if (value === null) issues.push({ key, raw, kind: "unreadable" }); else values[key] = value;
  }
  return { values, issues };
}
export function applyVaultNutrition(nutrition: Record<NutrientKey, NutrientValue>, values: Partial<Record<NutrientKey, number>>) {
  return Object.fromEntries(NUTRIENTS.map(key => [key, { ...nutrition[key], actual: values[key] ?? nutrition[key].actual }])) as Record<NutrientKey, NutrientValue>;
}
export function nutritionDiff(nutrition: Record<NutrientKey, NutrientValue>, values: Partial<Record<NutrientKey, number>>) {
  return NUTRIENTS.filter(key => values[key] !== undefined && nutrition[key].actual !== values[key]).map(key => ({ key, vault: values[key]!, spec: nutrition[key].actual }));
}
// Gerçekleşen hedefin ±tolerans% aralığında mı? Değer eksikse null.
export function withinTolerance(value: NutrientValue) {
  if (value.target === null || value.actual === null || value.tolerance === null) return null;
  return Math.abs(value.actual - value.target) <= Math.abs(value.target) * value.tolerance / 100 + 1e-9;
}
// İddia hesaplarında gerçekleşen değer, yoksa hedef kullanılır.
export const effective = (value: NutrientValue) => value.actual ?? value.target;
export function proteinEnergyPct(nutrition: Record<NutrientKey, NutrientValue>) {
  const protein = effective(nutrition.protein), kcal = effective(nutrition.energyKcal);
  return protein === null || kcal === null || kcal <= 0 ? null : round(protein * 4 / kcal * 100, 1);
}

// ---- Pazar bazlı eşikler (Firestore: claimThresholds/{marketId}); koddaki değerler yalnızca örnek varsayılandır. ----
export const LEVEL_NUTRIENTS = ["fat", "saturatedFat", "sugar", "salt"] as const;
export type LevelNutrient = typeof LEVEL_NUTRIENTS[number];
export const CLAIM_METRICS = ["proteinEnergyPct", "protein", "fat", "saturatedFat", "sugar", "salt", "fiber", "energyKcal", "vegan", "halal", "manual"] as const;
export type ClaimMetric = typeof CLAIM_METRICS[number];
export interface ClaimRule { id: string; label: string; aliases: string[]; metric: ClaimMetric; operator: ">=" | "<="; value: number | null }
export interface MarketThresholds { id: string; market: string; levels: Record<LevelNutrient, { low: number | null; high: number | null }>; claims: ClaimRule[]; updatedAt?: any; updatedBy?: string }

const rule = (id: string, label: string, aliases: string[], metric: ClaimMetric, operator: ">=" | "<=" = ">=", value: number | null = null): ClaimRule => ({ id, label, aliases, metric, operator, value });
// UK FSA trafik ışığı (100 g, katı gıda) ve AB 1924/2006 besin iddiası koşulları; örnek değerlerdir.
const trafficLight = (): MarketThresholds["levels"] => ({ fat: { low: 3, high: 17.5 }, saturatedFat: { low: 1.5, high: 5 }, sugar: { low: 5, high: 22.5 }, salt: { low: 0.3, high: 1.5 } });
const nutritionClaims = (): ClaimRule[] => [
  rule("high-protein", "Yüksek Protein", ["high protein", "protein açısından zengin", "yüksek proteinli"], "proteinEnergyPct", ">=", 20),
  rule("source-protein", "Protein Kaynağı", ["source of protein", "protein içerir"], "proteinEnergyPct", ">=", 12),
  rule("low-fat", "Düşük Yağ", ["low fat", "az yağlı", "düşük yağlı"], "fat", "<=", 3),
  rule("low-sugar", "Düşük Şeker", ["low sugar", "az şekerli", "düşük şekerli"], "sugar", "<=", 5),
  rule("low-salt", "Düşük Tuz", ["low salt", "az tuzlu", "düşük tuzlu"], "salt", "<=", 0.3),
  rule("source-fibre", "Lif Kaynağı", ["source of fibre", "source of fiber"], "fiber", ">=", 3),
  rule("high-fibre", "Yüksek Lif", ["high fibre", "high fiber", "lif açısından zengin"], "fiber", ">=", 6),
  rule("vegan", "Vegan", ["vegan sertifikalı", "bitkisel"], "vegan"),
  rule("halal", "Helal", ["halal", "helal sertifikalı"], "halal"),
  rule("no-additives", "Katkısız", ["no additives", "katkı maddesi içermez"], "manual"),
];
export const DEFAULT_THRESHOLDS: MarketThresholds[] = [
  { id: "EU", market: "Avrupa Birliği", levels: trafficLight(), claims: nutritionClaims() },
  { id: "UK", market: "Birleşik Krallık", levels: trafficLight(), claims: nutritionClaims() },
];

export type Level = "low" | "medium" | "high" | "unknown";
export function level(value: number | null, limits: { low: number | null; high: number | null } | undefined): Level {
  if (value === null || !limits) return "unknown";
  if (limits.high !== null && value > limits.high) return "high";
  if (limits.low !== null && value <= limits.low) return "low";
  return "medium";
}
const normalize = (text: string) => text.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
export function findRule(claim: string, thresholds: MarketThresholds | undefined) {
  const key = normalize(claim);
  return thresholds?.claims.find(item => [item.label, ...item.aliases].some(name => normalize(name) === key));
}
export type ClaimStatus = "ok" | "check" | "fail";
export type ClaimReason = { code: "noRule" | "noValue" | "manual" | "noFormulation" | "formulationOk" } | { code: "formulationFail"; names: string[] } | { code: "compare"; value: number; operator: string; threshold: number };
export function metricValue(metric: ClaimMetric, nutrition: Record<NutrientKey, NutrientValue>) {
  if (metric === "proteinEnergyPct") return proteinEnergyPct(nutrition);
  if (metric === "vegan" || metric === "halal" || metric === "manual") return null;
  return effective(nutrition[metric]);
}
export function claimStatus(claim: string, spec: Pick<ProductSpec, "nutrition" | "formulation">, thresholds: MarketThresholds | undefined): { status: ClaimStatus; reason: ClaimReason } {
  const found = findRule(claim, thresholds);
  if (!found) return { status: "check", reason: { code: "noRule" } };
  if (found.metric === "manual") return { status: "check", reason: { code: "manual" } };
  if (found.metric === "vegan" || found.metric === "halal") {
    const rows = spec.formulation.filter(row => row.name.trim());
    if (!rows.length) return { status: "check", reason: { code: "noFormulation" } };
    const failing = rows.filter(row => !row[found.metric as "vegan" | "halal"]).map(row => row.name.trim());
    return failing.length ? { status: "fail", reason: { code: "formulationFail", names: failing } } : { status: "ok", reason: { code: "formulationOk" } };
  }
  const value = metricValue(found.metric, spec.nutrition);
  if (value === null || found.value === null) return { status: "check", reason: { code: "noValue" } };
  const ok = found.operator === ">=" ? value >= found.value : value <= found.value;
  return { status: ok ? "ok" : "fail", reason: { code: "compare", value, operator: found.operator, threshold: found.value } };
}

// ---- Kasa paketleme konfigürasyonundan tek yönlü ön doldurma ----
export interface VaultPackaging { productVariant?: string; singleWeight?: number; packagingStyle?: string; innerBoxCount?: number; masterCartonCount?: number; palletCartonCount?: number; cartonDimensions?: string }
const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
// Kasadaki "Tekli Ürün Ağırlığı" kg cinsindendir (kasa ekranı "… kg" gösterir); reçetede birim gramaj g olarak tutulur.
// Koli/palet malzeme adları kullanıcının düzenleyebildiği metindir; ön doldurma anındaki dilde yazılır.
export interface MaterialNames { carton: string; pallet: string }
const DEFAULT_MATERIALS: MaterialNames = { carton: "Koli", pallet: "Palet" };
export function packagingFromVault(config: VaultPackaging | undefined, names: MaterialNames = DEFAULT_MATERIALS) {
  if (!config) return null;
  const perCarton = positive(config.masterCartonCount), cartonsPerPallet = positive(config.palletCartonCount), weightKg = positive(config.singleWeight);
  const weight = weightKg === null ? null : round(weightKg * 1000, 3);
  const values: Record<PackagingLevel, Partial<PackagingRow>> = {
    primary: { material: config.packagingStyle?.trim() || "", size: weight ? `${weight} g` : "", quantity: 1, perUnits: 1 },
    secondary: { material: names.carton, size: config.cartonDimensions?.trim() || "", quantity: perCarton ? 1 : null, perUnits: perCarton },
    pallet: { material: names.pallet, size: "", quantity: perCarton && cartonsPerPallet ? 1 : null, perUnits: perCarton && cartonsPerPallet ? perCarton * cartonsPerPallet : null },
    label: {},
  };
  return { values, unitWeight: weight };
}
export function applyVaultPackaging(spec: ProductSpec, config: VaultPackaging | undefined, names?: MaterialNames): ProductSpec {
  const vault = packagingFromVault(config, names);
  if (!vault) return spec;
  const packaging = PACKAGING_LEVELS.map(level => {
    const current = spec.packaging.find(row => row.level === level) ?? { id: newId(), level, material: "", size: "", quantity: null, perUnits: null };
    const patch = Object.fromEntries(Object.entries(vault.values[level]).filter(([, value]) => value !== "" && value !== null));
    return { ...current, ...patch };
  });
  const extra = spec.packaging.filter(row => !PACKAGING_LEVELS.includes(row.level) || spec.packaging.filter(item => item.level === row.level).indexOf(row) > 0);
  const physical = vault.unitWeight === null ? spec.physical : spec.physical.map(row => row.id === UNIT_WEIGHT_ROW ? { ...row, target: String(vault.unitWeight) } : row);
  return { ...spec, packaging: [...packaging, ...extra], physical };
}
export function packagingDiff(spec: ProductSpec, config: VaultPackaging | undefined, names?: MaterialNames) {
  const vault = packagingFromVault(config, names);
  if (!vault) return [];
  const diffs: { level: PackagingLevel; field: string; vault: string; spec: string }[] = [];
  for (const level of PACKAGING_LEVELS) {
    const row = spec.packaging.find(item => item.level === level);
    for (const [field, value] of Object.entries(vault.values[level])) {
      if (value === "" || value === null) continue;
      const current = row?.[field as keyof PackagingRow] ?? "";
      if (String(current) !== String(value)) diffs.push({ level, field, vault: String(value), spec: String(current) });
    }
  }
  const weight = spec.physical.find(row => row.id === UNIT_WEIGHT_ROW)?.target ?? "";
  if (vault.unitWeight !== null && parseDecimal(weight) !== vault.unitWeight) diffs.push({ level: "primary", field: "unitWeight", vault: String(vault.unitWeight), spec: weight });
  return diffs;
}

// ---- A.B.9 maliyet satırları: fiyat alanları bilinçli olarak boş gelir; maliyet editörü sonradan doldurur. ----
export interface RecipeCostLine {
  id: string; source: "formulation" | "packaging"; sourceRowId: string; packagingLevel: PackagingLevel | "";
  materialName: string; quantityPerUnit: number | null; unit: "kg" | "pcs"; // birim kodu dilden bağımsızdır, ekranda çevrilir
  unitPrice: number | null; currency: string; fxRate: number | null; wastePct: number | null; priceSource: string; priceDate: string;
}
export interface RecipeCostSource { specId: string; lineageId: string; version: string; productName: string; manufacturerId: string; manufacturerName: string; unitWeightG: number | null; importedAt: string }
export const unitWeightOf = (spec: ProductSpec) => { const value = parseDecimal(spec.physical.find(row => row.id === UNIT_WEIGHT_ROW)?.target ?? ""); return value !== null && value > 0 ? value : null; };
export function costLinesFromSpec(spec: ProductSpec): { lines: RecipeCostLine[]; source: RecipeCostSource } {
  const weight = unitWeightOf(spec);
  const blank = { unitPrice: null, currency: "", fxRate: null, wastePct: null, priceSource: "", priceDate: "" };
  const formulation = spec.formulation.filter(row => row.name.trim()).map(row => ({
    id: newId(), source: "formulation" as const, sourceRowId: row.id, packagingLevel: "" as const, materialName: row.name.trim(),
    // Birim başına kg = oran% × birim gramaj (g) / 1000
    quantityPerUnit: row.ratio === null || weight === null ? null : round(row.ratio / 100 * weight / 1000, 6), unit: "kg" as const, ...blank,
  }));
  const packaging = spec.packaging.filter(row => row.material.trim()).map(row => ({
    id: newId(), source: "packaging" as const, sourceRowId: row.id, packagingLevel: row.level, materialName: row.material.trim(),
    quantityPerUnit: row.quantity === null ? null : round(row.quantity / (row.perUnits && row.perUnits > 0 ? row.perUnits : 1), 6), unit: "pcs" as const, ...blank,
  }));
  return {
    lines: [...formulation, ...packaging],
    source: { specId: spec.id, lineageId: spec.lineageId, version: spec.version, productName: spec.general.productName, manufacturerId: spec.manufacturerId, manufacturerName: spec.manufacturerName, unitWeightG: weight, importedAt: new Date().toISOString() },
  };
}

// Onay için zorunlu alanlar: ürün adı, iki onay (isim + tarih), varsa HTTPS belge bağlantısı (firestore.rules ile aynı) ve
// formülasyon varsa %100 toplam (yalnızca arayüzde; taslak kaydı engellenmez).
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
export function approvalErrors(spec: ProductSpec) {
  const errors: ("productName" | "formulationTotal" | "t2t" | "manufacturer" | "signedDocUrl")[] = [];
  if (!spec.general.productName.trim()) errors.push("productName");
  if (spec.formulation.length && !totalIsComplete(formulationTotal(spec.formulation))) errors.push("formulationTotal");
  if (!spec.approval.trade2turkey.name.trim() || !isDate(spec.approval.trade2turkey.date)) errors.push("t2t");
  if (!spec.approval.manufacturer.name.trim() || !isDate(spec.approval.manufacturer.date)) errors.push("manufacturer");
  if (spec.approval.signedDocUrl && !/^https:\/\/\S+$/.test(spec.approval.signedDocUrl)) errors.push("signedDocUrl");
  return errors;
}

// A.B.8 kilidi: A.B.7'de seçilen üretici; A.B.7 bu bilgi olmadan onaylandıysa A.B.8'de yapılan yedek seçim.
export function requiredManufacturerId(ab7?: { highPotentialManufacturerId?: string; [key: string]: unknown }, ab8?: { specManufacturerId?: string; [key: string]: unknown }) {
  return ab7?.highPotentialManufacturerId || ab8?.specManufacturerId || "";
}
export function specLinkValid(spec: Pick<ProductSpec, "status" | "manufacturerId"> | undefined, manufacturerId: string) {
  return !!spec && !!manufacturerId && spec.status === "approved" && spec.manufacturerId === manufacturerId;
}
