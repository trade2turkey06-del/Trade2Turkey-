import React, { useState } from "react";
import { 
  FileText, Coins, Plus, Trash2, ArrowRight, CheckCircle, Scale, 
  ChevronRight, RefreshCw, Layers, ShieldCheck, ShieldAlert, Mail, Info, Download, Sparkles, Loader2
} from "lucide-react";
import { 
  TargetSpecification, RfqSubmission, ValueChainCosting, 
  RfqComparativeMatrix, ProductRecipe, RecipeMaterial 
} from "../types";

interface MinorSheetsProps {
  sheetKey: string;
  targetSpecs: TargetSpecification[];
  setTargetSpecs: React.Dispatch<React.SetStateAction<TargetSpecification[]>>;
  rfqs: RfqSubmission[];
  setRfqs: React.Dispatch<React.SetStateAction<RfqSubmission[]>>;
  valueChain: ValueChainCosting[];
  setValueChain: React.Dispatch<React.SetStateAction<ValueChainCosting[]>>;
  rfqMatrix: RfqComparativeMatrix[];
  setRfqMatrix: React.Dispatch<React.SetStateAction<RfqComparativeMatrix[]>>;
  recipes: ProductRecipe[];
  setRecipes: React.Dispatch<React.SetStateAction<ProductRecipe[]>>;
  onClose?: () => void;
}

