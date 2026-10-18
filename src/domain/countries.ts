// Kasadaki "Hedef İhracat Pazarları" serbest metindir; bilinen ülke adlarını (Türkçe/İngilizce yazımlar, kısaltmalar)
// ISO 3166-1 alpha-2 koduna eşler. Ekranda ülke adı seçili dilde gösterilir (src/i18n */countries.ts); eşleşmeyen ad
// kullanıcı verisi olarak yazıldığı gibi kalır. Eşleştirme tam addır; "uk" gibi parçalar başka ülkeleri yakalamaz.
// Kuzey Kıbrıs'ın ISO kodu yoktur; uygulama içi "NCY" kodu kullanılır.
const ALIASES: Record<string, string[]> = {
  DE: ["almanya", "germany", "deutschland"], NL: ["hollanda", "netherlands", "the netherlands", "holland"], TR: ["türkiye", "turkiye", "turkey"],
  FR: ["fransa", "france"], GB: ["ingiltere", "birleşik krallık", "united kingdom", "uk", "england", "great britain", "britain"],
  US: ["abd", "amerika", "amerika birleşik devletleri", "usa", "us", "united states", "united states of america"],
  NCY: ["kktc", "kuzey kıbrıs", "kuzey kıbrıs türk cumhuriyeti", "northern cyprus", "trnc"], CY: ["kıbrıs", "güney kıbrıs", "cyprus"],
  GE: ["gürcistan", "georgia"], AZ: ["azerbaycan", "azerbaijan"], IQ: ["irak", "iraq"], BG: ["bulgaristan", "bulgaria"], KW: ["kuveyt", "kuwait"],
  IT: ["italya", "italy"], ES: ["ispanya", "spain"], UA: ["ukrayna", "ukraine"], SA: ["suudi arabistan", "saudi arabia", "ksa"],
  AE: ["bae", "birleşik arap emirlikleri", "uae", "united arab emirates"], QA: ["katar", "qatar"], BH: ["bahreyn", "bahrain"], OM: ["umman", "oman"],
  BE: ["belçika", "belgium"], AT: ["avusturya", "austria"], CH: ["isviçre", "switzerland"], PL: ["polonya", "poland"], RO: ["romanya", "romania"],
  GR: ["yunanistan", "greece"], SE: ["isveç", "sweden"], DK: ["danimarka", "denmark"], NO: ["norveç", "norway"], FI: ["finlandiya", "finland"],
  IE: ["irlanda", "ireland"], PT: ["portekiz", "portugal"], CZ: ["çekya", "çek cumhuriyeti", "czechia", "czech republic"], HU: ["macaristan", "hungary"],
  RS: ["sırbistan", "serbia"], MK: ["kuzey makedonya", "makedonya", "north macedonia", "macedonia"], AL: ["arnavutluk", "albania"],
  BA: ["bosna hersek", "bosna-hersek", "bosnia and herzegovina", "bosnia"], XK: ["kosova", "kosovo"], MD: ["moldova"], RU: ["rusya", "russia"],
  KZ: ["kazakistan", "kazakhstan"], UZ: ["özbekistan", "uzbekistan"], TM: ["türkmenistan", "turkmenistan"], IL: ["israil", "israel"],
  JO: ["ürdün", "jordan"], LB: ["lübnan", "lebanon"], EG: ["mısır", "egypt"], LY: ["libya"], DZ: ["cezayir", "algeria"], MA: ["fas", "morocco"],
  TN: ["tunus", "tunisia"], CA: ["kanada", "canada"], AU: ["avustralya", "australia"], JP: ["japonya", "japan"], CN: ["çin", "china"],
};
const normalize = (text: string) => text.toLocaleLowerCase("tr-TR").replace(/\./g, "").replace(/\s+/g, " ").trim();
const BY_NAME = new Map(Object.entries(ALIASES).flatMap(([code, names]) => names.map(name => [normalize(name), code] as [string, string])));
// İngilizce yazımlar (ör. "Italy") Türkçe küçük harf kuralıyla "ıtaly" olur; ikisini de dene.
export function countryCode(name: string): string | null {
  return BY_NAME.get(normalize(name)) ?? BY_NAME.get(name.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim()) ?? null;
}
export const COUNTRY_CODES = Object.keys(ALIASES);
// ISO kodundan bayrak emojisi; NCY için önceki davranış (🇨🇾) korunur, bilinmeyen ad için beyaz bayrak.
export function countryFlag(code: string | null | undefined) {
  if (code === "NCY") return "🇨🇾";
  if (!code || !/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map(char => 0x1f1e6 + char.charCodeAt(0) - 65));
}
export interface ExportMarket { name: string; flag: string; code?: string }
// Kayıt anında: yazılan ad korunur, tanınan ülkeye kod ve doğru bayrak eklenir.
export function marketFromName(name: string): ExportMarket {
  const code = countryCode(name);
  return code ? { name, flag: countryFlag(code), code } : { name, flag: countryFlag(null) };
}
// Gösterim: tanınan ülke seçili dildeki adla, tanınmayan yazıldığı gibi. Eski kayıtlarda kod yoksa addan bulunur.
export function marketLabel(market: ExportMarket, names: Record<string, string>) {
  const code = market.code ?? countryCode(market.name);
  return { code, label: code && names[code] ? names[code] : market.name, flag: code ? countryFlag(code) : market.flag || countryFlag(null), isData: !(code && names[code]) };
}
