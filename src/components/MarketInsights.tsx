import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { 
  collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, orderBy 
} from "firebase/firestore";
import { 
  Plus, Trash2, Edit2, Check, X, Shield, TrendingDown, TrendingUp, Award, DollarSign, Globe 
} from "lucide-react";

export interface MarketInsight {
  id: string;
  supermarket: string;
  brand: string;
  shelfPrice: number;
  weight: number;
  pricePerGram: number;
  claims: string[];
  t2tPrice: number;
  priceAdvantage: string;
  createdAt: string;
}

// Helper to compute price advantage text
const calculatePriceAdvantageText = (shelfPrice: number, t2tPrice: number): string => {
  const sPrice = Number(shelfPrice);
  const tPrice = Number(t2tPrice);
  if (isNaN(sPrice) || isNaN(tPrice) || sPrice === 0) return "Eşit Fiyat";

  if (sPrice > tPrice) {
    const pct = ((sPrice - tPrice) / sPrice) * 100;
    return `%${pct.toFixed(0)} Daha Ucuz`;
  } else if (sPrice < tPrice) {
    const pct = ((tPrice - sPrice) / sPrice) * 100;
    return `%${pct.toFixed(0)} Daha Pahalı`;
  }
  return "Eşit Fiyat";
};

// Helper to compute price per gram
const calculatePricePerGram = (shelfPrice: number, weight: number): number => {
  const sPrice = Number(shelfPrice);
  const wVal = Number(weight);
  if (isNaN(sPrice) || isNaN(wVal) || wVal === 0) return 0;
  return sPrice / wVal;
};

