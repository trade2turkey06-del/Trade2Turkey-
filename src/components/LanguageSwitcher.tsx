import { Languages } from "lucide-react";
import { LANGS, useI18n } from "../i18n";

// TR / EN seçici: sayfa yenilenmeden dili değiştirir; seçim localStorage'a ve (oturum varsa) kullanıcı profiline yazılır.
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return <div role="group" aria-label={t.language.switchTo} className={`flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 text-[10px] font-semibold ${className}`}>
    <Languages aria-hidden className="ml-1.5 h-3.5 w-3.5 text-slate-400" />
    {LANGS.map(code => <button key={code} type="button" lang={code} aria-pressed={lang === code} title={t.language.names[code]} onClick={() => setLang(code)}
      className={`rounded-full px-2 py-1 ${lang === code ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>{t.language.short[code]}</button>)}
  </div>;
}
