// Dil desteği: tipli çeviri dosyaları (tr/ ve en/) + hafif React context. Türkçe tek kaynaktır; en/ aynı tipi
// karşılamak zorundadır, bu yüzden eksik bir anahtar derleme anında görülür. Çalışma anında boş/eksik bir İngilizce
// metin olursa Türkçesi gösterilir ve geliştirme modunda konsola uyarı düşer.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { percent } from "./percent";
import { tr, type Messages } from "./tr";
import { en } from "./en";
import { CodedError } from "./errors";

export type Lang = "tr" | "en";
export type { Messages };
export const LANGS: Lang[] = ["tr", "en"];
// Kullanıcı verisi seçili dilde değil, girildiği dilde büyük harfe çevrilmeli ("i" → "İ"). Türkçeye özgü harf içeren
// metin "tr" olarak işaretlenir; diğer veriler (ör. İngilizce girilmiş) sayfa diliyle kalır, aksi hâlde "TORTİLLA" olurdu.
export const dataLang = (text?: string | null) => /[çğıöşüÇĞİÖŞÜ]/.test(text ?? "") ? "tr" : undefined;
export const isLang = (value: unknown): value is Lang => value === "tr" || value === "en";
export const localeOf = (lang: Lang) => lang === "en" ? "en-GB" : "tr-TR";

const dev = (() => { try { return !!(import.meta as any).env?.DEV; } catch { return false; } })();
const warned = new Set<string>();
// Eksik İngilizce metinde Türkçeye düşer; iç içe nesneleri tembel olarak sarar.
export function withFallback<T extends object>(primary: T, fallback: T, path: string, cache: Map<string, unknown>): T {
  return new Proxy(primary, {
    get(target, key) {
      if (typeof key === "symbol") return (target as any)[key];
      const value = (target as any)[key], base = (fallback as any)[key], name = path ? `${path}.${key}` : key;
      if ((value === undefined || value === "") && base !== undefined) {
        if (dev && !warned.has(name)) { warned.add(name); console.warn(`[i18n] English text missing for "${name}"; showing Turkish.`); }
        return base;
      }
      if (value && typeof value === "object" && base && typeof base === "object") {
        if (!cache.has(name)) cache.set(name, withFallback(value, base, name, cache));
        return cache.get(name);
      }
      return value;
    },
  });
}
const catalogs: Record<Lang, Messages> = { tr, en: withFallback(en, tr, "", new Map()) };
export const messagesFor = (lang: Lang) => catalogs[lang];

export function formatters(lang: Lang) {
  const locale = localeOf(lang);
  return {
    locale,
    number: (value: number | null | undefined, maximumFractionDigits = 2) => value === null || value === undefined || !Number.isFinite(value) ? "" : new Intl.NumberFormat(locale, { maximumFractionDigits, useGrouping: false }).format(value),
    percent: (value: number | null | undefined, digits = 2, minimumDigits = 0) => percent(value, lang, digits, minimumDigits),
    currency: (value: number, currency = "USD") => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value),
    date: (value: Date | number | string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) => new Intl.DateTimeFormat(locale, { timeZone: "Europe/Istanbul", ...options }).format(new Date(value)),
    dateTime: (value: Date | number) => new Intl.DateTimeFormat(locale, { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" }).format(new Date(value)),
    lower: (text: string) => text.toLocaleLowerCase(locale),
  };
}
export type Formatters = ReturnType<typeof formatters>;

// Seçili dil modül düzeyinde de tutulur: React dışındaki yardımcılar (ör. sayı biçimleme) bunu okur.
let currentLang: Lang = "tr";
export const getLang = () => currentLang;
export const formatPercent = (value: number | null | undefined, digits = 2, minimumDigits = 0) => percent(value, currentLang, digits, minimumDigits);
export const getMessages = () => catalogs[currentLang];

const STORAGE_KEY = "t2t_lang";
const storageKey = (uid?: string) => uid ? `${STORAGE_KEY}:${uid}` : STORAGE_KEY;
function readStored(uid?: string): Lang | null { try { const value = localStorage.getItem(storageKey(uid)); return isLang(value) ? value : null; } catch { return null; } }
function writeStored(lang: Lang, uid?: string) { try { localStorage.setItem(STORAGE_KEY, lang); if (uid) localStorage.setItem(storageKey(uid), lang); } catch { /* özel pencere vb. */ } }

interface UserBinding { uid: string; persist?: (lang: Lang) => Promise<unknown> }
interface I18nValue {
  lang: Lang; t: Messages; fmt: Formatters;
  setLang: (lang: Lang) => void;
  // Oturum açan kullanıcıyı bağlar: tercih profilde veya kullanıcıya özel localStorage'da varsa uygulanır.
  bindUser: (uid: string | null, profileLang?: unknown, persist?: (lang: Lang) => Promise<unknown>) => void;
}
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children, initialLang }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? readStored() ?? "tr");
  const user = useRef<UserBinding | null>(null);
  // Oturum açmadan (giriş ekranında) yapılan açık seçim; oturum açılınca kullanıcıya aktarılır.
  const chosenBeforeLogin = useRef(false);
  currentLang = lang;
  useEffect(() => { document.documentElement.lang = lang; document.title = catalogs[lang].shell.documentTitle; }, [lang]);
  const save = (next: Lang, binding: UserBinding | null) => {
    writeStored(next, binding?.uid);
    void binding?.persist?.(next).catch(() => { /* profil yazılamazsa yerel tercih yeterli */ });
  };
  const setLang = useCallback((next: Lang) => {
    currentLang = next; setLangState(next); save(next, user.current);
    if (!user.current) chosenBeforeLogin.current = true;
  }, []);
  // Öncelik: giriş ekranındaki açık seçim → profildeki tercih → bu cihazdaki kullanıcı tercihi → mevcut dil.
  const bindUser = useCallback((uid: string | null, profileLang?: unknown, persist?: (lang: Lang) => Promise<unknown>) => {
    if (!uid) { user.current = null; return; }
    const first = user.current?.uid !== uid;
    user.current = { uid, persist };
    if (first && chosenBeforeLogin.current) { chosenBeforeLogin.current = false; if (profileLang !== currentLang) save(currentLang, user.current); return; }
    const preferred = isLang(profileLang) ? profileLang : first ? readStored(uid) : null;
    if (preferred) { currentLang = preferred; setLangState(preferred); writeStored(preferred, uid); }
    else if (first) save(currentLang, user.current);
  }, []);
  const value = useMemo(() => ({ lang, t: catalogs[lang], fmt: formatters(lang), setLang, bindUser }), [lang, setLang, bindUser]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Sağlayıcı dışında (ör. birim testlerinde) Türkçe varsayılanla çalışır.
const fallbackValue: I18nValue = { lang: "tr", t: tr, fmt: formatters("tr"), setLang: () => {}, bindUser: () => {} };
export function useI18n() { return useContext(I18nContext) ?? fallbackValue; }

export { CodedError } from "./errors";
export function errorMessage(t: Messages, error: unknown, fallback: string) {
  if (error instanceof CodedError) { const entry = t.errors[error.code] as unknown; return typeof entry === "function" ? (entry as (params: Record<string, string>) => string)(error.params) : String(entry); }
  return error instanceof Error && error.message ? error.message : fallback;
}
