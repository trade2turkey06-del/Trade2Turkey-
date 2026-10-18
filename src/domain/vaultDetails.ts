// Belge Kasası üretici detayları (projects/{p}/manufacturers/{id}.vaultDetails). Eski, elle girilmiş veya yarım kalmış
// kayıtlarda bölümler eksik olabilir; ekran bu yüzden ham veriyi değil, her zaman normalizeVaultDetails çıktısını okur.
export interface ProjectVaultDetails {
  pricingCapacity: { exwPriceList: string; moq: string; monthlyCapacity: string };
  productionTransit: { productionFirstOrder: string; productionRepeatOrder: string; shipmentTransitTime: string };
  storageShelfLife: { frozenProducts: string; ambientProducts: string };
  certifications: { coa: string; certificates: string[] };
  palletContainerConfig: { boxDimensions: string; palletConfig: string; containerCapacity40HC: string };
  nutritionalValues: { energy: string; fat: string; fatSaturated: string; carbohydrates: string; sugar: string; protein: string; fiber: string; salt: string };
  variations: string[];
  marketingSamples: string;
  exportMarkets: { name: string; flag: string }[];
  productClaims?: string[];
}

// Eksik alanlar ekranda bu metinle gösterilir.
export const NOT_SPECIFIED = "Belirtilmedi";

const SHAPE = {
  pricingCapacity: ["exwPriceList", "moq", "monthlyCapacity"],
  productionTransit: ["productionFirstOrder", "productionRepeatOrder", "shipmentTransitTime"],
  storageShelfLife: ["frozenProducts", "ambientProducts"],
  palletContainerConfig: ["boxDimensions", "palletConfig", "containerCapacity40HC"],
  nutritionalValues: ["energy", "fat", "fatSaturated", "carbohydrates", "sugar", "protein", "fiber", "salt"],
} as const;

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
// Sayılar metne çevrilir; null, nesne ve diğer türler boş metin olur.
const text = (value: unknown) => typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
const texts = (value: unknown) => Array.isArray(value) ? value.map(text).filter(item => item.trim() !== "") : [];
const section = <K extends string>(value: unknown, keys: readonly K[]) => { const source = record(value); return Object.fromEntries(keys.map(key => [key, text(source[key])])) as Record<K, string>; };

export function emptyVaultDetails(): ProjectVaultDetails { return normalizeVaultDetails({}); }

export function normalizeVaultDetails(raw: unknown): ProjectVaultDetails {
  const source = record(raw), certifications = record(source.certifications);
  return {
    pricingCapacity: section(source.pricingCapacity, SHAPE.pricingCapacity),
    productionTransit: section(source.productionTransit, SHAPE.productionTransit),
    storageShelfLife: section(source.storageShelfLife, SHAPE.storageShelfLife),
    certifications: { coa: text(certifications.coa), certificates: texts(certifications.certificates) },
    palletContainerConfig: section(source.palletContainerConfig, SHAPE.palletContainerConfig),
    nutritionalValues: section(source.nutritionalValues, SHAPE.nutritionalValues),
    variations: texts(source.variations),
    marketingSamples: text(source.marketingSamples),
    exportMarkets: Array.isArray(source.exportMarkets) ? source.exportMarkets.map(record).map(item => ({ name: text(item.name), flag: text(item.flag) })).filter(item => item.name.trim() !== "") : [],
    productClaims: texts(source.productClaims),
  };
}

// Ekranda gösterilecek değer: boş ya da yalnızca boşluk ise "Belirtilmedi".
export const shown = (value: string | undefined) => value && value.trim() ? value : NOT_SPECIFIED;
