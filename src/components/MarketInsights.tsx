import { priceComparison } from "../domain/market";
import { message as msg } from "../i18n";
import { formatPercent, useI18n } from "../i18n";
import { apiFetch } from "../lib/api";
import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { 
  collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, orderBy 
} from "firebase/firestore";
import { 
  Plus, Trash2, Edit2, Check, X, Shield, TrendingDown, TrendingUp, Award, Globe
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
  priceAdvantage?: string;
  currency?: string;
  priceAdvantageKind?: "lower" | "higher" | "equal";
  priceAdvantagePct?: number;
  createdAt: string;
}

// Helper to compute price advantage text
const calculatePriceAdvantageText = (shelfPrice: number, t2tPrice: number): string => {
  const result = priceComparison(Number(shelfPrice), Number(t2tPrice));
  return result.kind === "equal" ? msg("market", "samePrice") : msg("market", result.kind === "lower" ? "valueLower" : "valueHigher", formatPercent(result.percentage, 0));
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
  const { fmt, lang, t } = useI18n();
  const [insights, setInsights] = useState<MarketInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

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
  }, [currentProjectId, lang]);

  const handleGenerateAiMatch = async (competitor: MarketInsight) => {
    setLoadingAi(prev => ({ ...prev, [competitor.id]: true }));
    try {
      const res = await apiFetch("/api/ai/match-manufacturers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          competitor,
          manufacturers,
          language: lang
        })
      });
      if (!res.ok) throw new Error("API request failed");
      const data = await res.json();
      setAiRecommendations(prev => ({ ...prev, [`${competitor.id}:${lang}`]: data.recommendation }));
    } catch (err) {
      console.error("AI matchmaking failed:", err);
      alert(msg("market", "couldNotGenerateTheManufacturerMatchingRecommendation"));
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
      const res = await apiFetch("/api/ai/search-shelf-prices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ queryText: aiSearchQuery, language: lang })
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setAiSearchResults(data.results || []);
    } catch (err) {
      console.error("AI shelf search failed:", err);
      showFeedback(msg("market", "couldNotCompleteTheLiveShelfPriceResearch"));
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
        priceAdvantageKind: priceComparison(priceVal, t2tVal).kind,
        priceAdvantagePct: priceComparison(priceVal, t2tVal).percentage,
        claims: result.claims || [],
        createdAt: new Date().toISOString()
      });
      showFeedback(msg("market", "valueValueAddedToTheBenchmarkTable", result.brand, result.supermarket));
    } catch (err) {
      console.error("Failed to add AI result to Firestore:", err);
      showFeedback(msg("market", "couldNotAddTheBenchmarkRecord"));
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
        const items: MarketInsight[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as MarketInsight));
        // Backward compatibility parsing
        const parsed = items.map(it => ({
          ...it,
          supermarket: it.supermarket || (it as any).competitorName || msg("market", "supermarket"),
          brand: it.brand || msg("market", "privateLabel"),
          shelfPrice: it.shelfPrice ?? (it as any).competitorPrice ?? 0,
          weight: it.weight ?? 1000,
          pricePerGram: it.pricePerGram ?? calculatePricePerGram(it.shelfPrice ?? (it as any).competitorPrice ?? 0, it.weight ?? 1000),
          t2tPrice: it.t2tPrice ?? (it as any).ourPrice ?? 0,
          priceAdvantage: calculatePriceAdvantageText(it.shelfPrice ?? (it as any).competitorPrice ?? 0, it.t2tPrice ?? (it as any).ourPrice ?? 0)
        }));
        setInsights(parsed);
        setLoading(false);
    }, (err) => {
      console.error("Error reading market insights:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [currentProjectId, lang]);

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
      showFeedback(msg("market", "completeAllRequiredFields"));
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
        priceAdvantageKind: priceComparison(priceVal, t2tVal).kind,
        priceAdvantagePct: priceComparison(priceVal, t2tVal).percentage,
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
      showFeedback(msg("market", "fmcgCompetitorAnalysisAdded"));
    } catch (err) {
      console.error("Failed to add insight:", err);
      showFeedback(msg("market", "couldNotAddTheRecord"));
    }
  };

  // Delete Action
  const handleDeleteInsight = async (id: string) => {
    if (!window.confirm(msg("market", "permanentlyDeleteThisCompetitorAnalysisRecord"))) return;
    try {
      const docRef = doc(db, "projects", currentProjectId, "market_insights", id);
      await deleteDoc(docRef);
      showFeedback(msg("market", "recordDeleted"));
    } catch (err) {
      console.error("Failed to delete insight:", err);
      showFeedback(msg("market", "couldNotDeleteTheRecord"));
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
      showFeedback(msg("market", "completeAllFields"));
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
        priceAdvantageKind: priceComparison(priceVal, t2tVal).kind,
        priceAdvantagePct: priceComparison(priceVal, t2tVal).percentage,
        claims: editClaims
      });
      setEditingId(null);
      showFeedback(msg("market", "changesSaved"));
    } catch (err) {
      console.error("Failed to save insight:", err);
      showFeedback(msg("market", "couldNotSave"));
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

      <h2 className="border-b border-slate-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-navy">{msg("market", "competitorPriceBenchmarking")}</h2>

        <div className="space-y-6">
          {/* AI LIVE SHELF PRICE SEARCH PANEL */}
          <div className="bg-gradient-to-r from-blue-900/10 via-cyan-950/5 to-transparent border border-blue-100 p-5 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">✨</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">{msg("market", "aiLiveShelfPriceResearch")}</h4>
                  <p className="text-[10px] text-slate-550 leading-normal">{msg("market", "researchCurrentInStoreSupermarketShelfPricesUsingGemini")}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAiSearchPanel(!showAiSearchPanel)} 
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 font-mono bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200/50 cursor-pointer transition select-none self-start md:self-auto"
              >
                {showAiSearchPanel ? msg("market", "close") : msg("market", "openResearchPanel")}
              </button>
            </div>

            {showAiSearchPanel && (
              <div className="space-y-4 pt-2 border-t border-slate-200/60">
                <form onSubmit={handleAiShelfPriceSearch} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder={msg("market", "eGUkSupermarketTortillaPricesHighProteinWrap")}
                    value={aiSearchQuery}
                    onChange={(e) => setAiSearchQuery(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-850 focus:outline-none focus:border-navy transition font-medium placeholder-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={loadingAiSearch}
                    className="bg-navy hover:bg-navy-light text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer select-none font-mono shrink-0"
                  >
                    {loadingAiSearch ? msg("market", "searching") : msg("market", "runSearch")}
                  </button>
                </form>

                {loadingAiSearch && (
                  <div className="py-8 text-center text-xs text-slate-400 font-mono">
                    {msg("market", "searchingAndAnalysingPhysicalStoreShelfPricesUsingGoogle")}
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
                              <span className="text-xs font-black text-slate-800 font-mono block">{fmt.currency(Number(result.shelfPrice), "USD")}</span>
                              <span className="text-[9px] text-slate-450 font-mono block">{fmt.number(Number(result.weight))} {msg("market", "g")}</span>
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
                          {msg("market", "addToBenchmarkTable")}
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
              <Plus className="h-4.5 w-4.5 text-navy" /> {msg("market", "addRetailPriceBenchmark")}
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">{msg("market", "supermarketChain")}</label>
              <input
                type="text"
                required
                placeholder={msg("market", "eGCostcoWholesale")}
                value={supermarket}
                onChange={(e) => setSupermarket(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy focus:bg-white transition font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">{msg("market", "brand")}</label>
              <input
                type="text"
                required
                placeholder={msg("market", "eGKirklandSignature")}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy focus:bg-white transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">{msg("market", "shelfPriceUsd")}</label>
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
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">{msg("market", "netWeightG")}</label>
                <input
                  type="number"
                  required
                  placeholder={msg("market", "eG1000")}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy focus:bg-white transition font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">{msg("market", "t2tPriceUsd")}</label>
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
                  <span className="text-slate-500">{msg("market", "pricePerGram")}</span>
                  <span className="text-slate-800 font-bold">{fmt.currency(previewPricePerGram, "USD", 4)} /g</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-1.5 mt-1.5">
                  <span className="text-slate-500">{msg("market", "t2tPriceAdvantage")}</span>
                  <span className={`font-black ${Number(shelfPrice) > Number(t2tPrice) ? "text-emerald-600" : "text-rose-600"}`}>
                    {previewPriceAdvantage}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                {msg("market", "productClaimsFeatures")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={msg("market", "typeAndPressEnter")}
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
                  {msg("market", "add")}
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
              {msg("market", "addBenchmarkRecord")}
            </button>
          </div>
        </form>

        {/* LIST / GRID VIEW */}
        <div className="xl:col-span-8 space-y-4 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <Shield className="h-5 w-5 text-navy" />
            <h3 className="text-base font-bold text-slate-900 font-display">{msg("market", "savedCompetitorAnalysisBenchmarks")}</h3>
          </div>

          {loading ? (
            <div className="text-xs text-slate-500 py-12 text-center font-mono">{msg("market", "loadingMarketData")}</div>
          ) : insights.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-xs text-slate-500 italic">
              {msg("market", "noPriceBenchmarksHaveBeenRecordedForThisProject")}
            </div>
          ) : (
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-3xl shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono uppercase tracking-wider text-[10px]">
                    <th className="p-4">{msg("market", "retailer")}</th>
                    <th className="p-4">{msg("market", "brand2")}</th>
                    <th className="p-4">{msg("market", "productClaims")}</th>
                    <th className="p-4">{msg("market", "shelfPrice")}</th>
                    <th className="p-4">{msg("market", "netWeight")}</th>
                    <th className="p-4">{msg("market", "pricePerGram2")}</th>
                    <th className="p-4 bg-teal-500/5 text-teal-800 font-extrabold border-x border-slate-200/60">{msg("market", "t2tPrice")}</th>
                    <th className="p-4 bg-teal-500/10 text-teal-700 font-extrabold border-r border-slate-200/60">{msg("market", "priceAdvantage")}</th>
                    <th className="p-4 text-right">{msg("market", "actions")}</th>
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
                                  placeholder={msg("market", "retailer")}
                                />
                                <input
                                  type="text"
                                  value={editBrand}
                                  onChange={(e) => setEditBrand(e.target.value)}
                                  className="p-2 border rounded-lg text-xs"
                                  placeholder={msg("market", "brand2")}
                                />
                              </div>
                              <div className="flex flex-wrap gap-1">
                                <input
                                  type="text"
                                  value={editTagInput}
                                  onChange={(e) => setEditTagInput(e.target.value)}
                                  onKeyDown={handleEditAddTag}
                                  className="p-1.5 border rounded-lg text-xs w-28"
                                  placeholder={msg("market", "addClaim")}
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
                            {fmt.currency(calculatePricePerGram(Number(editShelfPrice), Number(editWeight)), "USD", 4)}
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
                              <button onClick={() => setEditingId(null)} className="p-1 border rounded hover:bg-white" title={msg("market", "cancel")}><X className="h-3.5 w-3.5" /></button>
                              <button onClick={() => saveEdit(item.id)} className="p-1 bg-navy text-white rounded hover:bg-navy-light" title={msg("market", "save")}><Check className="h-3.5 w-3.5" /></button>
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
                          <td className="p-4 font-mono text-slate-700">{fmt.currency(item.shelfPrice, item.currency || "USD")}</td>
                          <td className="p-4 font-mono text-slate-500">{fmt.number(item.weight)} {msg("market", "g")}</td>
                          <td className="p-4 font-mono text-slate-400">{fmt.currency(item.pricePerGram, item.currency || "USD", 4)} /g</td>
                          <td className="p-4 bg-teal-500/5 font-extrabold font-mono text-teal-700 border-x border-slate-200/60 text-sm">
                            {fmt.currency(item.t2tPrice, item.currency || "USD")}
                          </td>
                          <td className={`p-4 bg-teal-500/10 font-black font-mono border-r border-slate-200/60 text-sm ${
                            hasAdvantage ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            {calculatePriceAdvantageText(item.shelfPrice, item.t2tPrice)}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex gap-1.5 justify-end items-center">
                              <button
                                type="button"
                                onClick={() => handleGenerateAiMatch(item)}
                                disabled={loadingAi[item.id]}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-bold rounded-lg transition flex items-center gap-1 font-mono cursor-pointer"
                                title={msg("market", "aiOpportunityAnalysis")}
                              >
                                {loadingAi[item.id] ? msg("market", "analysing") : msg("market", "aiAnalysis")}
                              </button>
                              <button onClick={() => startEdit(item)} className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition cursor-pointer" title={msg("market", "edit")}><Edit2 className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleDeleteInsight(item.id)} className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition cursor-pointer" title={msg("market", "delete")}><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                        {aiRecommendations[`${item.id}:${lang}`] && (
                          <tr className="bg-blue-50/40 border-b border-slate-200">
                            <td colSpan={9} className="p-4 text-xs">
                              <div className="flex items-start gap-2.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-black font-mono uppercase bg-blue-900/10 border border-blue-800/20 text-blue-700 rounded-lg shrink-0">
                                  {msg("market", "aiRecommendation")}
                                </span>
                                <span className="font-semibold text-slate-700 leading-relaxed font-sans">
                                  {aiRecommendations[`${item.id}:${lang}`]}
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


    </div>
  );
}

// ----------------------------------------------------
// 2. FREELANCER PORTAL: READ ONLY VIEW BİLİŞENİ (FMCG)
// ----------------------------------------------------
export function MarketInsightsView({ currentProjectId }: { currentProjectId: string }) {
  const { fmt, lang, t } = useI18n();
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
  }, [currentProjectId, lang]);

  const handleGenerateAiMatch = async (competitor: MarketInsight) => {
    setLoadingAi(prev => ({ ...prev, [competitor.id]: true }));
    try {
      const res = await apiFetch("/api/ai/match-manufacturers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          competitor,
          manufacturers,
          language: lang
        })
      });
      if (!res.ok) throw new Error("API request failed");
      const data = await res.json();
      setAiRecommendations(prev => ({ ...prev, [`${competitor.id}:${lang}`]: data.recommendation }));
    } catch (err) {
      console.error("AI matchmaking failed:", err);
      alert(msg("market", "couldNotGenerateTheManufacturerMatchingRecommendation"));
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
        supermarket: it.supermarket || (it as any).competitorName || msg("market", "supermarket"),
        brand: it.brand || msg("market", "privateLabel"),
        shelfPrice: it.shelfPrice ?? (it as any).competitorPrice ?? 0,
        weight: it.weight ?? 1000,
        pricePerGram: it.pricePerGram ?? calculatePricePerGram(it.shelfPrice ?? (it as any).competitorPrice ?? 0, it.weight ?? 1000),
        t2tPrice: it.t2tPrice ?? (it as any).ourPrice ?? 0,
        priceAdvantage: calculatePriceAdvantageText(it.shelfPrice ?? (it as any).competitorPrice ?? 0, it.t2tPrice ?? (it as any).ourPrice ?? 0)
      }));
      setInsights(parsed);
      setLoading(false);
    }, (err) => {
      console.error("Error reading market insights for freelancer:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [currentProjectId, lang]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-xs text-slate-400 font-mono">
        {msg("market", "loadingMarketResearchAndRetailBenchmarks")}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-xs text-slate-500 italic">
        {msg("market", "noMarketResearchHasBeenSavedForThisProject")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Globe className="h-5 w-5 text-teal-400" />
        <h3 className="text-base font-black text-white uppercase tracking-wider font-mono">{msg("market", "retailMarketBenchmarkingFmcg")}</h3>
      </div>

      {/* Read-only Table */}
      <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-500 font-mono uppercase tracking-wider text-[10px]">
                <th className="p-4">{msg("market", "retailer")}</th>
                <th className="p-4">{msg("market", "brand2")}</th>
                <th className="p-4">{msg("market", "productClaims")}</th>
                <th className="p-4 font-mono">{msg("market", "shelfPrice")}</th>
                <th className="p-4 font-mono">{msg("market", "netWeight")}</th>
                <th className="p-4 font-mono">{msg("market", "pricePerGram2")}</th>
                <th className="p-4 bg-teal-500/5 text-teal-400 font-extrabold border-x border-slate-800">{msg("market", "t2tPrice")}</th>
                <th className="p-4 bg-teal-500/10 text-teal-300 font-extrabold border-r border-slate-800">{msg("market", "priceAdvantage")}</th>
                <th className="p-4 text-right">{msg("market", "action")}</th>
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
                    <td className="p-4 font-mono text-slate-300">{fmt.currency(item.shelfPrice, item.currency || "USD")}</td>
                    <td className="p-4 font-mono text-slate-400">{fmt.number(item.weight)} {msg("market", "g")}</td>
                    <td className="p-4 font-mono text-slate-500">{fmt.currency(item.pricePerGram, item.currency || "USD", 4)} /g</td>
                    <td className="p-4 bg-teal-500/5 font-extrabold font-mono text-teal-400 border-x border-slate-800 text-sm">
                      {fmt.currency(item.t2tPrice, item.currency || "USD")}
                    </td>
                    <td className={`p-4 bg-teal-500/10 font-black font-mono border-r border-slate-800 text-sm ${
                      hasAdvantage ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {calculatePriceAdvantageText(item.shelfPrice, item.t2tPrice)}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleGenerateAiMatch(item)}
                        disabled={loadingAi[item.id]}
                        className="px-2.5 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-450 text-[10px] font-bold rounded-lg transition flex items-center gap-1 font-mono cursor-pointer"
                        title={msg("market", "aiOpportunityAnalysis")}
                      >
                        {loadingAi[item.id] ? msg("market", "analysing") : msg("market", "aiAnalysis")}
                      </button>
                    </td>
                  </tr>
                  {aiRecommendations[`${item.id}:${lang}`] && (
                    <tr className="bg-slate-950/60 border-b border-slate-850">
                      <td colSpan={9} className="p-4 text-xs">
                        <div className="flex items-start gap-2.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-black font-mono uppercase bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-lg shrink-0">
                            {msg("market", "aiRecommendation")}
                          </span>
                          <span className="font-semibold text-slate-350 leading-relaxed font-sans">
                            {aiRecommendations[`${item.id}:${lang}`]}
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