// ----------------------------------------------------
// 1. ADMIN PANEL: CRUD MANAGEMENT BİLİŞENİ (FMCG)
// ----------------------------------------------------
export function MarketInsightsManagement({ currentProjectId }: { currentProjectId: string }) {
  const [insights, setInsights] = useState<MarketInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Sub tab control
  const [activeSubTab, setActiveSubTab] = useState<"benchmarking" | "cost-calculator">("benchmarking");

  // Cost fields configuration in Turkish as requested
  const costFields = [
    { key: "cogs", label: "Birim Üretim Maliyeti (Hammadde Kırılımları Dahil COGS)" },
    { key: "logistics", label: "Birim Başına Uluslararası ve Yurtiçi Lojistik Maliyeti" },
    { key: "importDuties", label: "Birim Başına İthalat Vergileri ve Gümrük Masrafları" },
    { key: "customsBroker", label: "Birim Başına Gümrük Müşavirliği Maliyeti" },
    { key: "additionalImport", label: "Birim Başına Ek İthalat Gereksinimleri" },
    { key: "borderProtection", label: "Birim Başına Gümrük ve Sınır Koruma Maliyeti" },
    { key: "storage", label: "Birim Başına Depolama Maliyeti" },
    { key: "fulfilment", label: "Birim Başına Sipariş Karşılama (Fulfillment) Maliyeti" },
    { key: "adminExpenses", label: "Birim Başına Yönetim Giderleri" },
    { key: "outsource", label: "Birim Başına Dış Kaynak (Outsource) Gideri" },
    { key: "returns", label: "Birim Başına Beklenen Ürün İade Maliyeti" },
    { key: "retailerOther", label: "Birim Başına Perakendeci Diğer Maliyetleri (Paketleme, Denetim vb.)" },
    { key: "marketing", label: "Birim Başına Pazarlama Bütçesi" },
    { key: "netProfit", label: "Birim Başına Net Kar" },
    { key: "brandMargin", label: "Birim Başına Perakendeci Marka Marjı" },
    { key: "frontMargin", label: "Birim Başına Perakendeci Raf Marjı" }
  ];

  const volumeFields = [
    { key: "salesForecast", label: "Proje Satış Tahmini (Adet/Hacim)" },
    { key: "containerCapacity", label: "1 Konteynere Yükleme Adeti" }
  ];

  const [costForm, setCostForm] = useState<Record<string, string>>({});
  const [packagingDetails, setPackagingDetails] = useState<any[]>([]);

  const handleAddPackagingRow = () => {
    setPackagingDetails([
      ...packagingDetails,
      {
        productVariant: "",
        singleWeight: "",
        packagingStyle: "",
        innerBoxCount: "",
        masterCartonCount: "",
        palletCartonCount: "",
        cartonNetWeight: "",
        cartonGrossWeight: "",
        cartonDimensions: "",
        totalGrossWeight: ""
      }
    ]);
  };

  const handleUpdatePackagingCell = (index: number, key: string, value: any) => {
    const updated = [...packagingDetails];
    updated[index] = { ...updated[index], [key]: value };
    setPackagingDetails(updated);
  };

  const handleDeletePackagingRow = (index: number) => {
    const updated = packagingDetails.filter((_, i) => i !== index);
    setPackagingDetails(updated);
  };

  // Listen to project document for cost breakdown
  useEffect(() => {
    if (!currentProjectId) return;
    const docRef = doc(db, "projects", currentProjectId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const breakdown = data.cost_breakdown || {};
        const form: Record<string, string> = {};

        // Load text fields
        form.buyerName = breakdown.buyerName || "";
        form.importCountry = breakdown.importCountry || "";
        form.hsCode = breakdown.hsCode || "";
        form.selectedIncoterm = breakdown.selectedIncoterm || "DDP";
        form.currency = breakdown.currency || "USD";
        form.totalFreightCost = breakdown.totalFreightCost !== undefined ? String(breakdown.totalFreightCost) : "";
        form.hsCodeTaxRate = breakdown.hsCodeTaxRate !== undefined ? String(breakdown.hsCodeTaxRate) : "";

        // Load volume fields
        volumeFields.forEach(f => {
          form[f.key] = breakdown[f.key] !== undefined ? String(breakdown[f.key]) : "";
        });

        // Load cost fields
        costFields.forEach(f => {
          form[f.key] = breakdown[f.key] !== undefined ? String(breakdown[f.key]) : "";
        });
        
        setCostForm(form);
        setPackagingDetails(data.packaging_details || []);
      }
    });
    return () => unsub();
  }, [currentProjectId]);

  const getIncludedKeysForIncoterm = (incoterm: string): string[] => {
    switch (incoterm) {
      case "EXW":
        return ["cogs", "adminExpenses", "outsource", "netProfit"];
      case "FOB":
        return ["cogs", "adminExpenses", "outsource", "netProfit", "customsBroker"];
      case "CIF":
        return ["cogs", "adminExpenses", "outsource", "netProfit", "customsBroker", "logistics"];
      case "DDP":
      default:
        return [
          "cogs", "logistics", "importDuties", "customsBroker", "additionalImport",
          "borderProtection", "storage", "fulfilment", "adminExpenses", "outsource",
          "returns", "retailerOther", "marketing", "netProfit", "brandMargin", "frontMargin"
        ];
    }
  };

  const selectedIncoterm = costForm.selectedIncoterm || "DDP";
  const includedKeys = getIncludedKeysForIncoterm(selectedIncoterm);

  const getCurrencySymbol = (curr: string): string => {
    switch (curr) {
      case "EUR": return "€";
      case "GBP": return "£";
      case "USD":
      default: return "$";
    }
  };

  const currencySymbol = getCurrencySymbol(costForm.currency || "USD");

  const handleUpdateTotalFreight = (val: string) => {
    const updatedForm = { ...costForm, totalFreightCost: val };
    const containerCap = Number(updatedForm.containerCapacity) || 0;
    const freightCost = Number(val) || 0;
    if (containerCap > 0) {
      updatedForm.logistics = (freightCost / containerCap).toFixed(2);
    }
    setCostForm(updatedForm);
  };

  const handleUpdateContainerCapacity = (val: string) => {
    const updatedForm = { ...costForm, containerCapacity: val };
    const containerCap = Number(val) || 0;
    const freightCost = Number(updatedForm.totalFreightCost) || 0;
    if (containerCap > 0) {
      updatedForm.logistics = (freightCost / containerCap).toFixed(2);
    }
    setCostForm(updatedForm);
  };

  const handleUpdateTaxRate = (val: string) => {
    const updatedForm = { ...costForm, hsCodeTaxRate: val };
    const cogs = Number(updatedForm.cogs) || 0;
    const taxRate = Number(val) || 0;
    updatedForm.importDuties = ((cogs * taxRate) / 100).toFixed(2);
    setCostForm(updatedForm);
  };

  const handleUpdateCogs = (val: string) => {
    const updatedForm = { ...costForm, cogs: val };
    const cogs = Number(val) || 0;
    const taxRate = Number(updatedForm.hsCodeTaxRate) || 0;
    updatedForm.importDuties = ((cogs * taxRate) / 100).toFixed(2);
    setCostForm(updatedForm);
  };

  const totalLandedCost = costFields.reduce((sum, f) => {
    if (!includedKeys.includes(f.key)) return sum;
    const val = Number(costForm[f.key]);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const handleSaveCosts = async () => {
    if (!currentProjectId) return;
    const breakdown: Record<string, any> = {};

    // Save text fields
    breakdown.buyerName = (costForm.buyerName || "").trim();
    breakdown.importCountry = (costForm.importCountry || "").trim();
    breakdown.hsCode = (costForm.hsCode || "").trim();
    breakdown.selectedIncoterm = costForm.selectedIncoterm || "DDP";
    breakdown.currency = costForm.currency || "USD";
    breakdown.totalFreightCost = costForm.totalFreightCost !== undefined && costForm.totalFreightCost !== "" ? Number(costForm.totalFreightCost) : 0;
    breakdown.hsCodeTaxRate = costForm.hsCodeTaxRate !== undefined && costForm.hsCodeTaxRate !== "" ? Number(costForm.hsCodeTaxRate) : 0;

    // Save volume fields
    volumeFields.forEach(f => {
      const val = Number(costForm[f.key]);
      breakdown[f.key] = isNaN(val) ? 0 : val;
    });

    // Save cost fields
    costFields.forEach(f => {
      const val = Number(costForm[f.key]);
      breakdown[f.key] = isNaN(val) ? 0 : val;
    });

    try {
      const docRef = doc(db, "projects", currentProjectId);
      const cleanPackagingDetails = packagingDetails.map(row => ({
        productVariant: (row.productVariant || "").trim(),
        singleWeight: row.singleWeight !== undefined && row.singleWeight !== "" ? Number(row.singleWeight) : 0,
        packagingStyle: (row.packagingStyle || "").trim(),
        innerBoxCount: row.innerBoxCount !== undefined && row.innerBoxCount !== "" ? Number(row.innerBoxCount) : 0,
        masterCartonCount: row.masterCartonCount !== undefined && row.masterCartonCount !== "" ? Number(row.masterCartonCount) : 0,
        palletCartonCount: row.palletCartonCount !== undefined && row.palletCartonCount !== "" ? Number(row.palletCartonCount) : 0,
        cartonNetWeight: row.cartonNetWeight !== undefined && row.cartonNetWeight !== "" ? Number(row.cartonNetWeight) : 0,
        cartonGrossWeight: row.cartonGrossWeight !== undefined && row.cartonGrossWeight !== "" ? Number(row.cartonGrossWeight) : 0,
        cartonDimensions: (row.cartonDimensions || "").trim(),
        totalGrossWeight: row.totalGrossWeight !== undefined && row.totalGrossWeight !== "" ? Number(row.totalGrossWeight) : 0
      }));

      await updateDoc(docRef, {
        cost_breakdown: breakdown,
        packaging_details: cleanPackagingDetails
      });
      showFeedback("💰 Proje kapasite ve maliyet tablosu başarıyla kaydedildi.");
    } catch (err) {
      console.error("Error saving cost breakdown:", err);
      showFeedback("Hata: Veriler kaydedilemedi.");
    }
  };

  // Form State
  const [supermarket, setSupermarket] = useState("");
  const [brand, setBrand] = useState("");
  const [shelfPrice, setShelfPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [t2tPrice, setT2tPrice] = useState("");
  const [claims, setClaims] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Calculated Preview
  const previewPricePerGram = calculatePricePerGram(Number(shelfPrice), Number(weight));
  const previewPriceAdvantage = calculatePriceAdvantageText(Number(shelfPrice), Number(t2tPrice));

  // Edit Mode State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSupermarket, setEditSupermarket] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editShelfPrice, setEditShelfPrice] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editT2tPrice, setEditT2tPrice] = useState("");
  const [editClaims, setEditClaims] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");

  // AI Matchmaker states
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<Record<string, string>>({});
  const [loadingAi, setLoadingAi] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!currentProjectId) return;
    const colRef = collection(db, "projects", currentProjectId, "manufacturers");
    const unsub = onSnapshot(colRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setManufacturers(list);
    });
    return () => unsub();
  }, [currentProjectId]);

  const handleGenerateAiMatch = async (competitor: MarketInsight) => {
    setLoadingAi(prev => ({ ...prev, [competitor.id]: true }));
    try {
      const res = await fetch("/api/ai/match-manufacturers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          competitor,
          manufacturers
        })
      });
      if (!res.ok) throw new Error("API request failed");
      const data = await res.json();
      setAiRecommendations(prev => ({ ...prev, [competitor.id]: data.recommendation }));
    } catch (err) {
      console.error("AI matchmaking failed:", err);
      alert("Yapay zeka eşleştirme önerisi oluşturulamadı.");
    } finally {
      setLoadingAi(prev => ({ ...prev, [competitor.id]: false }));
    }
  };

  // AI live shelf price search states
  const [showAiSearchPanel, setShowAiSearchPanel] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearchResults, setAiSearchResults] = useState<any[]>([]);
  const [loadingAiSearch, setLoadingAiSearch] = useState(false);

  const handleAiShelfPriceSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiSearchQuery.trim()) return;
    setLoadingAiSearch(true);
    setAiSearchResults([]);
    try {
      const res = await fetch("/api/ai/search-shelf-prices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ queryText: aiSearchQuery })
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setAiSearchResults(data.results || []);
    } catch (err) {
      console.error("AI shelf search failed:", err);
      showFeedback("Hata: Canlı raf fiyatı araştırması gerçekleştirilemedi.");
    } finally {
      setLoadingAiSearch(false);
    }
  };

  const handleAddAiResultToInsights = async (result: any) => {
    if (!currentProjectId) return;
    try {
      const subcollectionRef = collection(db, "projects", currentProjectId, "market_insights");
      const priceVal = Number(result.shelfPrice) || 0;
      const weightVal = Number(result.weight) || 1000;
      // Assume a default T2T price or a mock calculation
      const t2tVal = Number((priceVal * 0.7).toFixed(2)); // default 30% cheaper
      
      await addDoc(subcollectionRef, {
        supermarket: result.supermarket,
        brand: result.brand,
        shelfPrice: priceVal,
        weight: weightVal,
        pricePerGram: calculatePricePerGram(priceVal, weightVal),
        t2tPrice: t2tVal,
        priceAdvantage: calculatePriceAdvantageText(priceVal, t2tVal),
        claims: result.claims || [],
        createdAt: new Date().toISOString()
      });
      showFeedback(`✅ ${result.brand} (${result.supermarket}) başarıyla kıyaslama tablosuna eklendi.`);
    } catch (err) {
      console.error("Failed to add AI result to Firestore:", err);
      showFeedback("Hata: Kıyaslama kaydı eklenemedi.");
    }
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Real-time Firestore sync and auto-seeding
  useEffect(() => {
    if (!currentProjectId) return;
    setLoading(true);
    const subcollectionRef = collection(db, "projects", currentProjectId, "market_insights");
    const q = query(subcollectionRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Seed default competitor FMCG insights for this project
        const defaults = [
          {
            supermarket: "Costco Wholesale",
            brand: "Kirkland Signature Organic",
            shelfPrice: 12.99,
            weight: 1000,
            pricePerGram: 0.01299,
            claims: ["Organic", "Gluten Free", "No Preservatives"],
            t2tPrice: 9.50,
            priceAdvantage: "%27 Daha Ucuz",
            createdAt: new Date().toISOString()
          },
          {
            supermarket: "Tesco Extra",
            brand: "Tesco Finest Bakery",
            shelfPrice: 8.50,
            weight: 500,
            pricePerGram: 0.017,
            claims: ["Premium Quality", "Traditional Recipe"],
            t2tPrice: 6.80,
            priceAdvantage: "%20 Daha Ucuz",
            createdAt: new Date().toISOString()
          }
        ];
        try {
          for (const item of defaults) {
            await addDoc(subcollectionRef, item);
          }
        } catch (e) {
          console.error("Failed to seed FMCG subcollection insights:", e);
        }
      } else {
        const items: MarketInsight[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as MarketInsight));
        // Backward compatibility parsing
        const parsed = items.map(it => ({
          ...it,
          supermarket: it.supermarket || (it as any).competitorName || "Süpermarket",
          brand: it.brand || "Kendi Markası",
          shelfPrice: it.shelfPrice ?? (it as any).competitorPrice ?? 0,
          weight: it.weight ?? 1000,
          pricePerGram: it.pricePerGram ?? calculatePricePerGram(it.shelfPrice ?? (it as any).competitorPrice ?? 0, it.weight ?? 1000),
          t2tPrice: it.t2tPrice ?? (it as any).ourPrice ?? 0,
          priceAdvantage: it.priceAdvantage || calculatePriceAdvantageText(it.shelfPrice ?? (it as any).competitorPrice ?? 0, it.t2tPrice ?? (it as any).ourPrice ?? 0)
        }));
        setInsights(parsed);
        setLoading(false);
      }
    }, (err) => {
      console.error("Error reading market insights:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [currentProjectId]);

  // Add Tag Handlers
  const handleAddTag = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const val = tagInput.trim().replace(/,$/, "");
      if (val && !claims.includes(val)) {
        setClaims([...claims, val]);
      }
      setTagInput("");
    }
  };

  const handleAddTagClick = () => {
    if (tagInput.trim()) {
      const val = tagInput.trim();
      if (!claims.includes(val)) {
        setClaims([...claims, val]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (index: number) => {
    setClaims(claims.filter((_, i) => i !== index));
  };

  // Edit Tag Handlers
  const handleEditAddTag = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && editTagInput.trim()) {
      e.preventDefault();
      const val = editTagInput.trim().replace(/,$/, "");
      if (val && !editClaims.includes(val)) {
        setEditClaims([...editClaims, val]);
      }
      setEditTagInput("");
    }
  };

  const handleEditAddTagClick = () => {
    if (editTagInput.trim()) {
      const val = editTagInput.trim();
      if (!editClaims.includes(val)) {
        setEditClaims([...editClaims, val]);
      }
      setEditTagInput("");
    }
  };

  const handleEditRemoveTag = (index: number) => {
    setEditClaims(editClaims.filter((_, i) => i !== index));
  };

  // Add Action
  const handleCreateInsight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supermarket || !brand || !shelfPrice || !weight || !t2tPrice) {
      showFeedback("Hata: Lütfen zorunlu alanları doldurun.");
      return;
    }

    const priceVal = Number(shelfPrice);
    const weightVal = Number(weight);
    const t2tVal = Number(t2tPrice);

    try {
      const subcollectionRef = collection(db, "projects", currentProjectId, "market_insights");
      await addDoc(subcollectionRef, {
        supermarket: supermarket.trim(),
        brand: brand.trim(),
        shelfPrice: priceVal,
        weight: weightVal,
        pricePerGram: calculatePricePerGram(priceVal, weightVal),
        t2tPrice: t2tVal,
        priceAdvantage: calculatePriceAdvantageText(priceVal, t2tVal),
        claims: claims,
        createdAt: new Date().toISOString()
      });

      // Reset
      setSupermarket("");
      setBrand("");
      setShelfPrice("");
      setWeight("");
      setT2tPrice("");
      setClaims([]);
      showFeedback("🎉 FMCG rekabet analiz verisi başarıyla eklendi.");
    } catch (err) {
      console.error("Failed to add insight:", err);
      showFeedback("Hata: Kayıt eklenemedi.");
    }
  };

  // Delete Action
  const handleDeleteInsight = async (id: string) => {
    if (!window.confirm("Bu rakip analiz kaydını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try {
      const docRef = doc(db, "projects", currentProjectId, "market_insights", id);
      await deleteDoc(docRef);
      showFeedback("🗑️ Kayıt başarıyla silindi.");
    } catch (err) {
      console.error("Failed to delete insight:", err);
      showFeedback("Hata: Kayıt silinemedi.");
    }
  };

  // Start Edit
  const startEdit = (item: MarketInsight) => {
    setEditingId(item.id);
    setEditSupermarket(item.supermarket);
    setEditBrand(item.brand);
    setEditShelfPrice(String(item.shelfPrice));
    setEditWeight(String(item.weight));
    setEditT2tPrice(String(item.t2tPrice));
    setEditClaims(item.claims || []);
    setEditTagInput("");
  };

  // Save Edit
  const saveEdit = async (id: string) => {
    if (!editSupermarket || !editBrand || !editShelfPrice || !editWeight || !editT2tPrice) {
      showFeedback("Hata: Lütfen tüm alanları doldurun.");
      return;
    }
    const priceVal = Number(editShelfPrice);
    const weightVal = Number(editWeight);
    const t2tVal = Number(editT2tPrice);

    try {
      const docRef = doc(db, "projects", currentProjectId, "market_insights", id);
      await updateDoc(docRef, {
        supermarket: editSupermarket.trim(),
        brand: editBrand.trim(),
        shelfPrice: priceVal,
        weight: weightVal,
        pricePerGram: calculatePricePerGram(priceVal, weightVal),
        t2tPrice: t2tVal,
        priceAdvantage: calculatePriceAdvantageText(priceVal, t2tVal),
        claims: editClaims
      });
      setEditingId(null);
      showFeedback("💾 Değişiklikler başarıyla kaydedildi.");
    } catch (err) {
      console.error("Failed to save insight:", err);
      showFeedback("Hata: Kaydedilemedi.");
    }
  };

  return (
    <div className="space-y-6">
      
      {feedback && (
        <div className="p-3.5 bg-slate-900 border border-teal-500/30 text-teal-400 text-xs font-semibold rounded-2xl flex justify-between items-center font-mono">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}

      {/* Sub tabs selector */}
      <div className="flex border-b border-slate-200 gap-1 select-none">
        <button
          type="button"
          onClick={() => setActiveSubTab("benchmarking")}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            activeSubTab === "benchmarking"
              ? "border-b-2 border-navy text-navy font-black"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          🔍 Rakip Fiyat Kıyaslama (Benchmarking)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("cost-calculator")}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            activeSubTab === "cost-calculator"
              ? "border-b-2 border-navy text-navy font-black"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          🧮 Birim Maliyet Hesaplama Tablosu
        </button>
      </div>

      {activeSubTab === "benchmarking" ? (
        <div className="space-y-6">
          {/* AI LIVE SHELF PRICE SEARCH PANEL */}
          <div className="bg-gradient-to-r from-blue-900/10 via-cyan-950/5 to-transparent border border-blue-100 p-5 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">✨</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">AI Canlı Raf Fiyatı Araştırması</h4>
                  <p className="text-[10px] text-slate-550 leading-normal">Gemini Google Search Grounding ile süpermarketlerin güncel fiziksel mağaza raf fiyatlarını tarayın.</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAiSearchPanel(!showAiSearchPanel)} 
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 font-mono bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200/50 cursor-pointer transition select-none self-start md:self-auto"
              >
                {showAiSearchPanel ? "Kapat" : "Araştırma Panelini Aç"}
              </button>
            </div>

            {showAiSearchPanel && (
              <div className="space-y-4 pt-2 border-t border-slate-200/60">
                <form onSubmit={handleAiShelfPriceSearch} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="örn. İngiltere supermarket tortilla fiyatları, UK high protein wrap shelf prices..."
                    value={aiSearchQuery}
                    onChange={(e) => setAiSearchQuery(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-850 focus:outline-none focus:border-navy transition font-medium placeholder-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={loadingAiSearch}
                    className="bg-navy hover:bg-navy-light text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer select-none font-mono shrink-0"
                  >
                    {loadingAiSearch ? "Taranıyor..." : "Arama Yap"}
                  </button>
                </form>

                {loadingAiSearch && (
                  <div className="py-8 text-center text-xs text-slate-400 font-mono">
                    🔎 Fiziksel mağaza raf fiyatı verileri Google Arama üzerinde aranıyor ve analiz ediliyor...
                  </div>
                )}

                {!loadingAiSearch && aiSearchResults.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {aiSearchResults.map((result, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-sm hover:border-blue-300/80 transition-all">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider block">{result.supermarket}</span>
                              <span className="text-xs font-extrabold text-slate-850 block">{result.brand}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-slate-800 font-mono block">${Number(result.shelfPrice).toFixed(2)}</span>
                              <span className="text-[9px] text-slate-450 font-mono block">{result.weight} gr</span>
                            </div>
                          </div>
                          {result.claims && result.claims.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {result.claims.map((c: string, cIdx: number) => (
                                <span key={cIdx} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-bold rounded">
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddAiResultToInsights(result)}
                          className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] py-2 rounded-xl transition cursor-pointer font-mono text-center flex items-center justify-center gap-1"
                        >
                          📥 Kıyaslama Tablosuna Ekle
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* ADD FORM */}
          <form onSubmit={handleCreateInsight} className="xl:col-span-4 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4 h-fit">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase font-mono tracking-wider">
              <Plus className="h-4.5 w-4.5 text-navy" /> Perakende Fiyat Kıyaslama Kaydı Ekle
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Süpermarket (Zincir)</label>
              <input
                type="text"
                required
                placeholder="örn., Costco Wholesale"
                value={supermarket}
                onChange={(e) => setSupermarket(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy focus:bg-white transition font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Marka (Brand)</label>
              <input
                type="text"
                required
                placeholder="örn., Kirkland Signature"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy focus:bg-white transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Raf Fiyatı ($ / €)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={shelfPrice}
                  onChange={(e) => setShelfPrice(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy focus:bg-white transition font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gramaj (gr)</label>
                <input
                  type="number"
                  required
                  placeholder="örn. 1000"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy focus:bg-white transition font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Bizim T2T Fiyatımız ($ / €)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={t2tPrice}
                onChange={(e) => setT2tPrice(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy focus:bg-white transition font-mono font-semibold"
              />
            </div>

            {/* Calculations Preview */}
            {previewPricePerGram > 0 && (
              <div className="p-3.5 bg-slate-55 border border-slate-200 rounded-xl space-y-1.5 text-[11px] font-mono leading-none">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gram Fiyatı:</span>
                  <span className="text-slate-800 font-bold">${previewPricePerGram.toFixed(4)} /gr</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-1.5 mt-1.5">
                  <span className="text-slate-500">T2T Fiyat Avantajı:</span>
                  <span className={`font-black ${Number(shelfPrice) > Number(t2tPrice) ? "text-emerald-600" : "text-rose-600"}`}>
                    {previewPriceAdvantage}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                Üründeki İddialar / Özellikler
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Yazıp Enter'a basın..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="flex-1 p-2.5 bg-slate-50 border rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={handleAddTagClick}
                  className="px-3 bg-slate-100 hover:bg-slate-200 border rounded-xl text-xs font-bold text-slate-700 transition"
                >
                  Ekle
                </button>
              </div>
              
              {claims.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {claims.map((tag, idx) => (
                    <span 
                      key={idx} 
                      className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/25 text-teal-700 text-[10px] font-bold rounded-lg flex items-center gap-1 font-sans"
                    >
                      {tag}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveTag(idx)} 
                        className="text-red-500 hover:text-red-700 font-bold font-sans"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-navy hover:bg-navy-light text-white font-semibold text-xs py-3 rounded-xl transition cursor-pointer shadow-sm mt-3"
            >
              Kıyaslama Kaydını Ekle
            </button>
          </div>
        </form>

        {/* LIST / GRID VIEW */}
        <div className="xl:col-span-8 space-y-4 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <Shield className="h-5 w-5 text-navy" />
            <h3 className="text-base font-bold text-slate-900 font-display">Kayıtlı Rekabet Analizi & Benchmarking</h3>
          </div>

          {loading ? (
            <div className="text-xs text-slate-500 py-12 text-center font-mono">Pazar verileri yükleniyor...</div>
          ) : insights.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-xs text-slate-500 italic">
              Bu proje için henüz girilmiş bir fiyat kıyaslaması bulunmamaktadır.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-3xl shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono uppercase tracking-wider text-[10px]">
                    <th className="p-4">Market</th>
                    <th className="p-4">Marka</th>
                    <th className="p-4">Ürün İddiaları</th>
                    <th className="p-4">Raf Fiyatı</th>
                    <th className="p-4">Gramaj</th>
                    <th className="p-4">Gram Fiyatı</th>
                    <th className="p-4 bg-teal-500/5 text-teal-800 font-extrabold border-x border-slate-200/60">T2T Fiyatı</th>
                    <th className="p-4 bg-teal-500/10 text-teal-700 font-extrabold border-r border-slate-200/60">Fiyat Avantajı</th>
                    <th className="p-4 text-right">Eylemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {insights.map(item => {
                    const isEditing = editingId === item.id;
                    const hasAdvantage = item.shelfPrice > item.t2tPrice;

                    if (isEditing) {
                      return (
                        <tr key={item.id} className="bg-slate-50/50">
                          <td className="p-3" colSpan={3}>
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={editSupermarket}
                                  onChange={(e) => setEditSupermarket(e.target.value)}
                                  className="p-2 border rounded-lg text-xs"
                                  placeholder="Market"
                                />
                                <input
                                  type="text"
                                  value={editBrand}
                                  onChange={(e) => setEditBrand(e.target.value)}
                                  className="p-2 border rounded-lg text-xs"
                                  placeholder="Marka"
                                />
                              </div>
                              <div className="flex flex-wrap gap-1">
                                <input
                                  type="text"
                                  value={editTagInput}
                                  onChange={(e) => setEditTagInput(e.target.value)}
                                  onKeyDown={handleEditAddTag}
                                  className="p-1.5 border rounded-lg text-xs w-28"
                                  placeholder="İddia ekle..."
                                />
                                {editClaims.map((tag, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 bg-teal-55 text-teal-700 rounded text-[10px] flex items-center gap-1">
                                    {tag}
                                    <button type="button" onClick={() => handleEditRemoveTag(idx)} className="text-red-500 font-bold">✕</button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              step="0.01"
                              value={editShelfPrice}
                              onChange={(e) => setEditShelfPrice(e.target.value)}
                              className="p-1.5 border rounded-lg text-xs w-16 font-mono"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={editWeight}
                              onChange={(e) => setEditWeight(e.target.value)}
                              className="p-1.5 border rounded-lg text-xs w-16 font-mono"
                            />
                          </td>
                          <td className="p-3 font-mono text-slate-400">
                            ${calculatePricePerGram(Number(editShelfPrice), Number(editWeight)).toFixed(4)}
                          </td>
                          <td className="p-3 bg-teal-500/5 border-x border-slate-200/60">
                            <input
                              type="number"
                              step="0.01"
                              value={editT2tPrice}
                              onChange={(e) => setEditT2tPrice(e.target.value)}
                              className="p-1.5 border rounded-lg text-xs w-16 font-mono font-bold"
                            />
                          </td>
                          <td className="p-3 bg-teal-500/10 border-r border-slate-200/60 font-mono font-bold text-teal-800 text-[10px]">
                            {calculatePriceAdvantageText(Number(editShelfPrice), Number(editT2tPrice))}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => setEditingId(null)} className="p-1 border rounded hover:bg-white" title="İptal"><X className="h-3.5 w-3.5" /></button>
                              <button onClick={() => saveEdit(item.id)} className="p-1 bg-navy text-white rounded hover:bg-navy-light" title="Kaydet"><Check className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-slate-50/50 transition">
                          <td className="p-4 font-bold text-slate-800">{item.supermarket}</td>
                          <td className="p-4 text-slate-600 font-medium">{item.brand}</td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {item.claims?.map((tag, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 font-mono text-slate-700">${item.shelfPrice.toFixed(2)}</td>
                          <td className="p-4 font-mono text-slate-500">{item.weight} gr</td>
                          <td className="p-4 font-mono text-slate-400">${item.pricePerGram.toFixed(4)} /gr</td>
                          <td className="p-4 bg-teal-500/5 font-extrabold font-mono text-teal-700 border-x border-slate-200/60 text-sm">
                            ${item.t2tPrice.toFixed(2)}
                          </td>
                          <td className={`p-4 bg-teal-500/10 font-black font-mono border-r border-slate-200/60 text-sm ${
                            hasAdvantage ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            {item.priceAdvantage}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex gap-1.5 justify-end items-center">
                              <button
                                type="button"
                                onClick={() => handleGenerateAiMatch(item)}
                                disabled={loadingAi[item.id]}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-bold rounded-lg transition flex items-center gap-1 font-mono cursor-pointer"
                                title="Yapay Zeka Fırsat Analizi"
                              >
                                {loadingAi[item.id] ? "Analiz..." : "✨ AI Analizi"}
                              </button>
                              <button onClick={() => startEdit(item)} className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition cursor-pointer" title="Düzenle"><Edit2 className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleDeleteInsight(item.id)} className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition cursor-pointer" title="Sil"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                        {aiRecommendations[item.id] && (
                          <tr className="bg-blue-50/40 border-b border-slate-200">
                            <td colSpan={9} className="p-4 text-xs">
                              <div className="flex items-start gap-2.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-black font-mono uppercase bg-blue-900/10 border border-blue-800/20 text-blue-700 rounded-lg shrink-0">
                                  ✨ Yapay Zeka Önerisi
                                </span>
                                <span className="font-semibold text-slate-700 leading-relaxed font-sans">
                                  {aiRecommendations[item.id]}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          </div>

          </div>

        </div>
      ) : (
        /* Cost Calculator Sub-Tab View */
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <DollarSign className="h-5 w-5 text-navy" />
            <h3 className="text-base font-bold text-slate-900 font-display">Proje Kapasite ve Birim Maliyet Hesaplama Modülü</h3>
          </div>

          {/* BÖLÜM 1: Proje Hacim ve Kapasite (Üst Kısım) */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono tracking-wider">
                Bölüm 1: Proje Hacim ve Kapasite
              </h4>
              
              {/* Currency Selector */}
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm select-none">
                <span className="text-[9px] font-bold text-slate-405 font-mono uppercase px-2">Para Birimi:</span>
                {["USD", "EUR", "GBP"].map((curr) => {
                  const symbol = curr === "USD" ? "$" : curr === "EUR" ? "€" : "£";
                  const isActive = (costForm.currency || "USD") === curr;
                  return (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setCostForm({ ...costForm, currency: curr })}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer font-mono ${
                        isActive
                          ? "bg-navy text-white shadow-sm"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      }`}
                    >
                      {curr} ({symbol})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Alıcı Adı / Firma */}
              <div className="space-y-1.5 font-sans md:col-span-3">
                <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide">
                  Alıcı Adı / Firma
                </label>
                <input
                  type="text"
                  placeholder="örn. Lüks Yaşam A.Ş."
                  value={costForm.buyerName || ""}
                  onChange={(e) => {
                    setCostForm({
                      ...costForm,
                      buyerName: e.target.value
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy transition font-semibold"
                />
              </div>

              {/* İthalat Ülkesi */}
              <div className="space-y-1.5 font-sans md:col-span-3">
                <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide">
                  İthalat Ülkesi
                </label>
                <input
                  type="text"
                  placeholder="örn. İngiltere"
                  value={costForm.importCountry || ""}
                  onChange={(e) => {
                    setCostForm({
                      ...costForm,
                      importCountry: e.target.value
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy transition font-semibold"
                />
              </div>

              {/* HS Code (GTİP) */}
              <div className="space-y-1.5 font-sans md:col-span-3">
                <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide">
                  HS Code (GTİP)
                </label>
                <input
                  type="text"
                  placeholder="örn. 1905.90"
                  value={costForm.hsCode || ""}
                  onChange={(e) => {
                    setCostForm({
                      ...costForm,
                      hsCode: e.target.value
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy transition font-semibold font-mono"
                />
              </div>

              {/* Gümrük Vergisi Oranı (%) */}
              <div className="space-y-1.5 font-sans md:col-span-3">
                <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide">
                  Gümrük Vergisi Oranı (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="örn. 8"
                    value={costForm.hsCodeTaxRate || ""}
                    onChange={(e) => handleUpdateTaxRate(e.target.value)}
                    className="w-full pr-8 pl-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy transition font-mono font-semibold"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 font-mono text-xs font-bold">%</span>
                </div>
              </div>

              {/* Proje Satış Tahmini */}
              <div className="space-y-1.5 font-sans md:col-span-4">
                <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide">
                  Proje Satış Tahmini (Adet/Hacim)
                </label>
                <input
                  type="number"
                  placeholder="örn. 10000"
                  value={costForm.salesForecast || ""}
                  onChange={(e) => {
                    setCostForm({
                      ...costForm,
                      salesForecast: e.target.value
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy transition font-mono font-semibold"
                />
              </div>

              {/* 1 Konteynere Yükleme Adeti */}
              <div className="space-y-1.5 font-sans md:col-span-4">
                <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide">
                  1 Konteynere Yükleme Adeti
                </label>
                <input
                  type="number"
                  placeholder="örn. 1000"
                  value={costForm.containerCapacity || ""}
                  onChange={(e) => handleUpdateContainerCapacity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy transition font-mono font-semibold"
                />
              </div>

              {/* Toplam Uluslararası Navlun Bedeli */}
              <div className="space-y-1.5 font-sans md:col-span-4">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide">
                    Toplam Navlun Bedeli
                  </label>
                  <span className="text-[8px] font-bold font-mono text-cyan-600 bg-cyan-50 px-1.5 py-0.2 rounded uppercase">
                    Birim Oto-Hesaplar
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-xs">{currencySymbol}</span>
                  <input
                    type="number"
                    placeholder="örn. 4500"
                    value={costForm.totalFreightCost || ""}
                    onChange={(e) => handleUpdateTotalFreight(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy transition font-mono font-semibold"
                  />
                </div>
              </div>

            </div>
          </div>

          <hr className="border-slate-200/80 my-2" />

          {/* Incoterms Selector */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase font-mono tracking-wider">
                Teslim Şekli (Incoterm) Seçimi:
              </span>
              <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200/50 uppercase font-bold">
                Otomatik Hesaplama Aktif
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {["EXW", "FOB", "CIF", "DDP"].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setCostForm({ ...costForm, selectedIncoterm: term })}
                  className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer font-mono border ${
                    selectedIncoterm === term
                      ? "bg-navy text-white border-navy shadow-md scale-[1.02]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-350 hover:bg-slate-50"
                  }`}
                >
                  {term}
                </button>
              ))}
            </div>
            
            <div className="text-[10px] text-slate-500 font-sans leading-relaxed pt-1 flex flex-col gap-1">
              {selectedIncoterm === "EXW" && (
                <p>🔹 <strong>EXW:</strong> Sadece Birim Üretim Maliyeti (COGS), Yönetim Giderleri, Dış Kaynak Giderleri ve Net Kar dahildir. Lojistik ve gümrük maliyetleri alıcıya aittir.</p>
              )}
              {selectedIncoterm === "FOB" && (
                <p>🔹 <strong>FOB:</strong> EXW maliyetlerine ek olarak Türkiye Gümrük Müşavirliği maliyeti dahildir. Uluslararası nakliye ve ithalat işlemleri alıcıya aittir.</p>
              )}
              {selectedIncoterm === "CIF" && (
                <p>🔹 <strong>CIF:</strong> FOB maliyetlerine ek olarak Uluslararası Lojistik/Navlun maliyeti dahildir. İthalat vergileri ve gümrük çekim işlemleri alıcıya aittir.</p>
              )}
              {selectedIncoterm === "DDP" && (
                <p>🔹 <strong>DDP:</strong> Tüm maliyetler (Lojistik, İthalat Vergileri, Gümrük Çekimi, Sınır Koruma, Depolama, Sipariş Karşılama, Perakendeci Marjları, İade ve Pazarlama Giderleri) dahildir. Alıcı için tam kapı teslim fiyatıdır.</p>
              )}
            </div>
          </div>

          <hr className="border-slate-200/80 my-2" />

          {/* BÖLÜM 2: Birim Maliyet Kırılımları (Alt Kısım) */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase font-mono tracking-wider">
              Bölüm 2: Birim Maliyet Kırılımları
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {costFields.map((f) => {
                const isIncluded = includedKeys.includes(f.key);
                return (
                  <div key={f.key} className={`space-y-1.5 font-sans transition-all duration-200 ${!isIncluded ? "opacity-40" : ""}`}>
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wide">
                        {f.label}
                      </label>
                      {!isIncluded && (
                        <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded uppercase">
                          Hariç ({selectedIncoterm})
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-xs">{currencySymbol}</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={costForm[f.key] || ""}
                        onChange={(e) => {
                          if (f.key === "cogs") {
                            handleUpdateCogs(e.target.value);
                          } else {
                            setCostForm({
                              ...costForm,
                              [f.key]: e.target.value
                            });
                          }
                        }}
                        className={`w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy focus:bg-white transition font-mono ${
                          !isIncluded ? "bg-slate-100 border-slate-200 text-slate-400" : ""
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200/80 my-2" />

          {/* BÖLÜM 3: ÜRÜN VE PAKETLEME KONFİGÜRASYONU */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono tracking-wider">
                Bölüm 3: Ürün ve Paketleme Konfigürasyonu
              </h4>
              <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200/50 uppercase font-bold">
                Dinamik Varyantlar
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
              <table className="w-full text-left border-collapse min-w-[1400px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 align-middle">
                    <th className="p-3 text-[10px] font-bold text-slate-550 uppercase tracking-wider text-left align-middle whitespace-nowrap min-w-[150px]">Ürün adı / Varyant</th>
                    <th className="p-3 text-[10px] font-bold text-slate-550 uppercase tracking-wider text-left align-middle whitespace-nowrap min-w-[120px]">Tekli Ürün Ağırlığı</th>
                    <th className="p-3 text-[10px] font-bold text-slate-550 uppercase tracking-wider text-left align-middle whitespace-nowrap min-w-[140px]">Paketleme biçimi</th>
                    <th className="p-3 text-[10px] font-bold text-slate-550 uppercase tracking-wider text-left align-middle whitespace-nowrap min-w-[180px]">Küçük ambalaj içindeki ürün adeti</th>
                    <th className="p-3 text-[10px] font-bold text-slate-550 uppercase tracking-wider text-left align-middle whitespace-nowrap min-w-[180px]">Büyük koli içindeki paket adeti</th>
                    <th className="p-3 text-[10px] font-bold text-slate-550 uppercase tracking-wider text-left align-middle whitespace-nowrap min-w-[160px]">Palet içindeki koli adeti</th>
                    <th className="p-3 text-[10px] font-bold text-slate-550 uppercase tracking-wider text-left align-middle whitespace-nowrap min-w-[120px]">Koli net ağırlığı</th>
                    <th className="p-3 text-[10px] font-bold text-slate-550 uppercase tracking-wider text-left align-middle whitespace-nowrap min-w-[120px]">Koli bürüt ağırlığı</th>
                    <th className="p-3 text-[10px] font-bold text-slate-550 uppercase tracking-wider text-left align-middle whitespace-nowrap min-w-[140px]">Koli ölçüleri</th>
                    <th className="p-3 text-[10px] font-bold text-slate-550 uppercase tracking-wider text-left align-middle whitespace-nowrap min-w-[160px]">Toplam gross ürün ağırlığı</th>
                    <th className="p-3 text-[10px] font-bold text-slate-555 uppercase tracking-wider text-left align-middle w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {packagingDetails.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-xs text-slate-400 font-medium">
                        Henüz paketleme varyantı eklenmemiş. Aşağıdaki butondan yeni satır ekleyebilirsiniz.
                      </td>
                    </tr>
                  ) : (
                    packagingDetails.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="örn. Tortilla 25cm"
                            value={row.productVariant || ""}
                            onChange={(e) => handleUpdatePackagingCell(idx, "productVariant", e.target.value)}
                            className="w-full px-2 py-1.5 bg-transparent border-0 rounded focus:outline-none focus:bg-slate-100/70 transition font-medium focus:ring-1 focus:ring-slate-350 text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.001"
                            placeholder="0.000"
                            value={row.singleWeight || ""}
                            onChange={(e) => handleUpdatePackagingCell(idx, "singleWeight", e.target.value)}
                            className="w-full px-2 py-1.5 bg-transparent border-0 rounded focus:outline-none focus:bg-slate-100/70 transition font-mono focus:ring-1 focus:ring-slate-350 text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="örn. Oluklu Koli"
                            value={row.packagingStyle || ""}
                            onChange={(e) => handleUpdatePackagingCell(idx, "packagingStyle", e.target.value)}
                            className="w-full px-2 py-1.5 bg-transparent border-0 rounded focus:outline-none focus:bg-slate-100/70 transition font-medium focus:ring-1 focus:ring-slate-350 text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            placeholder="0"
                            value={row.innerBoxCount || ""}
                            onChange={(e) => handleUpdatePackagingCell(idx, "innerBoxCount", e.target.value)}
                            className="w-full px-2 py-1.5 bg-transparent border-0 rounded focus:outline-none focus:bg-slate-100/70 transition font-mono focus:ring-1 focus:ring-slate-350 text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            placeholder="0"
                            value={row.masterCartonCount || ""}
                            onChange={(e) => handleUpdatePackagingCell(idx, "masterCartonCount", e.target.value)}
                            className="w-full px-2 py-1.5 bg-transparent border-0 rounded focus:outline-none focus:bg-slate-100/70 transition font-mono focus:ring-1 focus:ring-slate-350 text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            placeholder="0"
                            value={row.palletCartonCount || ""}
                            onChange={(e) => handleUpdatePackagingCell(idx, "palletCartonCount", e.target.value)}
                            className="w-full px-2 py-1.5 bg-transparent border-0 rounded focus:outline-none focus:bg-slate-100/70 transition font-mono focus:ring-1 focus:ring-slate-350 text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={row.cartonNetWeight || ""}
                            onChange={(e) => handleUpdatePackagingCell(idx, "cartonNetWeight", e.target.value)}
                            className="w-full px-2 py-1.5 bg-transparent border-0 rounded focus:outline-none focus:bg-slate-100/70 transition font-mono focus:ring-1 focus:ring-slate-350 text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={row.cartonGrossWeight || ""}
                            onChange={(e) => handleUpdatePackagingCell(idx, "cartonGrossWeight", e.target.value)}
                            className="w-full px-2 py-1.5 bg-transparent border-0 rounded focus:outline-none focus:bg-slate-100/70 transition font-mono focus:ring-1 focus:ring-slate-350 text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="örn. 40x30x20 cm"
                            value={row.cartonDimensions || ""}
                            onChange={(e) => handleUpdatePackagingCell(idx, "cartonDimensions", e.target.value)}
                            className="w-full px-2 py-1.5 bg-transparent border-0 rounded focus:outline-none focus:bg-slate-100/70 transition font-mono focus:ring-1 focus:ring-slate-350 text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={row.totalGrossWeight || ""}
                            onChange={(e) => handleUpdatePackagingCell(idx, "totalGrossWeight", e.target.value)}
                            className="w-full px-2 py-1.5 bg-transparent border-0 rounded focus:outline-none focus:bg-slate-100/70 transition font-mono focus:ring-1 focus:ring-slate-350 text-xs text-slate-800 text-center"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeletePackagingRow(idx)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-start">
              <button
                type="button"
                onClick={handleAddPackagingRow}
                className="flex items-center gap-1.5 border border-dashed border-slate-300 hover:border-navy bg-white hover:bg-slate-50 text-slate-600 hover:text-navy px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Yeni Paketleme Varyantı Ekle
              </button>
            </div>
          </div>

          <hr className="border-slate-200/80 my-2" />

          {/* Landed shelf price sum box */}
          <div className="bg-emerald-50 border border-emerald-250/80 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-2 select-none shadow-sm mt-6">
            <div>
              <span className="text-[10px] text-emerald-800 font-extrabold uppercase font-mono tracking-widest block">
                {selectedIncoterm === "DDP" ? "GENEL TOPLAM BİRİM MALİYET" : `TEKLİF EDİLEN BİRİM ${selectedIncoterm} FİYATI`}
              </span>
              <span className="text-xs text-emerald-600 font-mono">
                {selectedIncoterm === "EXW" && "EXW Fabrika Teslim Fiyatı"}
                {selectedIncoterm === "FOB" && "FOB Liman Teslim Fiyatı"}
                {selectedIncoterm === "CIF" && "CIF Varış Limanı Teslim Fiyatı"}
                {selectedIncoterm === "DDP" && "DDP Gümrük Ödenmiş Kapı Teslim Fiyatı"}
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-700 font-mono">
              {currencySymbol}{totalLandedCost.toFixed(2)}
            </div>
          </div>

          {/* Action button */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSaveCosts}
              className="bg-navy hover:bg-navy-light text-white font-semibold text-xs px-6 py-3 rounded-xl transition cursor-pointer shadow-sm"
            >
              Tüm Verileri Kaydet
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ----------------------------------------------------
// 2. FREELANCER PORTAL: READ ONLY VIEW BİLİŞENİ (FMCG)
// ----------------------------------------------------
export function MarketInsightsView({ currentProjectId }: { currentProjectId: string }) {
  const [insights, setInsights] = useState<MarketInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<Record<string, string>>({});
  const [loadingAi, setLoadingAi] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!currentProjectId) return;
    const colRef = collection(db, "projects", currentProjectId, "manufacturers");
    const unsub = onSnapshot(colRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setManufacturers(list);
    });
    return () => unsub();
  }, [currentProjectId]);

  const handleGenerateAiMatch = async (competitor: MarketInsight) => {
    setLoadingAi(prev => ({ ...prev, [competitor.id]: true }));
    try {
      const res = await fetch("/api/ai/match-manufacturers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          competitor,
          manufacturers
        })
      });
      if (!res.ok) throw new Error("API request failed");
      const data = await res.json();
      setAiRecommendations(prev => ({ ...prev, [competitor.id]: data.recommendation }));
    } catch (err) {
      console.error("AI matchmaking failed:", err);
      alert("Yapay zeka eşleştirme önerisi oluşturulamadı.");
    } finally {
      setLoadingAi(prev => ({ ...prev, [competitor.id]: false }));
    }
  };

  // Real-time Firestore sync
  useEffect(() => {
    if (!currentProjectId) return;
    setLoading(true);
    const subcollectionRef = collection(db, "projects", currentProjectId, "market_insights");
    const q = query(subcollectionRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const items: MarketInsight[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MarketInsight));
      // Backward compatibility parsing
      const parsed = items.map(it => ({
        ...it,
        supermarket: it.supermarket || (it as any).competitorName || "Süpermarket",
        brand: it.brand || "Kendi Markası",
        shelfPrice: it.shelfPrice ?? (it as any).competitorPrice ?? 0,
        weight: it.weight ?? 1000,
        pricePerGram: it.pricePerGram ?? calculatePricePerGram(it.shelfPrice ?? (it as any).competitorPrice ?? 0, it.weight ?? 1000),
        t2tPrice: it.t2tPrice ?? (it as any).ourPrice ?? 0,
        priceAdvantage: it.priceAdvantage || calculatePriceAdvantageText(it.shelfPrice ?? (it as any).competitorPrice ?? 0, it.t2tPrice ?? (it as any).ourPrice ?? 0)
      }));
      setInsights(parsed);
      setLoading(false);
    }, (err) => {
      console.error("Error reading market insights for freelancer:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [currentProjectId]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-xs text-slate-400 font-mono">
        Pazar araştırmaları ve perakende kıyaslama verileri yükleniyor...
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-xs text-slate-500 italic">
        Bu proje için henüz kaydedilmiş bir pazar araştırması bulunmamaktadır. Veriler admin tarafından yüklendiğinde burada listelenecektir.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Globe className="h-5 w-5 text-teal-400" />
        <h3 className="text-base font-black text-white uppercase tracking-wider font-mono">Perakende Pazar Kıyaslaması (FMCG Benchmarking)</h3>
      </div>

      {/* Read-only Table */}
      <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-500 font-mono uppercase tracking-wider text-[10px]">
                <th className="p-4">Market</th>
                <th className="p-4">Marka</th>
                <th className="p-4">Ürün İddiaları</th>
                <th className="p-4 font-mono">Raf Fiyatı</th>
                <th className="p-4 font-mono">Gramaj</th>
                <th className="p-4 font-mono">Gram Fiyatı</th>
                <th className="p-4 bg-teal-500/5 text-teal-400 font-extrabold border-x border-slate-800">T2T Fiyatı</th>
                <th className="p-4 bg-teal-500/10 text-teal-300 font-extrabold border-r border-slate-800">Fiyat Avantajı</th>
                <th className="p-4 text-right">Eylem</th>
              </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {insights.map(item => {
              const hasAdvantage = item.shelfPrice > item.t2tPrice;
              return (
                <React.Fragment key={item.id}>
                  <tr className="hover:bg-slate-850/40 transition">
                    <td className="p-4 font-bold text-white text-sm">{item.supermarket}</td>
                    <td className="p-4 text-slate-300 font-medium">{item.brand}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {item.claims?.map((tag, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[9px] font-bold rounded flex items-center gap-1 font-sans">
                            <Award className="h-3 w-3 text-slate-500" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-slate-300">${item.shelfPrice.toFixed(2)}</td>
                    <td className="p-4 font-mono text-slate-400">{item.weight} gr</td>
                    <td className="p-4 font-mono text-slate-500">${item.pricePerGram.toFixed(4)} /gr</td>
                    <td className="p-4 bg-teal-500/5 font-extrabold font-mono text-teal-400 border-x border-slate-800 text-sm">
                      ${item.t2tPrice.toFixed(2)}
                    </td>
                    <td className={`p-4 bg-teal-500/10 font-black font-mono border-r border-slate-800 text-sm ${
                      hasAdvantage ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {item.priceAdvantage}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleGenerateAiMatch(item)}
                        disabled={loadingAi[item.id]}
                        className="px-2.5 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-450 text-[10px] font-bold rounded-lg transition flex items-center gap-1 font-mono cursor-pointer"
                        title="Yapay Zeka Fırsat Analizi"
                      >
                        {loadingAi[item.id] ? "Analiz..." : "✨ AI Analizi"}
                      </button>
                    </td>
                  </tr>
                  {aiRecommendations[item.id] && (
                    <tr className="bg-slate-950/60 border-b border-slate-850">
                      <td colSpan={9} className="p-4 text-xs">
                        <div className="flex items-start gap-2.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-black font-mono uppercase bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-lg shrink-0">
                            ✨ Yapay Zeka Önerisi
                          </span>
                          <span className="font-semibold text-slate-350 leading-relaxed font-sans">
                            {aiRecommendations[item.id]}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
