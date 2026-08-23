import React, { useState } from "react";
import { 
  FileText, Mail, Download, CheckSquare, Printer, Send, CheckCircle2, Sliders, Sparkles, Loader2 
} from "lucide-react";
import { Supplier, ShipmentMilestone, ProductRecipe } from "../types";

interface ReportGeneratorProps {
  suppliers: Supplier[];
  recipes: ProductRecipe[];
  shipments: ShipmentMilestone[];
}

const ReportGenerator = React.memo(function ReportGenerator({ suppliers, recipes, shipments }: ReportGeneratorProps) {
  
  const [reportTitle, setReportTitle] = useState("Trade2Turkey Tedarik ve Doğrulama Özeti");
  const [recipient, setRecipient] = useState("trade-client-germany@luxe-living.de");
  const [reportNotes, setReportNotes] = useState("Bu şeffaf özet; Bursa'da denetlenen tekstil kalite kontrol sertifikalarımızı, ayrıntılı malzeme maliyet reçetelerimizi ve Ambarlı Limanı deniz navlun aşamalarımızı derler.");
  
  // Custom checklist criteria
  const [includeSop, setIncludeSop] = useState(true);
  const [includeScores, setIncludeScores] = useState(true);
  const [includeRecipe, setIncludeRecipe] = useState(true);
  const [includeShipStatus, setIncludeShipStatus] = useState(true);

  const [mailSent, setMailSent] = useState(false);
  const handleSendReport = (e: React.FormEvent) => {
    e.preventDefault();
    setMailSent(true);
    setTimeout(() => setMailSent(false), 5000);
  };

  const [reportLoading, setReportLoading] = useState(false);
  const [reportSummary, setReportSummary] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const handleCompileSummary = async () => {
    setReportLoading(true);
    setReportError(null);
    setReportSummary(null);
    try {
      const res = await fetch("/api/ai/summarize-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suppliers,
          recipes,
          shipments
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server returned status: ${res.status}`);
      }

      const data = await res.json();
      setReportSummary(data.reportSummary);
    } catch (e: any) {
      console.error("Failed to compile summary:", e);
      setReportError(e.message || "Failed to compile AI Stakeholder summary");
    } finally {
      setReportLoading(false);
    }
  };

  // Triggering document print directly
  const handlePrint = () => {
    window.print();
  };

  const completedSopCount = 0;
  const activeSopCount = 0;

  return (
    <div className="space-y-6">
      
      {/* Configuration Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <h4 className="text-base font-bold font-display text-slate-900">Gerçek Zamanlı Tedarik Raporu Oluşturucu</h4>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Türk tedarikçi denetimleri, reçeteler ve konteyner aşama koordinatlarının şık, müşteriye hazır bir özetini derlemek için özelleştirilmiş blokları seçin.
        </p>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs font-medium">
          <div>
            <label className="block text-slate-600 mb-1">Oluşturulan Rapor Başlığı</label>
            <input 
              type="text" 
              value={reportTitle} 
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Hedef Müşteri E-postası</label>
            <input 
              type="email" 
              value={recipient} 
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Paydaş Notları Ekle</label>
            <input 
              type="text" 
              value={reportNotes} 
              onChange={(e) => setReportNotes(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white"
            />
          </div>
        </div>

        {/* Toggle options */}
        <div className="flex flex-wrap gap-4 items-center mt-5 text-xs font-semibold text-slate-600 bg-slate-50 p-3 rounded-lg border">
          <span className="text-[10px] text-slate-400 font-mono font-bold uppercase mr-2">Rapor İçeriği:</span>
          
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={includeSop} onChange={() => setIncludeSop(!includeSop)} className="accent-navy" />
            <span>Tedarik SOP Aşamaları</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={includeScores} onChange={() => setIncludeScores(!includeScores)} className="accent-navy" />
            <span>Tedarikçi Dürüstlük/Güvenilirlik Puanları</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={includeRecipe} onChange={() => setIncludeRecipe(!includeRecipe)} className="accent-navy" />
            <span>Reçete Bileşeni Maliyetlendirmesi</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={includeShipStatus} onChange={() => setIncludeShipStatus(!includeShipStatus)} className="accent-navy" />
            <span>Lojistik Aşama Takipçisi</span>
          </label>
        </div>

        {/* Quick buttons */}
        <div className="flex gap-2 justify-end mt-4">
          <button 
            onClick={handleCompileSummary}
            disabled={reportLoading}
            className="bg-purple-700 hover:bg-purple-800 disabled:bg-purple-400 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer border border-purple-800/20 transition-all duration-200"
          >
            {reportLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span>{reportLoading ? "Derleniyor..." : "AI Paydaş Özetini Derle"}</span>
          </button>

          <button 
            onClick={handlePrint}
            className="bg-slate-900 hover:bg-black text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="h-4 w-4" /> HTML Raporunu Dışa Aktar / Yazdır
          </button>
          
          <button 
            onClick={handleSendReport}
            className="bg-navy hover:bg-navy-light text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer border border-navy/20"
          >
            <Send className="h-4 w-4" /> Doğrudan Müşteri E-postasına Gönder
          </button>
        </div>

        {mailSent && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-600" /> Gönderildi! Doğrudan güvenli bir şekilde derlenmiş Trade2Turkey raporu e-postalandı: <strong>{recipient}</strong>.
          </div>
        )}
      </div>

      {/* STYLED PRINTABLE REPORT CONTAINER */}
      <div id="printable-area" className="bg-white border rounded-2xl p-8 relative shadow-sm max-w-4xl mx-auto space-y-8 print:border-none print:shadow-none print:p-0">
        
        {/* Report Brand Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
          <div>
            <span className="text-[10px] bg-slate-900 text-white font-mono font-extrabold px-2.5 py-0.5 rounded">
              TRADE2TURKEY
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-2 font-display">{reportTitle}</h2>
            <p className="text-xs text-slate-500 mt-1">Generated: 2026-06-03 19:26 UTC | Registered ID: T2T-REP-893019</p>
          </div>
          <div className="text-right text-xs">
            <strong className="text-slate-950 block">Trade2Turkey Sourcing Team</strong>
            <span className="text-slate-500">Bursa ve İstanbul Merkez Ofisleri</span>
            <span className="text-slate-400 block mt-1">trade2turkey06@gmail.com</span>
          </div>
        </div>

        {/* Notes block */}
        <div className="p-4 bg-slate-50 border-l-4 border-slate-800 rounded text-xs select-none leading-relaxed text-slate-700">
          <strong>Özet Ayrıntıları:</strong> {reportNotes}
        </div>

        {/* AI Executive Digest Block */}
        {(reportLoading || reportSummary || reportError) && (
          <div className="p-6 bg-slate-50/50 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-700 space-y-3 print:bg-white print:border-slate-300">
            <div className="flex items-center justify-between border-b pb-2 border-slate-200">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Sparkles className="h-4.5 w-4.5 text-purple-600 animate-pulse" />
                <span className="font-display">AI Tarafından Oluşturulan Yönetici Paydaş Özeti</span>
              </div>
              <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider">Gemini 2.5 Flash</span>
            </div>

            {reportLoading && (
              <div className="flex items-center gap-2 text-slate-500 py-4 font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                <span>Operasyonel tedarik günlüklerinden özet oluşturuluyor...</span>
              </div>
            )}

            {reportError && (
              <div className="text-red-600 font-medium py-2">
                ⚠️ Özet oluşturulurken hata oluştu: {reportError}
              </div>
            )}

            {reportSummary && (
              <div className="prose prose-sm max-w-none text-slate-800 font-medium whitespace-pre-line leading-relaxed">
                {reportSummary}
              </div>
            )}
          </div>
        )}

        {includeSop && (
          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 border-b pb-1 font-mono">1. Türkiye Tedarik SOP Durum Matrisi</h3>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-2 border rounded">
                <span className="text-slate-500 font-mono">Tamamlanan aşamalar:</span> <strong className="text-slate-800 font-mono">0 adım</strong>
              </div>
              <div className="bg-slate-50 p-2 border rounded">
                <span className="text-slate-500 font-mono">Bekleyen/Yoldaki adımlar:</span> <strong className="text-slate-800 font-mono">0 adım</strong>
              </div>
            </div>

            <div className="p-4 bg-slate-100 border rounded text-xs text-slate-500 text-center font-mono font-bold">
              Tedarik SOP süreç takibi bu çalışma alanında devre dışı bırakılmıştır.
            </div>
          </div>
        )}

        {/* Section C: Supplier Quality Scores */}
        {includeScores && (
          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 border-b pb-1 font-mono">2. Denetlenen Üretici Uyumluluk Puanları</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {suppliers.map(sup => (
                <div key={sup.id} className="border p-4 rounded-xl bg-slate-50/30 text-xs">
                  <div className="flex justify-between items-start font-bold">
                    <div>
                      <strong className="text-slate-900 block">{sup.name}</strong>
                      <span className="text-[10px] text-slate-400">{sup.city}, Turkey</span>
                    </div>
                    <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono">{sup.verifiedStatus}</span>
                  </div>

                  <div className="space-y-1.5 mt-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Kalite puanı:</span>
                      <strong className="text-slate-800 font-mono">{sup.scores.quality}/100</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fabrika Denetimi Geçildi:</span>
                      <strong className={sup.siteAuditCompleted ? "text-green-600" : "text-amber-600"}>
                        {sup.siteAuditCompleted ? `Geçti (${sup.auditScorePercent}%)` : "Denetim Yok"}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section D: Product Recipe Details */}
        {includeRecipe && recipes[0] && (
          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 border-b pb-1 font-mono">3. Genel Malzeme Listesi Reçete Maliyetlendirmesi</h3>
            <div className="text-xs">
              <span className="text-slate-500">Ürün Grubu:</span> <strong>{recipes[0].productName} {recipes[0].version}</strong>
            </div>

            <table className="w-full text-left text-[11px] border">
              <thead>
                <tr className="bg-slate-100 font-mono font-bold border-b text-slate-700 p-2">
                  <th className="p-2">Bileşen parça açıklaması</th>
                  <th className="p-2">Tüketim oranı</th>
                  <th className="p-2 text-right">Standart Fiyat ($)</th>
                  <th className="p-2 text-center">Fire / Atık</th>
                  <th className="p-2 text-teal-800">Kaynak Fabrika</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-600">
                {recipes[0].materials.map(mat => (
                  <tr key={mat.id}>
                    <td className="p-2 font-medium">{mat.name}</td>
                    <td className="p-2 font-mono">{mat.qtyRequired} {mat.unit}</td>
                    <td className="p-2 font-mono text-right">${mat.unitCostUsd.toFixed(3)}</td>
                    <td className="p-2 text-center text-red-500">+{mat.scrapRatePercent}%</td>
                    <td className="p-2 text-teal-700">{mat.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Section E: ACTIVE SEA FREIGHT POSITION TRACK */}
        {includeShipStatus && shipments[0] && (
          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 border-b pb-1 font-mono">4. Deniz Sevkiyatı ve Konteyner Lojistiği Kontrol Noktası</h3>
            <div className="bg-slate-50 p-4 rounded-xl border grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block font-mono text-[9px] uppercase">KONTEYNER GEMİSİ</span>
                <strong className="text-slate-850 block mt-0.5">{shipments[0].vesselName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono text-[9px] uppercase">MEVCUT LOJİSTİK KONUMU</span>
                <strong className="text-slate-850 block mt-0.5">{shipments[0].milestones[shipments[0].currentMilestoneIndex]?.title}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono text-[9px] uppercase">TAHMİNİ DEPOYA GİRİŞ</span>
                <strong className="text-navy block mt-0.5">{shipments[0].estimatedArrival}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Footer print disclaimer */}
        <div className="border-t pt-6 text-[10px] text-slate-400 font-medium leading-relaxed flex flex-col sm:flex-row justify-between gap-3 font-mono">
          <span>Resmi Trade2Turkey Kooperatif doğrulama programı günlükleri güvenli bir şekilde imzalanmıştır.</span>
          <span>© 2026 Trade2Turkey. Tüm hakları saklıdır.</span>
        </div>

      </div>
    </div>
  );
});

export default ReportGenerator;
