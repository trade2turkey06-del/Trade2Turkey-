import React, { useState } from "react";
import { 
  ShieldCheck, Award, Star, Mail, MapPin, Check, Plus, Trash2, 
  ChevronRight, ArrowUpRight, CheckCircle2, ShieldAlert, FileText, Upload
} from "lucide-react";
import { Supplier } from "../types";

interface SupplierScoringProps {
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
}

const SupplierScoring = React.memo(function SupplierScoring({ suppliers, setSuppliers }: SupplierScoringProps) {
  
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || "");
  const [editingScores, setEditingScores] = useState<any>(null);

  // New Supplier form states
  const [newSupForm, setNewSupForm] = useState({
    name: "",
    city: "",
    country: "Turkey",
    mainCategory: "Textiles & Soft Furniture Assembly",
    employees: 120,
    capacity: 10000
  });

  const [feedback, setFeedback] = useState<string | null>(null);
  const triggerFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const currentSupplier = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];

  const handleUpdateScore = (scoreType: "quality" | "pricing" | "delivery" | "comm", val: number) => {
    setSuppliers(prev => prev.map(sup => {
      if (sup.id === selectedSupplierId) {
        const updatedScores = { ...sup.scores, [scoreType]: val };
        return {
          ...sup,
          scores: updatedScores
        };
      }
      return sup;
    }));
  };

  const handleToggleCheckboxes = (field: "ndaSigned" | "sampleApproved" | "siteAuditCompleted") => {
    setSuppliers(prev => prev.map(sup => {
      if (sup.id === selectedSupplierId) {
        const val = !sup[field];
        let status = sup.verifiedStatus;
        if (field === "siteAuditCompleted") {
          status = val ? "Gold" : "Verified";
        }
        return {
          ...sup,
          [field]: val,
          verifiedStatus: status as any,
          auditScorePercent: field === "siteAuditCompleted" && val ? 90 : sup.auditScorePercent
        };
      }
      return sup;
    }));
    triggerFeedback("Tedarikçi sertifikasyon belgesi durumu değiştirildi.");
  };

  const handleCreateSupplier = () => {
    if (!newSupForm.name.trim()) return;
    const newSup: Supplier = {
      id: `sup-${Date.now()}`,
      name: newSupForm.name,
      city: newSupForm.city || "Bursa",
      country: "Turkey",
      mainCategory: newSupForm.mainCategory,
      scores: {
        quality: 75,
        pricing: 80,
        delivery: 80,
        comm: 80
      } as any,
      capacityMonthly: Number(newSupForm.capacity),
      employees: Number(newSupForm.employees),
      verifiedStatus: "Pending",
      ndaSigned: false,
      sampleApproved: false,
      siteAuditCompleted: false,
      auditScorePercent: 0,
      evidenceFiles: []
    };

    setSuppliers(prev => [...prev, newSup]);
    setSelectedSupplierId(newSup.id);
    setNewSupForm({
      name: "",
      city: "",
      country: "Turkey",
      mainCategory: "Textiles & Soft Furniture Assembly",
      employees: 120,
      capacity: 10000
    });
    triggerFeedback("Tedarikçi aday listesine başarıyla eklendi.");
  };

  // Math helper for weighted score
  // Quality (40%), Pricing (25%), Delivery (20%), Communication (15%)
  const calculateCompositeScore = (scores: Supplier["scores"]) => {
    if (!scores) return 0;
    const qVal = scores.quality * 0.4;
    const pVal = scores.pricing * 0.25;
    const dVal = scores.delivery * 0.2;
    const cVal = (scores as any).comm * 0.15;
    return parseFloat((qVal + pVal + dVal + cVal).toFixed(1));
  };

  const finalScore = currentSupplier ? calculateCompositeScore(currentSupplier.scores) : 0;

  return (
    <div className="space-y-6">
      
      {/* Visual notification */}
      {feedback && (
        <div className="bg-emerald-600 text-white p-3 rounded-lg text-xs font-semibold flex justify-between items-center shadow">
          <span>✔️ {feedback}</span>
          <button onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      {/* Grid view of all suppliers side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Supplier List Column */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono mb-3">Denetlenen Türk Üreticiler</h4>
            <div className="space-y-2">
              {suppliers.map(sup => {
                const cmp = calculateCompositeScore(sup.scores);
                const isSelected = sup.id === selectedSupplierId;
                return (
                  <button
                    key={sup.id}
                    id={`btn-select-sup-${sup.id}`}
                    onClick={() => setSelectedSupplierId(sup.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition ${
                      isSelected 
                        ? "border-orange-500 bg-orange-50/20 ring-2 ring-orange-500/5" 
                        : "border-slate-150 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <strong className="text-sm font-bold text-slate-800 block text-ellipsis overflow-hidden whitespace-nowrap max-w-[150px]">
                          {sup.name}
                        </strong>
                        <span className="text-[10px] text-slate-400 font-mono">{sup.city}, {sup.country}</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        cmp >= 90 ? "bg-green-100 text-green-800" : cmp >= 80 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                      }`}>
                        Bileşik: {cmp}%
                      </span>
                    </div>

                    <div className="flex gap-2 items-center mt-3 text-[11px] font-medium text-slate-500">
                      <span className={`h-2 w-2 rounded-full ${
                        sup.verifiedStatus === "Gold" ? "bg-amber-500" : sup.verifiedStatus === "Verified" ? "bg-green-600" : "bg-slate-400"
                      }`} />
                      <span>{sup.verifiedStatus} Ortak</span>
                      <span>•</span>
                      <span>{sup.employees} Çalışan</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* New Supplier Onboarding Form */}
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono mb-3">Yeni Tedarikçi Kaydet</h5>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Fabrika Adı</label>
                <input
                  type="text"
                  placeholder="örn. Bursa Dikiş Evi Ltd."
                  value={newSupForm.name}
                  onChange={(e) => setNewSupForm({...newSupForm, name: e.target.value})}
                  className="w-full p-2 border rounded-lg bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Şehir (Türkiye)</label>
                  <input
                    type="text"
                    placeholder="örn. Bursa"
                    value={newSupForm.city}
                    onChange={(e) => setNewSupForm({...newSupForm, city: e.target.value})}
                    className="w-full p-2 border rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Aylık Kapasite Birimi</label>
                  <input
                    type="number"
                    value={newSupForm.capacity}
                    onChange={(e) => setNewSupForm({...newSupForm, capacity: Number(e.target.value)})}
                    className="w-full p-2 border rounded-lg bg-white font-mono"
                  />
                </div>
              </div>
              <button
                id="btn-save-new-supplier"
                onClick={handleCreateSupplier}
                className="w-full bg-slate-900 hover:bg-black text-white py-2 rounded-lg font-semibold cursor-pointer"
              >
                Adayı Tedarik Listesine Ekle
              </button>
            </div>
          </div>
        </div>

        {/* Selected Supplier Evaluation Detail Card */}
        <div className="md:col-span-2 space-y-6">
          {currentSupplier ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-teal-50 text-teal-800 text-[10px] font-bold tracking-wider uppercase font-mono px-2 py-0.5 rounded">
                      🇹🇷 {currentSupplier.city}, TURKEY
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-400 font-mono text-xs">{currentSupplier.mainCategory}</span>
                  </div>
                  <h3 className="text-xl font-bold font-display text-slate-900 mt-1">{currentSupplier.name}</h3>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-150">
                  <Award className="h-6 w-6 text-orange-500 shrink-0" />
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase font-mono font-bold">Ağırlıklı Puan</div>
                    <div className="text-xl font-black font-mono text-slate-900">{finalScore}%</div>
                  </div>
                </div>
              </div>

              {/* Slider Scorers */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-4">Trade2Turkey Tedarik Metrikleri Puanlaması (Sürgüler)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Quality Factor */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700">1. Dikiş ve Kumaş Kalitesi (%40 Ağırlık)</span>
                      <strong className="text-slate-900 font-mono">{currentSupplier.scores.quality}/100</strong>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={currentSupplier.scores.quality}
                      onChange={(e) => handleUpdateScore("quality", Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                    <p className="text-[10px] text-slate-400">BS5852 yanıcılık testleri, dikiş yırtılma testleri, dolgu yoğunluğu kontrolleri.</p>
                  </div>

                  {/* Pricing Factor */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700">2. EXW Teklif Rekabetçiliği (%25 Ağırlık)</span>
                      <strong className="text-slate-900 font-mono">{currentSupplier.scores.pricing}/100</strong>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={currentSupplier.scores.pricing}
                      onChange={(e) => handleUpdateScore("pricing", Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                    <p className="text-[10px] text-slate-400">Birim EXW marjı, standart hedef fiyatlandırma ile karşılaştırıldığında ($15.50 üst sınır).</p>
                  </div>

                  {/* Delivery Lead Time Factor */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700">3. Teslim Süresi ve Güvenilirlik (%20 Ağırlık)</span>
                      <strong className="text-slate-900 font-mono">{currentSupplier.scores.delivery}/100</strong>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={currentSupplier.scores.delivery}
                      onChange={(e) => handleUpdateScore("delivery", Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                    <p className="text-[10px] text-slate-400">Beklenen üretim teslim süreleri (Standart: 21-30 gün sınırı).</p>
                  </div>

                  {/* Comm Factor */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700">4. Proaktif İş Birliği ve İletişim (%15 Ağırlık)</span>
                      <strong className="text-slate-900 font-mono">{(currentSupplier.scores as any).comm}/100</strong>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={(currentSupplier.scores as any).comm}
                      onChange={(e) => handleUpdateScore("comm", Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                    <p className="text-[10px] text-slate-400">Müşteri geri bildirim gecikmeleri, gümrük müşaviri belgeleri teslim süresi.</p>
                  </div>
                </div>
              </div>

              {/* Verification Badges Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Check 1: NDA */}
                <button
                  id="toggle-verification-nda"
                  onClick={() => handleToggleCheckboxes("ndaSigned")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition cursor-pointer text-center ${
                    currentSupplier.ndaSigned 
                      ? "bg-green-50 border-green-200 text-green-800" 
                      : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <ShieldCheck className="h-5 w-5 mb-1.5" />
                  <span className="text-xs font-bold">1. NDA Yürürlükte</span>
                  <span className="text-[9px] mt-0.5">{currentSupplier.ndaSigned ? "🛡️ GÜVENLİ PORTAL" : "✕ İMZALANMADI"}</span>
                </button>

                {/* Check 2: Sample Approved */}
                <button
                  id="toggle-verification-sample"
                  onClick={() => handleToggleCheckboxes("sampleApproved")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition cursor-pointer text-center ${
                    currentSupplier.sampleApproved 
                      ? "bg-green-50 border-green-200 text-green-800" 
                      : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <Award className="h-5 w-5 mb-1.5" />
                  <span className="text-xs font-bold">2. Numune Onaylandı</span>
                  <span className="text-[9px] mt-0.5">{currentSupplier.sampleApproved ? "✓ ONAYLANDI" : "✕ TESTLER BEKLENİYOR"}</span>
                </button>

                {/* Check 3: Site Audit passed */}
                <button
                  id="toggle-verification-site"
                  onClick={() => handleToggleCheckboxes("siteAuditCompleted")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition cursor-pointer text-center ${
                    currentSupplier.siteAuditCompleted
                      ? "bg-green-50 border-green-200 text-green-800" 
                      : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <Star className="h-5 w-5 mb-1.5" />
                  <span className="text-xs font-bold">3. Fabrika Denetlendi</span>
                  <span className="text-[9px] mt-0.5">{currentSupplier.siteAuditCompleted ? `✓ KAYDEDİLDİ (${currentSupplier.auditScorePercent}%)` : "✕ DENETİM YOK"}</span>
                </button>
              </div>

              {/* Evidence Document Listing for Client Transparency */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Doğrulama Kanıt Belgeleri Deposu</h4>
                  <button
                    onClick={() => triggerFeedback("Mock uploader activated. Select your file from local system to populate.")}
                    className="text-teal-700 hover:text-teal-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" /> Dosya Yükle
                  </button>
                </div>

                {currentSupplier.evidenceFiles.length > 0 ? (
                  <div className="divide-y border rounded-xl overflow-hidden text-xs">
                    {currentSupplier.evidenceFiles.map(fn => (
                      <div key={fn.name} className="flex justify-between items-center p-3 hover:bg-slate-50 text-slate-700 bg-white">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-800">{fn.name}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">{fn.category} • added {fn.dateAdded}</span>
                          </div>
                        </div>
                        <a href={fn.downloadUrl} className="text-teal-700 hover:text-teal-900 font-bold font-mono">
                          İndir ({fn.size})
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 border-2 border-dashed rounded-xl text-center text-slate-400 text-xs">
                    Doğrulanmış dosya yüklenmedi. İlk uyumluluk çıktılarını otomatik olarak yüklemek için yukarıdaki NDA, Numune veya Denetim onay kutularını değiştirin.
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 bg-white border rounded-xl shadow-sm">Tedarikçi kayıtları yükleniyor...</div>
          )}
        </div>

      </div>
    </div>
  );
});

export default SupplierScoring;