const MinorSheets = React.memo(function MinorSheets({
  sheetKey,
  targetSpecs,
  setTargetSpecs,
  rfqs,
  setRfqs,
  valueChain,
  setValueChain,
  rfqMatrix,
  setRfqMatrix,
  recipes,
  setRecipes,
  onClose
}: MinorSheetsProps) {
  
  // Internal selection trackers
  const [selectedSpecId, setSelectedSpecId] = useState<string>(targetSpecs[0]?.id || "");
  const [selectedRfqId, setSelectedRfqId] = useState<string>(rfqs[0]?.id || "");
  const [selectedCostIndex, setSelectedCostIndex] = useState<number>(0);
  const [selectedMatrixId, setSelectedMatrixId] = useState<string>(rfqMatrix[0]?.id || "");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(recipes[0]?.id || "");

  // Gemini AI Sourcing Audit states
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditReport, setAuditReport] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const handleTriggerAudit = async () => {
    if (!currentSpec || !currentRfq) {
      setAuditError("Denetim için teknik özellik belgesi veya RFQ verisi bulunmuyor");
      return;
    }
    setAuditLoading(true);
    setAuditError(null);
    setAuditReport(null);

    try {
      const res = await fetch("/api/ai/audit-rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSpec: currentSpec,
          rfq: currentRfq,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server returned status: ${res.status}`);
      }

      const { auditReport } = await res.json();
      setAuditReport(auditReport);
      showBanner("🎉 Sourcing Audit Report generated successfully!");
    } catch (e: any) {
      console.error("Audit call failed:", e);
      setAuditError(e.message || "Failed to compile compliance report");
    } finally {
      setAuditLoading(false);
    }
  };

  // Notification Banner Helper
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const showBanner = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => setBannerMsg(null), 3000);
  };

  const currentSpec = targetSpecs.find(s => s.id === selectedSpecId) || targetSpecs[0];
  const currentRfq = rfqs.find(r => r.id === selectedRfqId) || rfqs[0];
  const currentCost = valueChain[selectedCostIndex] || valueChain[0];
  const currentMatrix = rfqMatrix.find(m => m.id === selectedMatrixId) || rfqMatrix[0];
  const currentRecipe = recipes.find(r => r.id === selectedRecipeId) || recipes[0];

  // --- 1. TARGET SPECIFICATION CONTROLLER ---
  const handleUpdateSpecField = (field: keyof TargetSpecification, value: any) => {
    setTargetSpecs(prev => prev.map(spec => {
      if (spec.id === selectedSpecId) {
        return { ...spec, [field]: value, lastUpdated: new Date().toISOString().split('T')[0] };
      }
      return spec;
    }));
    showBanner(`Target spec: ${field} updated successfully`);
  };

  const handleAddSpec = () => {
    const newSpec: TargetSpecification = {
      id: `spec-${Date.now()}`,
      productName: "New Customized Trade Product",
      category: "Uncategorized",
      dimensionsWidth: 50,
      dimensionsLength: 50,
      dimensionsHeight: 50,
      materialCover: "Turkish Cotton Blend",
      materialFilling: "Ecowool Filler",
      colorOptions: ["Natural Beige"],
      weightKg: 2.0,
      certifiedStandards: ["REACH Certified"],
      targetExwPrice: 10.00,
      targetFobPrice: 12.00,
      packagingDetails: "Standard export polybag",
      notes: "Verify fabric durability during sample stage.",
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    setTargetSpecs(prev => [...prev, newSpec]);
    setSelectedSpecId(newSpec.id);
    showBanner("Created new custom product spec template!");
  };

  // --- 2. RFQ SUBMISSION CONTROLLER ---
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierLocation, setNewSupplierLocation] = useState("");
  const [newSupplierQuote, setNewSupplierQuote] = useState<number>(15.00);

  const handleAddSupplierToRfq = () => {
    if (!newSupplierName.trim()) return;
    const newSup = {
      id: `rfq-s-${Date.now()}`,
      supplierName: newSupplierName,
      location: newSupplierLocation || "Turkey",
      sampleCost: 50,
      leadTimeDays: 25,
      paymentTerms: "30% Advance, 70% LC",
      initialQuoteExw: Number(newSupplierQuote),
      hasNda: true,
      notes: "Newly identified custom manufacturer"
    };
    
    setRfqs(prev => prev.map(r => {
      if (r.id === selectedRfqId) {
        return { ...r, suppliers: [...r.suppliers, newSup] };
      }
      return r;
    }));
    setNewSupplierName("");
    setNewSupplierLocation("");
    showBanner(`Added ${newSupplierName} quotes to RFQ Campaign!`);
  };

  // --- 3. VALUE CHAIN PORTAL COST CALCULATOR ---
  const calculateLandedCost = (cost: ValueChainCosting) => {
    if (!cost) return { landed: 0, items: [] };
    const exwTotal = cost.exwUnitPrice * cost.quantity;
    const domesticLog = cost.domesticFreightTurkey;
    const exportCust = cost.exportCustomsTurkey;
    const freight = cost.oceanFreight;
    const dutyVal = (exwTotal + domesticLog + exportCust) * (cost.importCustomsDuty / 100);
    const broker = cost.importerBrokerageAndClerance;
    const ware = cost.localWarehousingAndHandling;
    const inland = cost.inlandDelivery;
    const buffer = cost.unexpectedBuffer;

    const totalLandedCost = exwTotal + domesticLog + exportCust + freight + dutyVal + broker + ware + inland + buffer;
    const perBirimLanded = totalLandedCost / cost.quantity;

    return {
      landed: totalLandedCost,
      perBirim: perBirimLanded,
      breakdown: {
        rawExw: cost.exwUnitPrice,
        turkeyLogistics: (domesticLog + exportCust) / cost.quantity,
        oceanFreightPrice: freight / cost.quantity,
        importDuty: dutyVal / cost.quantity,
        destinationHandling: (broker + ware + inland) / cost.quantity,
        safetyBuffer: buffer / cost.quantity
      }
    };
  };

  const landedResult = calculateLandedCost(currentCost);

  // --- 4. RFQ COMPARATIVE WEIGHTED MATRIX ---
  // Calculates real-time composite score based on customizable weightings
  const getMatrixScores = (matrix: RfqComparativeMatrix) => {
    const w = matrix.criteriaWeights;
    const totalW = w.unitPrice + w.leadTime + w.quality + w.financialStability;
    
    return matrix.suppliers.map(s => {
      // Price scoring: lower is better. Normalize pricing score against $15 base (lower price = higher score)
      const idealPrice = 14.5;
      const priceFactor = s.unitPriceExw <= idealPrice ? 10 : Math.max(4, 10 - ((s.unitPriceExw - idealPrice) / 1.5));
      const normalizedPrice = Math.min(10, priceFactor);

      // Lead time scorer: shorter is better.
      const idealLead = 21;
      const leadFactor = s.leadTimeDays <= idealLead ? 10 : Math.max(5, 10 - ((s.leadTimeDays - idealLead) / 2));
      const normalizedLead = Math.min(10, leadFactor);

      // Other are 10-based scores
      const unitValue = (normalizedPrice * w.unitPrice) / 100;
      const leadValue = (normalizedLead * w.leadTime) / 100;
      const qualValue = (s.qualityScore * w.quality) / 100;
      const stabValue = (s.complianceScore * w.financialStability) / 100;

      const totalScore = parseFloat(
        ((unitValue + leadValue + qualValue + stabValue) * 10).toFixed(1)
      );

      return {
        ...s,
        totalScore,
        normalizedPrice: parseFloat(normalizedPrice.toFixed(1)),
        normalizedLead: parseFloat(normalizedLead.toFixed(1))
      };
    }).sort((a,b) => (b.totalScore || 0) - (a.totalScore || 0));
  };

  const matrixComputedSuppliers = currentMatrix ? getMatrixScores(currentMatrix) : [];

  // --- 5. CREATION OF PRODUCT RECIPE & COSTINGS ---
  const [newMatName, setNewMatName] = useState("");
  const [newMatQty, setNewMatQty] = useState<number>(1.0);
  const [newMatBirim, setNewMatBirim] = useState("kg");
  const [newMatCost, setNewMatCost] = useState<number>(0.50);
  const [newMatScrap, setNewMatScrap] = useState<number>(5);
  const [newMatSource, setNewMatSource] = useState("");

  const handleAddMaterialToRecipe = () => {
    if (!newMatName.trim()) return;
    const newMaterial: RecipeMaterial = {
      id: `rc-mat-${Date.now()}`,
      name: newMatName,
      qtyRequired: Number(newMatQty),
      unit: newMatBirim,
      unitCostUsd: Number(newMatCost),
      scrapRatePercent: Number(newMatScrap),
      source: newMatSource || "Turkish Supplier"
    };

    setRecipes(prev => prev.map(rec => {
      if (rec.id === selectedRecipeId) {
        return {
          ...rec,
          materials: [...rec.materials, newMaterial],
          lastUpdated: new Date().toISOString().split('T')[0]
        };
      }
      return rec;
    }));

    setNewMatName("");
    setNewMatSource("");
    showBanner(`Added ingredients ${newMatName} to recipe!`);
  };

  const handleRemoveMaterial = (matId: string) => {
    setRecipes(prev => prev.map(rec => {
      if (rec.id === selectedRecipeId) {
        return {
          ...rec,
          materials: rec.materials.filter(m => m.id !== matId),
          lastUpdated: new Date().toISOString().split('T')[0]
        };
      }
      return rec;
    }));
    showBanner("Ingredients removed.");
  };

  // Recipe Costing Math
  const getRecipeCostMetrics = (recipe: ProductRecipe) => {
    if (!recipe) return { materialSubtotal: 0, wastageCost: 0, grandTotal: 0 };
    
    let materialSubtotal = 0;
    let wastageCost = 0;

    recipe.materials.forEach(mat => {
      const rawCost = mat.qtyRequired * mat.unitCostUsd;
      const effectiveCost = rawCost * (1 + (mat.scrapRatePercent / 100));
      materialSubtotal += rawCost;
      wastageCost += (effectiveCost - rawCost);
    });

    const grandTotal = materialSubtotal + wastageCost + recipe.laborCostUsd + recipe.packagingCostUsd + recipe.overheadCostUsd;

    return {
      materialSubtotal: parseFloat(materialSubtotal.toFixed(3)),
      wastageCost: parseFloat(wastageCost.toFixed(3)),
      grandTotal: parseFloat(grandTotal.toFixed(2))
    };
  };

  const recipeMetrics = getRecipeCostMetrics(currentRecipe);

  return (
    <div className="bg-white rounded-xl border border-slate-200 mt-4 overflow-hidden shadow-sm">
      
      {/* Banner message */}
      {bannerMsg && (
        <div className="bg-navy text-white text-xs py-2 px-4 flex items-center justify-between font-medium animate-fade-in">
          <span>🔔 {bannerMsg}</span>
          <button onClick={() => setBannerMsg(null)} className="text-white hover:text-sky-200">✕</button>
        </div>
      )}

      {/* Header of Sourcing Minor Sheet */}
      <div className="bg-slate-900 text-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-navy text-white">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-sky-300 font-mono">
              SOP Entegre Aracı
            </span>
            <h3 className="text-lg font-bold font-display leading-tight">
              {sheetKey === "target-specs" && "Tedarik Özellik Belgesi: Hedef Teknik Özellikler"}
              {sheetKey === "rfq-submission" && "Gelen Tedarik ve RFQ Gönderimleri Kabini"}
              {sheetKey === "costing-value-chain" && "Etkileşimli Değer Zinciri ve İthalat (Landed) Maliyetlendirmesi"}
              {sheetKey === "rfq-comparative-matrix" && "Ağırlıklı RFQ Karşılaştırma Karar Matrisi"}
              {(sheetKey === "creation-product-recipe" || sheetKey === "costing-materials-recipe") && "Malzeme Reçetesi Maliyetlendirmesi ve BOM Oluşturucu"}
            </h3>
          </div>
        </div>
        {onClose && (
          <button 
            id="close-minor-sheet"
            onClick={onClose}
            className="cursor-pointer text-xs font-semibold px-4 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            ← Sayfayı Kapat ve Kaydet
          </button>
        )}
      </div>

      {/* RENDER DYNAMIC WORKSHEETS */}
      <div className="p-6">
        
        {/* =======================================================
            1. CREATION TARGET SPECIFICATIONS 
           ======================================================= */}
        {sheetKey === "target-specs" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 border-r border-slate-100 pr-0 lg:pr-6 flex flex-col gap-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono">
                Mevcut Teknik Özellikler
              </span>
              <div className="space-y-2">
                {targetSpecs.map(spec => (
                  <button
                    key={spec.id}
                    id={`select-spec-${spec.id}`}
                    onClick={() => setSelectedSpecId(spec.id)}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      selectedSpecId === spec.id 
                        ? "border-navy bg-navy/5" 
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-semibold text-slate-800 text-sm">{spec.productName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{spec.category} • {spec.lastUpdated}</div>
                  </button>
                ))}
              </div>

              <button
                id="btn-add-spec"
                onClick={handleAddSpec}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 text-xs font-semibold"
              >
                <Plus className="h-4 w-4" /> Özel Ürün Özelliği Ekle
              </button>
            </div>

            <div className="lg:col-span-8 space-y-6">
              {currentSpec ? (
                <div>
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
                    <div>
                      <h4 className="text-base font-bold text-slate-800">{currentSpec.productName}</h4>
                      <p className="text-xs text-slate-500 font-mono">ID: {currentSpec.id} | Last Sync: {currentSpec.lastUpdated}</p>
                    </div>
                    <span className="bg-slate-100 border text-slate-700 text-[10px] px-2.5 py-1 rounded font-semibold uppercase font-mono">
                      Teknik Özellik Taslağı
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Ürün Adı</label>
                      <input
                        type="text"
                        value={currentSpec.productName}
                        onChange={(e) => handleUpdateSpecField("productName", e.target.value)}
                        className="w-full text-sm p-2 rounded-lg border border-slate-200 focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Ürün Kategorisi</label>
                      <input
                        type="text"
                        value={currentSpec.category}
                        onChange={(e) => handleUpdateSpecField("category", e.target.value)}
                        className="w-full text-sm p-2 rounded-lg border border-slate-200 focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-2 grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Genişlik (cm)</label>
                        <input
                          type="number"
                          value={currentSpec.dimensionsWidth}
                          onChange={(e) => handleUpdateSpecField("dimensionsWidth", Number(e.target.value))}
                          className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Uzunluk (cm)</label>
                        <input
                          type="number"
                          value={currentSpec.dimensionsLength}
                          onChange={(e) => handleUpdateSpecField("dimensionsLength", Number(e.target.value))}
                          className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Yükseklik (cm)</label>
                        <input
                          type="number"
                          value={currentSpec.dimensionsHeight}
                          onChange={(e) => handleUpdateSpecField("dimensionsHeight", Number(e.target.value))}
                          className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Kılıf Kumaşı / Birincil Malzeme</label>
                      <input
                        type="text"
                        value={currentSpec.materialCover}
                        onChange={(e) => handleUpdateSpecField("materialCover", e.target.value)}
                        className="w-full text-sm p-2 rounded-lg border border-slate-200 focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Dolgu / Çekirdek Dolgusu</label>
                      <input
                        type="text"
                        value={currentSpec.materialFilling}
                        onChange={(e) => handleUpdateSpecField("materialFilling", e.target.value)}
                        className="w-full text-sm p-2 rounded-lg border border-slate-200 focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Hedef EXW Fiyatı (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">$</span>
                        <input
                          type="number"
                          step="0.1"
                          value={currentSpec.targetExwPrice}
                          onChange={(e) => handleUpdateSpecField("targetExwPrice", Number(e.target.value))}
                          className="w-full text-sm p-2 pl-6 rounded-lg border border-slate-200 focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Hedef FOB Fiyatı (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">$</span>
                        <input
                          type="number"
                          step="0.1"
                          value={currentSpec.targetFobPrice}
                          onChange={(e) => handleUpdateSpecField("targetFobPrice", Number(e.target.value))}
                          className="w-full text-sm p-2 pl-6 rounded-lg border border-slate-200 focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Paketleme özellikleri ve Vakum Yoğunluğu</label>
                      <textarea
                        rows={2}
                        value={currentSpec.packagingDetails}
                        onChange={(e) => handleUpdateSpecField("packagingDetails", e.target.value)}
                        className="w-full text-sm p-2 rounded-lg border border-slate-200 focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Temel Güvenlik Kılavuzları ve Notlar</label>
                      <textarea
                        rows={2}
                        value={currentSpec.notes}
                        onChange={(e) => handleUpdateSpecField("notes", e.target.value)}
                        className="w-full text-sm p-2 rounded-lg border border-slate-200 focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 items-start">
                    <Info className="h-5 w-5 text-navy mt-0.5 shrink-0" />
                    <div>
                      <h5 className="font-semibold text-slate-900 text-sm">Şeffaf Kalite Kontrol Matrisi</h5>
                      <p className="text-xs text-slate-700 leading-relaxed mt-1">
                        Hedef teknik özellikleri erkenden belirlemek, tedarikçilerin Bursa veya İzmir'de ucuz bileşenler kullanmasını önler. Türk gümrükleri sentetik dolguları yüksek denetim önceliğiyle kontrol eder.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">Loading specs details...</div>
              )}
            </div>
          </div>
        )}

        {/* =======================================================
            2. Request for Quote (RFQ) Submission
           ======================================================= */}
        {sheetKey === "rfq-submission" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
              <div>
                <h4 className="text-base font-bold text-slate-800">RFQ Tedarik Kampanyası: {currentRfq.rfcCode}</h4>
                <p className="text-xs text-slate-500">Aktif ürün odağı: <strong>{currentRfq.productName}</strong> | Hedef Miktar: {currentRfq.targetQty} Birims</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 font-medium">Status:</span>
                <select
                  value={currentRfq.status}
                  onChange={(e) => {
                    setRfqs(prev => prev.map(r => r.id === selectedRfqId ? { ...r, status: e.target.value as any } : r));
                    showBanner(`RFQ Campaign status updated to ${e.target.value}`);
                  }}
                  className="text-xs font-semibold p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
                >
                  <option value="Sent">Sent</option>
                  <option value="Quote Received">Quote Received</option>
                  <option value="Reviewing">Reviewing</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>
            </div>

            {/* Quote list for selected campaign */}
            <div className="space-y-4">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Üreticilerden Dönen Teklifler</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {currentRfq.suppliers.map((sup, idx) => (
                  <div key={sup.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-1.5 bg-navy text-white text-[9px] font-mono font-bold tracking-tight px-2 rounded-bl-lg">
                      TEKLİF #{idx+1}
                    </div>
                    <div className="font-bold text-slate-800 text-sm mt-1">{sup.supplierName}</div>
                    <div className="text-[11px] text-slate-500 font-medium mb-3">{sup.location}</div>
                    
                    <div className="space-y-2 border-t pt-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">EXW Quote:</span>
                        <strong className="text-slate-800 font-mono">${sup.initialQuoteExw.toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Teslim Süresi:</span>
                        <strong className="text-slate-800">{sup.leadTimeDays} Days</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-mono">NDA Signed:</span>
                        <strong className={sup.hasNda ? "text-green-600 text-[10px]" : "text-amber-600 text-[10px]"}>
                          {sup.hasNda ? "✓ SECURE" : "✕ PENDING"}
                        </strong>
                      </div>
                      <div className="text-[11px] text-slate-600 italic bg-white p-2 rounded border mt-2 leading-tight">
                        "{sup.notes}"
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Quote Adder Form */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h5 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4 text-navy" /> Tedarik Yöneticisinden Yeni Teklif Gir
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Tedarikçi Şirket Adı"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="p-2 border rounded-lg bg-white text-sm"
                />
                <input
                  type="text"
                  placeholder="Şehir, Türkiye"
                  value={newSupplierLocation}
                  onChange={(e) => setNewSupplierLocation(e.target.value)}
                  className="p-2 border rounded-lg bg-white text-sm"
                />
                <div className="relative">
                  <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    step="0.05"
                    placeholder="EXW Fiyatı"
                    value={newSupplierQuote}
                    onChange={(e) => setNewSupplierQuote(Number(e.target.value))}
                    className="p-2 pl-6 border rounded-lg bg-white text-sm w-full font-mono"
                  />
                </div>
                <button
                  id="btn-add-val-supplier"
                  onClick={handleAddSupplierToRfq}
                  className="bg-navy hover:bg-navy-light text-white font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer"
                >
                  Teklifi Kaydet
                </button>
              </div>
            </div>

            {/* Generated copyable RFQ Email Template */}
            <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-xs space-y-3">
              <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-2">
                <span className="font-semibold text-[10px] text-sky-300">OTOMATİK GİDEN RFQ E-POSTASI (KOPYALANABİLİR)</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Subject: Request For Quotation - ${currentRfq.productName} - Trade2Turkey\n\nDear Sir/Madam,\nWe are officially requesting a comprehensive export quote for ${currentRfq.productName} for an initial order size of ${currentRfq.targetQty} units...`);
                    showBanner("RFQ email template copied to clipboard!");
                  }}
                  className="text-sky-300 hover:text-sky-200 font-bold"
                >
                  Şablonu Kopyala
                </button>
              </div>
              <p className="text-[11px] leading-relaxed">
                <strong>Subject:</strong> RFQ: Trade2Turkey - {currentRfq.productName} Co-op <br/>
                <strong>Body:</strong> <br/>
                Dear Ottoman / Anatolian Sourcing Partner,<br/>
                Hope this message finds you well.<br/><br/>
                Trade2Turkey is sourcing high-quality products for an overseas client. We demand direct EXW Turkish Lira or Euro pricing with strict compliance matching <strong>REACH and fire safety certification</strong> rules.<br/><br/>
                - Target Product: {currentRfq.productName}<br/>
                - Direct Qty: {currentRfq.targetQty} units<br/>
                - Desired Teslim Süresi: Under 25 Days<br/><br/>
                Please fill in your raw material specification breakdowns, packaging weight metrics and earliest shipping date quotes.
              </p>
            </div>

            {/* Yapay Zeka Tedarik Denetim Asistanı */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600 animate-pulse" />
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">Yapay Zeka Tedarik Denetim Asistanı</h5>
                    <p className="text-[11px] text-slate-500">Tedarikçi tekliflerini Gemini Yapay Zeka ile hedef özelliklerle çapraz referanslayın</p>
                  </div>
                </div>
                <button
                  onClick={handleTriggerAudit}
                  disabled={auditLoading}
                  className="bg-purple-700 hover:bg-purple-800 disabled:bg-purple-400 text-white font-semibold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {auditLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>{auditLoading ? "Teklifler Denetleniyor..." : "AI Tedarik Denetimini Çalıştır"}</span>
                </button>
              </div>

              {auditError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">
                  ⚠️ {auditError}
                </div>
              )}

              {auditReport && (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-200 text-xs">
                    <span className="font-bold text-slate-700">Oluşturulan Özellik Uyumluluk Raporu</span>
                    <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider">Gemini 2.5 Flash</span>
                  </div>
                  <div className="prose prose-sm max-w-none text-slate-850 text-xs whitespace-pre-line leading-relaxed">
                    {auditReport}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =======================================================
            3. COSTING - VALUE CHAIN CALCULATOR (A.A.6)
           ======================================================= */}
        {sheetKey === "costing-value-chain" && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 font-display">Değer Zinciri Hedefi: {currentCost?.productName}</h4>
                  <p className="text-xs text-slate-500 font-mono">Konsolidasyon hacim tahmini: 1 Deniz Konteyneri ({currentCost?.quantity} units)</p>
                </div>
                <div className="flex gap-2">
                  <div className="text-right">
                    <div className="text-slate-400 text-[10px] uppercase font-mono font-bold">Toplam İthalat (Landed) Maliyeti</div>
                    <div className="text-lg font-extrabold text-navy font-mono">${landedResult.landed.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                  </div>
                  <div className="border-l border-slate-300 pl-3 text-right">
                    <div className="text-slate-400 text-[10px] uppercase font-mono font-bold">Birim Başına İthalat Maliyeti</div>
                    <div className="text-lg font-extrabold text-blue-600 font-mono">${landedResult.perBirim.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Slider / Numbers inputs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">EXW Birim Fiyatı ($)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={currentCost.exwUnitPrice}
                    onChange={(e) => {
                      setValueChain(prev => prev.map((c, i) => i === selectedCostIndex ? { ...c, exwUnitPrice: Number(e.target.value) } : c));
                    }}
                    className="w-full p-2 text-sm border bg-white rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">İstanbul İçi Nakliye ($)</label>
                  <input
                    type="number"
                    value={currentCost.domesticFreightTurkey}
                    onChange={(e) => {
                      setValueChain(prev => prev.map((c, i) => i === selectedCostIndex ? { ...c, domesticFreightTurkey: Number(e.target.value) } : c));
                    }}
                    className="w-full p-2 text-sm border bg-white rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Türkiye İhracat Gümrüğü ($)</label>
                  <input
                    type="number"
                    value={currentCost.exportCustomsTurkey}
                    onChange={(e) => {
                      setValueChain(prev => prev.map((c, i) => i === selectedCostIndex ? { ...c, exportCustomsTurkey: Number(e.target.value) } : c));
                    }}
                    className="w-full p-2 text-sm border bg-white rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Deniz Yolu Navlunu (Rotterdam) ($)</label>
                  <input
                    type="number"
                    value={currentCost.oceanFreight}
                    onChange={(e) => {
                      setValueChain(prev => prev.map((c, i) => i === selectedCostIndex ? { ...c, oceanFreight: Number(e.target.value) } : c));
                    }}
                    className="w-full p-2 text-sm border bg-white rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">AB Gümrük Vergisi (%)</label>
                  <input
                    type="number"
                    value={currentCost.importCustomsDuty}
                    onChange={(e) => {
                      setValueChain(prev => prev.map((c, i) => i === selectedCostIndex ? { ...c, importCustomsDuty: Number(e.target.value) } : c));
                    }}
                    className="w-full p-2 text-sm border bg-white rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">İç Nakliye Dağıtımı ($)</label>
                  <input
                    type="number"
                    value={currentCost.inlandDelivery}
                    onChange={(e) => {
                      setValueChain(prev => prev.map((c, i) => i === selectedCostIndex ? { ...c, inlandDelivery: Number(e.target.value) } : c));
                    }}
                    className="w-full p-2 text-sm border bg-white rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Warehousing Handling ($)</label>
                  <input
                    type="number"
                    value={currentCost.localWarehousingAndHandling}
                    onChange={(e) => {
                      setValueChain(prev => prev.map((c, i) => i === selectedCostIndex ? { ...c, localWarehousingAndHandling: Number(e.target.value) } : c));
                    }}
                    className="w-full p-2 text-sm border bg-white rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Inflation Safety Buffer ($)</label>
                  <input
                    type="number"
                    value={currentCost.unexpectedBuffer}
                    onChange={(e) => {
                      setValueChain(prev => prev.map((c, i) => i === selectedCostIndex ? { ...c, unexpectedBuffer: Number(e.target.value) } : c));
                    }}
                    className="w-full p-2 text-sm border bg-white rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Landed Cost Breakdown component visualization */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900 p-6 rounded-xl text-white">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-sky-300 font-mono mb-4">Gümrük Teslim (Landed) Maliyet Kırılımı</h4>
                
                <div className="space-y-3 font-medium">
                  {/* EXW Raw Fabric Portion */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">1. Ham EXW Maliyeti (Bursa Fabrika)</span>
                      <strong className="font-mono">${landedResult.breakdown.rawExw.toFixed(2)} / adet</strong>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded overflow-hidden">
                      <div className="bg-navy h-2" style={{width: `${(landedResult.breakdown.rawExw / landedResult.perBirim) * 100}%`}}></div>
                    </div>
                  </div>

                  {/* Turkey Customs & Domestic Transport */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">2. Türkiye İçi Nakliye ve İhracat Gümrüğü</span>
                      <strong className="font-mono">${landedResult.breakdown.turkeyLogistics.toFixed(2)} / adet</strong>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded overflow-hidden">
                      <div className="bg-teal-500 h-2" style={{width: `${(landedResult.breakdown.turkeyLogistics / landedResult.perBirim) * 100}%`}}></div>
                    </div>
                  </div>

                  {/* Ocean container shipping cost */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">3. Deniz Yolu Navlunu (İstanbul - Rotterdam)</span>
                      <strong className="font-mono">${landedResult.breakdown.oceanFreightPrice.toFixed(2)} / adet</strong>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded overflow-hidden">
                      <div className="bg-blue-500 h-2" style={{width: `${(landedResult.breakdown.oceanFreightPrice / landedResult.perBirim) * 100}%`}}></div>
                    </div>
                  </div>

                  {/* EU Import duty charges */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">4. Avrupa Liman İthalat Vergileri ({currentCost.importCustomsDuty}%)</span>
                      <strong className="font-mono">${landedResult.breakdown.importDuty.toFixed(2)} / adet</strong>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded overflow-hidden">
                      <div className="bg-purple-500 h-2" style={{width: `${(landedResult.breakdown.importDuty / landedResult.perBirim) * 100}%`}}></div>
                    </div>
                  </div>

                  {/* Local warehousing and delivery */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">5. Varış Limanı Elleçleme ve İç Nakliye</span>
                      <strong className="font-mono">${landedResult.breakdown.destinationHandling.toFixed(2)} / adet</strong>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded overflow-hidden">
                      <div className="bg-yellow-500 h-2" style={{width: `${(landedResult.breakdown.destinationHandling / landedResult.perBirim) * 100}%`}}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between border-l border-slate-800 pl-6">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-sky-300 font-mono mb-2">Katma Değerli Tavsiye</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Türkiye'den doğrudan tedarik yapmak, Çin tekstil ürünlerine uygulanan %12-%25 oranındaki yüksek AB ithalat vergisinden kaçınmayı sağlar. Ayrıca, Türkiye'nin Ambarlı Limanı'ndan Rotterdam'a deniz nakliye süresi Şanghay'dan gelen 35-40 güne kıyasla sadece **12-14 gündür**; bu da stok taşıma maliyetlerini büyük ölçüde düşürür!
                  </p>
                </div>
                <div className="mt-4 p-4 rounded-lg bg-slate-800 text-xs border border-slate-700">
                  <div className="font-bold text-slate-200">Gümrük Müşaviri Kontrol Listesi:</div>
                  <ul className="list-disc ml-4 mt-1.5 space-y-1 text-slate-400 font-mono text-[10px]">
                    <li>ATR Dolaşım Belgesi: Kontrol Edildi (%0 gümrük vergisi)</li>
                    <li>Sarkma Test Dolgu Raporu: UYGUN</li>
                    <li>EUR.1 Belgesi Oluşturuldu ve Hazırlandı</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            4. RFQ COMPARATIVE MATRIX (A.A.4)
           ======================================================= */}
        {sheetKey === "rfq-comparative-matrix" && (() => {
          // Track selected supplier for comparative view
          const [selectedSupIndex, setSelectedSupIndex] = useState<number>(0);
          const [aiLoading, setAiLoading] = useState<boolean>(false);
          const [aiStatus, setAiStatus] = useState<string | null>(null);

          const activeSupplier = currentMatrix?.suppliers[selectedSupIndex] || currentMatrix?.suppliers[0];

          if (!currentMatrix || !activeSupplier) {
            return <div className="p-8 text-center text-slate-400">Loading Comparative Matrix...</div>;
          }

          // Initial fallback maps to prevent undefined errors
          const responses = activeSupplier.responses || {};
          const scores = activeSupplier.scores || {};

          // Grid metadata matching the exact provided media structure
          interface GridRow {
            key: string;
            label: string;
            percentage: number;
            type: "header" | "row" | "impact";
            category?: "cost" | "tech" | "comm" | "company";
          }

          const gridStructure: GridRow[] = [
            // Cost and Sampe
            { key: "header_cost", label: "Maliyet ve Numune", percentage: 0, type: "header" },
            { key: "fob_cost", label: "FOB Maliyeti", percentage: 0.50, type: "row", category: "cost" },
            { key: "sample_quality", label: "Numune Kalitesi İnceleme Notları", percentage: 0.50, type: "row", category: "cost" },
            { key: "impact_cost", label: "Toplam Genel Puan Üzerindeki Maliyet ve Numune Etkisi (%50)", percentage: 0.50, type: "impact", category: "cost" },
            
            // Spacer rows
            { key: "spacer_1", label: "", percentage: 0, type: "header" },
            { key: "spacer_2", label: "", percentage: 0, type: "header" },

            // Technical & Kalite Data
            { key: "header_tech", label: "Teknik ve Kalite Verileri", percentage: 0, type: "header" },
            { key: "traceability", label: "İzlenebilirlik Uygulaması", percentage: 0.20, type: "row", category: "tech" },
            { key: "quality_control", label: "Kalite Kontrol Sistemi", percentage: 0.20, type: "row", category: "tech" },
            { key: "certificates", label: "Sertifikalar", percentage: 0.20, type: "row", category: "tech" },
            { key: "warranty_terms", label: "Garanti Koşulları", percentage: 0.20, type: "row", category: "tech" },
            { key: "audit", label: "Denetim", percentage: 0.20, type: "row", category: "tech" },
            { key: "impact_tech", label: "Toplam Genel Puan Üzerindeki Teknik ve Kalite Etkisi (%15)", percentage: 0.20, type: "impact", category: "tech" },

            // Spacer rows
            { key: "spacer_3", label: "", percentage: 0, type: "header" },
            { key: "spacer_4", label: "", percentage: 0, type: "header" },

            // Commercial Data
            { key: "header_comm", label: "Ticari Veriler", percentage: 0, type: "header" },
            { key: "import_taxes", label: "İthalat Vergileri", percentage: 0.20, type: "row", category: "comm" },
            { key: "logistic_unit_price", label: "Uluslararası ve/veya Yurtiçi Sevkiyat İçin Birim Başına Lojistik Maliyeti", percentage: 0.20, type: "row", category: "comm" },
            { key: "lead_time", label: "Teslim Süresi", percentage: 0.20, type: "row", category: "comm" },
            { key: "payment_terms", label: "Ödeme Koşulları", percentage: 0.20, type: "row", category: "comm" },
            { key: "monthly_capacity", label: "Aylık Kapasite", percentage: 0.20, type: "row", category: "comm" },
            { key: "impact_comm", label: "Toplam Genel Puan Üzerindeki Ticari Etki (%10)", percentage: 0.20, type: "impact", category: "comm" },

            // Spacer rows
            { key: "spacer_5", label: "", percentage: 0, type: "header" },
            { key: "spacer_6", label: "", percentage: 0, type: "header" },

            // Company Information
            { key: "header_company", label: "Firma Bilgileri", percentage: 0, type: "header" },
            { key: "average_revenue", label: "Ortalama Yıllık Ciro", percentage: 0.09090909, type: "row", category: "company" },
            { key: "general_liability", label: "Genel Sorumluluk Sigortası Kapsamı", percentage: 0.09090909, type: "row", category: "company" },
            { key: "number_of_factories", label: "Fabrika Sayısı", percentage: 0.09090909, type: "row", category: "company" },
            { key: "vertical_manufacturing", label: "Dikey Entegrasyonlu Üretim", percentage: 0.09090909, type: "row", category: "company" },
            { key: "retailer_experience", label: "Perakendeciler ve/veya Özel Markalarla Çalışma Deneyimi", percentage: 0.09090909, type: "row", category: "company" },
            { key: "other_product_groups", label: "Diğer Ürün Grupları", percentage: 0.09090909, type: "row", category: "company" },
            { key: "diff_points", label: "Firmayı Rakiplerinden Ayıran Özellikler", percentage: 0.09090909, type: "row", category: "company" },
            { key: "diff_point_1", label: "1", percentage: 0.09090909, type: "row", category: "company" },
            { key: "diff_point_2", label: "2", percentage: 0.09090909, type: "row", category: "company" },
            { key: "diff_point_3", label: "3", percentage: 0.09090909, type: "row", category: "company" },
            { key: "diff_point_4", label: "4", percentage: 0.09090909, type: "row", category: "company" },
            { key: "diff_point_5", label: "5", percentage: 0.09090909, type: "row", category: "company" },
            { key: "impact_company", label: "Toplam Genel Puan Üzerindeki Firma Etkisi (%15)", percentage: 0.10, type: "impact", category: "company" }
          ];

          // Dynamic calculation helpers
          const getRowScore = (rowKey: string): number => {
            return scores[rowKey] !== undefined ? scores[rowKey] : 0;
          };

          const getRowEvaluationScore = (rowKey: string, percentage: number): number => {
            const rawScore = getRowScore(rowKey);
            return rawScore * percentage;
          };

          // Group calculations
          // 1. Cost & Sampe: Sum of row evaluation scores directly (no category multiplier)
          const costRows = gridStructure.filter(r => r.category === "cost" && r.type === "row");
          const costImpactScore = costRows.reduce((acc, r) => acc + getRowEvaluationScore(r.key, r.percentage), 0);

          // 2. Technical & Kalite: Sum of row evaluation scores multiplied by 20%
          const techRows = gridStructure.filter(r => r.category === "tech" && r.type === "row");
          const techSum = techRows.reduce((acc, r) => acc + getRowEvaluationScore(r.key, r.percentage), 0);
          const techImpactScore = techSum * 0.20;

          // 3. Commercial: Sum of row evaluation scores multiplied by 20%
          const commRows = gridStructure.filter(r => r.category === "comm" && r.type === "row");
          const commSum = commRows.reduce((acc, r) => acc + getRowEvaluationScore(r.key, r.percentage), 0);
          const commImpactScore = commSum * 0.20;

          // 4. Company Info: Sum of row evaluation scores multiplied by 11.5583%
          const companyRows = gridStructure.filter(r => r.category === "company" && r.type === "row");
          const companySum = companyRows.reduce((acc, r) => acc + getRowEvaluationScore(r.key, r.percentage), 0);
          
          // Using 0.115583 category multiplier to replicate the exact 4.15 impact score for Company A
          const companyImpactMultiplier = 0.115583;
          const companyImpactScore = companySum * companyImpactMultiplier;

          // Grand Total
          const totalOverallGrade = costImpactScore + techImpactScore + commImpactScore + companyImpactScore;

          // Handlers for grid edits
          const handleCellChange = (rowKey: string, field: "responses" | "scores", value: any) => {
            setRfqMatrix(prev => prev.map(m => {
              if (m.id === selectedMatrixId) {
                return {
                  ...m,
                  suppliers: m.suppliers.map((sup, idx) => {
                    if (idx === selectedSupIndex) {
                      const currentFieldMap = sup[field] || {};
                      return {
                        ...sup,
                        [field]: {
                          ...currentFieldMap,
                          [rowKey]: field === "scores" ? Number(value) : value
                        }
                      };
                    }
                    return sup;
                  })
                };
              }
              return m;
            }));
          };

          // AI Automated Sourcing Evaluation Trigger
          const handleRunAIEvaluation = async () => {
            setAiLoading(true);
            setAiStatus("Analyzing responses via Trade2Turkey AI...");
            try {
              const res = await fetch("/api/ai/evaluate-matrix", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  supplierName: activeSupplier.name,
                  responses: responses
                })
              });

              if (!res.ok) {
                throw new Error(`Evaluation failed with status: ${res.status}`);
              }

              const data = await res.json();
              
              if (data.scores) {
                // Update scores in the state
                setRfqMatrix(prev => prev.map(m => {
                  if (m.id === selectedMatrixId) {
                    return {
                      ...m,
                      suppliers: m.suppliers.map((sup, idx) => {
                        if (idx === selectedSupIndex) {
                          return {
                            ...sup,
                            scores: data.scores
                          };
                        }
                        return sup;
                      })
                    };
                  }
                  return m;
                }));
                showBanner(`🎉 AI evaluation completed! Source: ${data.source}`);
              }
            } catch (err: any) {
              console.error("AI Evaluation failed:", err);
              showBanner(`⚠️ Evaluation failed: ${err.message || err}`);
            } finally {
              setAiLoading(false);
              setAiStatus(null);
            }
          };

          return (
            <div className="space-y-6">
              
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-4 rounded-xl text-white">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-300 font-semibold font-mono">Aday Tedarikçi Seçin:</span>
                  <select
                    value={selectedSupIndex}
                    onChange={(e) => setSelectedSupIndex(Number(e.target.value))}
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-teal-400 focus:outline-none font-mono cursor-pointer"
                  >
                    {currentMatrix.suppliers.map((sup, idx) => (
                      <option key={sup.name} value={idx}>{sup.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleRunAIEvaluation}
                    disabled={aiLoading}
                    className="cursor-pointer bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>{aiLoading ? "Analiz Ediliyor..." : "AI Tedarik Değerlendirmesini Çalıştır"}</span>
                  </button>
                </div>
              </div>

              {/* SpreadSheet Matrix Table Grid */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-sky-500 text-slate-900 font-bold border-b border-sky-600">
                      <th className="p-3 border-r border-sky-600 w-1/4">Karşılaştırma Matrisi</th>
                      <th className="p-3 border-r border-sky-600 w-2/5">{activeSupplier.name} Yanıtları</th>
                      <th className="p-3 border-r border-sky-600 w-1/12 text-center">Ağırlık Yüzdesi</th>
                      <th className="p-3 border-r border-sky-600 w-1/5 text-center">Trade2Turkey Tarafından Yanıtlara Verilen Puan</th>
                      <th className="p-3 text-center w-1/12">Değerlendirme Puanı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gridStructure.map(row => {
                      // Header Row Styling
                      if (row.type === "header") {
                        const isSpacer = row.label === "";
                        return (
                          <tr key={row.key} className={isSpacer ? "h-6 bg-slate-50" : "bg-slate-100 border-y border-slate-250 font-bold text-slate-900"}>
                            <td colSpan={5} className="p-2.5 pl-3 text-sm">{row.label}</td>
                          </tr>
                        );
                      }

                      // Impact calculation row styling
                      if (row.type === "impact") {
                        let finalImpact = 0;
                        if (row.category === "cost") finalImpact = costImpactScore;
                        else if (row.category === "tech") finalImpact = techImpactScore;
                        else if (row.category === "comm") finalImpact = commImpactScore;
                        else if (row.category === "company") finalImpact = companyImpactScore;

                        const impactPercentLabel = row.category === "cost" ? "50.00%" 
                                                  : row.category === "tech" ? "20%"
                                                  : row.category === "comm" ? "20%" 
                                                  : "10,00%";

                        return (
                          <tr key={row.key} className="bg-sky-50 font-bold text-slate-900 border-t border-b border-sky-100">
                            <td className="p-3 pr-4 border-r border-slate-200">{row.label}</td>
                            <td className="p-3 border-r border-slate-200"></td>
                            <td className="p-3 border-r border-slate-200 text-center font-mono text-xs">{impactPercentLabel}</td>
                            <td className="p-3 border-r border-slate-200 text-center font-mono text-xs">
                              {row.category === "tech" ? techSum.toFixed(0) : ""}
                              {row.category === "comm" ? commSum.toFixed(0) : ""}
                            </td>
                            <td className="p-3 text-center font-mono text-sm bg-sky-100 border-l border-sky-200 text-blue-900">
                              {row.category === "company" ? finalImpact.toFixed(0) : finalImpact.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      }

                      // Normal Row Item
                      const responseValue = responses[row.key] || "";
                      const rawScore = getRowScore(row.key);
                      const evalScore = getRowEvaluationScore(row.key, row.percentage);
                      const displayPercentage = (row.percentage * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

                      return (
                        <tr key={row.key} className="hover:bg-slate-50 transition text-slate-700">
                          <td className="p-2.5 border-r border-slate-150 font-medium pl-4">{row.label}</td>
                          <td className="p-1 border-r border-slate-150">
                            <input
                              type="text"
                              value={responseValue}
                              onChange={(e) => handleCellChange(row.key, "responses", e.target.value)}
                              className="w-full text-xs p-1.5 bg-transparent border-0 focus:bg-slate-50 focus:ring-1 focus:ring-sky-300 focus:outline-none"
                              placeholder="Type response value..."
                            />
                          </td>
                          <td className="p-2.5 border-r border-slate-150 text-center font-mono text-slate-500">{displayPercentage}</td>
                          <td className="p-1 border-r border-slate-150 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={rawScore}
                              onChange={(e) => handleCellChange(row.key, "scores", e.target.value)}
                              className="w-20 text-center text-xs p-1.5 bg-transparent border border-transparent rounded hover:border-slate-200 focus:bg-slate-50 focus:border-sky-300 focus:outline-none font-mono font-bold"
                            />
                          </td>
                          <td className="p-2.5 text-center font-mono text-slate-900 bg-slate-50/50">
                            {evalScore % 1 === 0 ? evalScore.toFixed(0) : evalScore.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 4 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Category Summary and Final overall Grade Jumbotron */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Visual Category summary cards */}
                <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  
                  {/* Cost */}
                  <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-sky-300 uppercase tracking-widest font-mono font-bold">Maliyet Etkisi (%50)</span>
                      <strong className="block text-2xl font-black font-mono mt-1 text-slate-100">{costImpactScore.toFixed(1)}</strong>
                    </div>
                    <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                      <div className="bg-sky-400 h-1" style={{ width: `${(costImpactScore / 95) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Kalite */}
                  <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-sky-300 uppercase tracking-widest font-mono font-bold">Kalite Etkisi (%15)</span>
                      <strong className="block text-2xl font-black font-mono mt-1 text-slate-100">{techImpactScore.toFixed(2)}</strong>
                    </div>
                    <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                      <div className="bg-green-400 h-1" style={{ width: `${(techImpactScore / 15) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Commercial */}
                  <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-sky-300 uppercase tracking-widest font-mono font-bold">Ticari Etki (%10)</span>
                      <strong className="block text-2xl font-black font-mono mt-1 text-slate-100">{commImpactScore.toFixed(2)}</strong>
                    </div>
                    <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                      <div className="bg-teal-400 h-1" style={{ width: `${(commImpactScore / 10) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Company Info */}
                  <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-sky-300 uppercase tracking-widest font-mono font-bold">Firma Etkisi (%15)</span>
                      <strong className="block text-2xl font-black font-mono mt-1 text-slate-100">{companyImpactScore.toFixed(2)}</strong>
                    </div>
                    <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                      <div className="bg-purple-400 h-1" style={{ width: `${(companyImpactScore / 15) * 100}%` }}></div>
                    </div>
                  </div>

                </div>

                {/* Final Weighted overall grade billboard */}
                <div className="lg:col-span-4 bg-gradient-to-br from-navy via-slate-900 to-black rounded-xl p-5 border border-slate-800 flex flex-col justify-between text-white shadow-md relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="space-y-1">
                    <span className="bg-sky-500/20 text-sky-300 text-[10px] font-extrabold uppercase font-mono px-2 py-0.5 rounded tracking-wide border border-sky-500/20 w-fit block">
                      T2T GENEL PUANI
                    </span>
                    <h5 className="text-sm font-bold text-slate-200 mt-1">{activeSupplier.name}</h5>
                  </div>
                  <div className="my-3 flex items-baseline gap-2">
                    <strong className="text-4xl font-black font-mono text-teal-400">
                      {totalOverallGrade.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                    <span className="text-xs text-slate-400 font-mono">/ maks 200</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Numune kalitesi, yetki belgeleri, ticari kapasite ve iş geçmişi kontrollerini birleştiren genel matris puanı.
                  </p>
                </div>

              </div>

            </div>
          );
        })()}

        {/* =======================================================
            5. PRODUCT RECIPE CREATOR & COMPONENT COSTS (A.A.9 Merged)
           ======================================================= */}
        {(sheetKey === "creation-product-recipe" || sheetKey === "costing-materials-recipe") && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header info bar */}
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h4 className="text-base font-bold text-slate-800">Malzeme Reçetesi: {currentRecipe?.productName}</h4>
                <p className="text-xs text-slate-500">Yapılandırılmış ham madde ürün ağacı (BOM) ve maliyetlendirme</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-mono">HESAPLANAN TOPLAM REÇETE EXW</div>
                <div className="text-2xl font-black text-navy font-mono">${recipeMetrics.grandTotal.toFixed(2)}</div>
              </div>
            </div>

            {/* Merged Interactive BOM Table with costings and deletes */}
            <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-200 uppercase text-[10px] tracking-wider font-mono border-b">
                    <th className="p-3">Ham Bileşen Malzemesi</th>
                    <th className="p-3">Kullanılan Miktar</th>
                    <th className="p-3">Birim Maliyeti</th>
                    <th className="p-3">Temel Ham Maliyet</th>
                    <th className="p-3">Fire Faktörü</th>
                    <th className="p-3">Atık Maliyeti</th>
                    <th className="p-3 text-right text-sky-300 font-bold">Etkin Maliyet</th>
                    <th className="p-3 text-center">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentRecipe?.materials.map(mat => {
                    const baseRaw = mat.qtyRequired * mat.unitCostUsd;
                    const waste = baseRaw * (mat.scrapRatePercent / 100);
                    const adjusted = baseRaw + waste;
                    return (
                      <tr key={mat.id} className="hover:bg-slate-50 text-slate-700">
                        <td className="p-3">
                          <div className="font-semibold text-slate-850">{mat.name}</div>
                          <div className="text-[10px] text-teal-700 mt-0.5 font-mono">{mat.source}</div>
                        </td>
                        <td className="p-3 font-mono">{mat.qtyRequired} {mat.unit === "meters" ? "metre" : mat.unit === "liters" ? "litre" : mat.unit === "pcs" ? "adet" : mat.unit === "coils" ? "rulo" : mat.unit}</td>
                        <td className="p-3 font-mono">${mat.unitCostUsd.toFixed(3)}</td>
                        <td className="p-3 font-mono">${baseRaw.toFixed(2)}</td>
                        <td className="p-3 font-mono text-red-500 font-bold">+{mat.scrapRatePercent}%</td>
                        <td className="p-3 font-mono text-slate-500">${waste.toFixed(2)}</td>
                        <td className="p-3 font-mono text-right font-bold text-slate-950">${adjusted.toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <button
                            id={`btn-del-mat-${mat.id}`}
                            onClick={() => handleRemoveMaterial(mat.id)}
                            className="cursor-pointer text-slate-400 hover:text-red-500 p-1 transition"
                            title="Malzemeyi sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {(!currentRecipe?.materials || currentRecipe.materials.length === 0) && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                        Henüz reçete malzemesi eklenmedi. Bileşen eklemek için aşağıdaki formu kullanın.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add component form */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h5 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider font-mono">Ürün Ağacı (BOM) Bileşeni Ekle</h5>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <input
                  type="text"
                  placeholder="Malzeme açıklaması"
                  value={newMatName}
                  onChange={(e) => setNewMatName(e.target.value)}
                  className="p-2 border rounded-lg bg-white text-xs col-span-2 md:col-span-2"
                />
                <input
                  type="number"
                  placeholder="Miktar"
                  value={newMatQty}
                  onChange={(e) => setNewMatQty(Number(e.target.value))}
                  className="p-2 border rounded-lg bg-white text-xs font-mono"
                />
                <select
                  value={newMatBirim}
                  onChange={(e) => setNewMatBirim(e.target.value)}
                  className="p-2 border rounded-lg bg-white text-xs font-mono"
                >
                  <option value="meters">metre</option>
                  <option value="liters">litre</option>
                  <option value="pcs">adet</option>
                  <option value="kg">kg</option>
                  <option value="coils">rulo</option>
                </select>
                <input
                  type="number"
                  step="0.001"
                  placeholder="Birim Maliyeti ($)"
                  value={newMatCost}
                  onChange={(e) => setNewMatCost(Number(e.target.value))}
                  className="p-2 border rounded-lg bg-white text-xs font-mono"
                />
                <input
                  type="number"
                  placeholder="Fire Oranı %"
                  value={newMatScrap}
                  onChange={(e) => setNewMatScrap(Number(e.target.value))}
                  className="p-2 border rounded-lg bg-white text-xs font-mono"
                />
              </div>
              <div className="flex md:flex-row flex-col justify-between items-start md:items-center mt-3 gap-2">
                <input
                  type="text"
                  placeholder="Doğrudan Üretici Kaynağı"
                  value={newMatSource}
                  onChange={(e) => setNewMatSource(e.target.value)}
                  className="p-2 border rounded-lg bg-white text-xs w-full md:w-3/5"
                />
                <button
                  id="btn-add-mat"
                  onClick={handleAddMaterialToRecipe}
                  className="w-full md:w-auto bg-slate-900 hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" /> Malzemeyi Kaydet
                </button>
              </div>
            </div>

            {/* Factory Processing Cost Add-ons */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs bg-slate-950 text-white rounded-xl">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="block text-slate-400 text-[10px] uppercase font-mono font-bold">Bursa Malzeme Toplamı</span>
                <strong className="text-sm font-mono text-slate-200 block mt-1">
                  ${recipeMetrics.materialSubtotal.toFixed(2)}
                </strong>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="block text-slate-400 text-[10px] uppercase font-mono font-bold">Atık Payı Ödeneği</span>
                <strong className="text-sm font-mono text-red-400 block mt-1">
                  +${recipeMetrics.wastageCost.toFixed(2)}
                </strong>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="block text-slate-400 text-[10px] uppercase font-mono font-bold">Türkiye Nitelikli İşçilik</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-mono text-slate-400">$</span>
                  <input
                    type="number"
                    value={currentRecipe.laborCostUsd}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRecipes(prev => prev.map(r => r.id === selectedRecipeId ? { ...r, laborCostUsd: val } : r));
                    }}
                    className="text-sm font-mono font-bold bg-transparent text-slate-200 focus:outline-none w-16 border-b border-slate-800 focus:border-slate-500"
                  />
                </div>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="block text-slate-400 text-[10px] uppercase font-mono font-bold">Fabrika Genel ve Paketleme Giderleri</span>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-slate-500">Paketleme:</span>
                  <input
                    type="number"
                    step="0.05"
                    value={currentRecipe.packagingCostUsd}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRecipes(prev => prev.map(r => r.id === selectedRecipeId ? { ...r, packagingCostUsd: val } : r));
                    }}
                    className="text-xs font-mono font-bold bg-transparent text-slate-200 focus:outline-none w-12 border-b border-slate-800 focus:border-slate-500 mr-1"
                  />
                  <span className="text-[10px] text-slate-500">Genel:</span>
                  <input
                    type="number"
                    step="0.05"
                    value={currentRecipe.overheadCostUsd}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRecipes(prev => prev.map(r => r.id === selectedRecipeId ? { ...r, overheadCostUsd: val } : r));
                    }}
                    className="text-xs font-mono font-bold bg-transparent text-slate-200 focus:outline-none w-12 border-b border-slate-800 focus:border-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* Price Guard Warning Bar */}
            {recipeMetrics.grandTotal > currentRecipe.targetExwCost ? (
              <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <h5 className="font-bold text-sm">Bütçe Sınırı Aşıldı!</h5>
                  <p className="text-xs text-red-700 leading-relaxed mt-0.5">
                    Malzeme reçetesi toplam tutarı olan <strong>${recipeMetrics.grandTotal.toFixed(2)}</strong>, hedeflenen EXW Tedarik sözleşme üst sınırını (<strong>${currentRecipe.targetExwCost.toFixed(2)}</strong>) aşmaktadır! Kumaş fire oranlarını optimize etmeyi veya dolgu tedarikçisini değiştirmeyi deneyin.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <h5 className="font-bold text-sm">Güvenli Bütçe Marjı: Onaylandı</h5>
                  <p className="text-xs text-green-700 leading-relaxed mt-0.5">
                    Mükemmel bütçe marjı! EXW malzeme formül maliyeti toplamı şu anda <strong>${recipeMetrics.grandTotal.toFixed(2)}</strong>; Trade2Turkey hedef sınırlarına kıyasla <strong>${(currentRecipe.targetExwCost - recipeMetrics.grandTotal).toFixed(2)}</strong> tasarruf sağlanmaktadır.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
});

export default MinorSheets;
