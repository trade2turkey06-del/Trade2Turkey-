import React, { useState, useEffect } from "react";
import { 
  Ship, Calendar, Truck, AlertTriangle, Check, X, Edit2
} from "lucide-react";
import { ShipmentMilestone, InventoryItem, FulfillmentOrder, INITIAL_SHIPMENTS } from "../types";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from "firebase/firestore";

interface LogisticsSOPProps {
  shipments: ShipmentMilestone[];
  setShipments: React.Dispatch<React.SetStateAction<ShipmentMilestone[]>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  fulfillmentOrders: FulfillmentOrder[];
  setFulfillmentOrders: React.Dispatch<React.SetStateAction<FulfillmentOrder[]>>;
  currentProjectId?: string;
  onChangeProjectId?: (projectId: string) => void;
  canSwitchProject?: boolean;
  isAdmin?: boolean;
}

const LogisticsSOP = React.memo(function LogisticsSOP({
  shipments,
  setShipments,
  inventory,
  setInventory,
  fulfillmentOrders: orders,
  setFulfillmentOrders: setOrders,
  currentProjectId: propProjectId,
  onChangeProjectId,
  canSwitchProject = true,
  isAdmin = false
}: LogisticsSOPProps) {
  
  const [activeSubsection, setActiveSubsection] = useState<"B.A" | "B.B">("B.A");
  
  // Local state fallback
  const [localProjectId, setLocalProjectId] = useState<string>("PROJE-UNLU MAMÜLLER");
  const currentProjectId = propProjectId || localProjectId;

  // Internal notification helper
  const [feedback, setFeedback] = useState<string | null>(null);
  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Order info edit states
  const [projectData, setProjectData] = useState<{ orderNo?: string; waybill?: string } | null>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [tempOrderNo, setTempOrderNo] = useState("");
  const [tempWaybill, setTempWaybill] = useState("");

  // Listen to active project document
  useEffect(() => {
    if (!currentProjectId) return;
    const docRef = doc(db, "projects", currentProjectId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProjectData({
          orderNo: data.orderNo || "",
          waybill: data.waybill || ""
        });
      }
    }, (err) => {
      console.error("Error reading project details in LogisticsSOP:", err);
    });
    return () => unsub();
  }, [currentProjectId]);

  const handleSaveOrderInfo = async () => {
    if (!currentProjectId) return;
    try {
      const docRef = doc(db, "projects", currentProjectId);
      await updateDoc(docRef, {
        orderNo: tempOrderNo.trim(),
        waybill: tempWaybill.trim()
      });
      setIsEditingInfo(false);
      showFeedback("Sipariş bilgileri başarıyla güncellendi.");
    } catch (err) {
      console.error("Failed to update order info:", err);
      showFeedback("Hata: Bilgiler güncellenemedi.");
    }
  };

  const handleUpdateMilestoneStatus = async (milestoneIdx: number, newStatus: "Bekliyor" | "Devam Ediyor" | "Tamamlandı") => {
    if (!currentProjectId || !currentShipment) return;
    try {
      const updatedMilestones = [...currentShipment.milestones];
      updatedMilestones[milestoneIdx] = {
        ...updatedMilestones[milestoneIdx],
        status: newStatus,
        completed: newStatus === "Tamamlandı"
      };

      let newCurrentIndex = currentShipment.currentMilestoneIndex;
      const firstPendingIdx = updatedMilestones.findIndex(m => m.status === "Bekliyor" || m.status === "Devam Ediyor" || !m.completed);
      if (firstPendingIdx !== -1) {
        newCurrentIndex = firstPendingIdx;
      } else {
        newCurrentIndex = updatedMilestones.length - 1;
      }

      let generalStatus = currentShipment.status;
      if (updatedMilestones[updatedMilestones.length - 1].status === "Tamamlandı") {
        generalStatus = "Delivered";
      } else if (updatedMilestones[5].status === "Tamamlandı") {
        generalStatus = "Transit";
      }

      const docId = `${currentProjectId}_${currentShipment.id}`;
      const docRef = doc(db, "shipments", docId);
      
      await updateDoc(docRef, {
        milestones: updatedMilestones,
        currentMilestoneIndex: newCurrentIndex,
        status: generalStatus
      });

      showFeedback("Timeline aşama durumu başarıyla güncellendi.");
    } catch (err) {
      console.error("Failed to update milestone status:", err);
      showFeedback("Hata: Aşama durumu güncellenemedi.");
    }
  };

  // Reset timeline handler for Admin
  const [resettingTimeline, setResettingTimeline] = useState(false);
  const handleResetTimeline = async () => {
    setResettingTimeline(true);
    try {
      const q = query(collection(db, "shipments"), where("projectId", "==", currentProjectId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        for (const sDoc of snap.docs) {
          const templateMilestones = INITIAL_SHIPMENTS[0]?.milestones || [];
          await updateDoc(doc(db, "shipments", sDoc.id), {
            milestones: templateMilestones,
            currentMilestoneIndex: 5,
            status: "Transit"
          });
        }
        showFeedback("Lojistik şablonu başarıyla jenerik yapıya güncellendi! Firestore verileri sıfırlandı.");
      } else {
        showFeedback("Bu proje için kayıtlı lojistik verisi bulunamadı.");
      }
    } catch (err) {
      console.error("Error resetting timeline:", err);
      showFeedback("Hata: Lojistik şablonu güncellenemedi.");
    } finally {
      setResettingTimeline(false);
    }
  };

  // --- ACTIVE LOGISTICS SHIPMENT MODULE ---
  const currentShipment = shipments[0] || null;
  const advanceShipmentMilestone = () => {
    if (!currentShipment) return;
    setShipments(prev => prev.map(ship => {
      const nextIndex = Math.min(ship.milestones.length - 1, ship.currentMilestoneIndex + 1);
      const updatedMilestones = ship.milestones.map((mil, idx) => {
        if (idx <= nextIndex) return { ...mil, completed: true };
        return mil;
      });
      return {
        ...ship,
        currentMilestoneIndex: nextIndex,
        status: nextIndex >= 7 ? "Delivered" : "Transit",
        milestones: updatedMilestones
      };
    }));
    showFeedback("Sevkiyat aşaması ilerletildi! Gemi koordinatları güncellendi.");
  };

  // --- INVENTORY PLANNER MODULE ---
  const handleUpdateInventoryField = (id: string, field: keyof InventoryItem, value: any) => {
    setInventory(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // --- FULFILLMENT MATRIX CONTROLLER ---
  const [cargoUploadingOrderId, setCargoUploadingOrderId] = useState<string | null>(null);
  const [mockPhotoUrl, setMockPhotoUrl] = useState("https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=400&auto=format&fit=crop");

  const verifyStockAndAdvance = (ordId: string) => {
    const order = orders.find(o => o.id === ordId);
    if (!order) return;
    const item = inventory.find(i => i.sku === order.sku);
    
    if (item && item.physicalStock - item.committedStock > 0) {
      setOrders(prev => prev.map(o => o.id === ordId ? { ...o, status: "Stock Verified" } : o));
      showFeedback(`Stok mevcut. Ürün sipariş karşılama için ayrıldı.`);
    } else {
      showFeedback(`🚨 Uyarı: Yetersiz fiziksel kullanılabilir miktar!`);
    }
  };

  const assignCarrierRate = (ordId: string, carrierName: string, rateValue: number) => {
    setOrders(prev => prev.map(o => {
      if (o.id === ordId) {
        return {
          ...o,
          selectedRate: { carrier: carrierName, rate: rateValue, duration: "3 Days" },
          status: "Labeiled",
          shippingLabelUrl: `https://example.com/labels/${carrierName.replace(" ", "")}-${ordId}.pdf`,
          trackingNumber: `${carrierName.toUpperCase().slice(0,3)}-${Date.now()}-EU`
        };
      }
      return o;
    }));
    showFeedback(`Taşıyıcı DPD/DHL seçildi. Etiket oluşturuldu.`);
  };

  const uploadCargoProofPhoto = (ordId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === ordId) {
        return {
          ...o,
          cargoProofPhotoUrl: mockPhotoUrl,
          status: "Shipped"
        };
      }
      return o;
    }));
    setCargoUploadingOrderId(null);
    showFeedback(`Kargo doğrulama resmi teslimat kanıtı olarak yüklendi!`);
  };

  const synchronizeAndComplete = (ordId: string) => {
    const order = orders.find(o => o.id === ordId);
    if (!order) return;

    // Deduct stock physically as per Step B.C.8 & B.C.9
    setInventory(prev => prev.map(item => {
      if (item.sku === order.sku) {
        return {
          ...item,
          physicalStock: Math.max(0, item.physicalStock - 1),
          committedStock: Math.max(0, item.committedStock - 1)
        };
      }
      return item;
    }));

    setOrders(prev => prev.map(o => o.id === ordId ? { ...o, status: "Synced" } : o));
    showFeedback(`Yerel veritabanları başarıyla güncellendi ve Amazon + Walmart mağazaları senkronize edildi!`);
  };

  return (
    <div className="space-y-6">
      
      {/* Tab select buttons */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveSubsection("B.A")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
            activeSubsection === "B.A"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          🚢 Üretim & Lojistik Takip
        </button>
        <button
          onClick={() => setActiveSubsection("B.B")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
            activeSubsection === "B.B"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          📊 Envanter Planlama ve Tahminleme (B.B)
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold flex items-center justify-between">
          <span>ℹ️ {feedback}</span>
          <button onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      {/* =======================================================
          A. PROJECT EXECUTION & TRACKING SUB-DASHBOARDS
         ======================================================= */}
      {activeSubsection === "B.A" && currentShipment && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Tracking milestones progress map simulation */}
          <div className="lg:col-span-8 bg-slate-900 text-white rounded-xl p-6 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <span className="text-[10px] text-sky-300 font-bold uppercase tracking-widest font-mono">
                  Operasyon Takip Sistemi
                </span>
                <h4 className="text-lg font-bold font-display">{currentProjectId}</h4>
                {isEditingInfo ? (
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 select-none">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 uppercase font-mono">Sipariş No:</span>
                      <input
                        type="text"
                        value={tempOrderNo}
                        onChange={(e) => setTempOrderNo(e.target.value)}
                        placeholder="Belirtilmedi"
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono w-28"
                      />
                    </div>
                    <span className="text-slate-600">|</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 uppercase font-mono">Waybill:</span>
                      <input
                        type="text"
                        value={tempWaybill}
                        onChange={(e) => setTempWaybill(e.target.value)}
                        placeholder="Belirtilmedi"
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono w-28"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        type="button"
                        onClick={handleSaveOrderInfo}
                        className="p-1 text-emerald-400 hover:text-emerald-350 transition hover:bg-slate-800 rounded cursor-pointer"
                        title="Kaydet"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingInfo(false)}
                        className="p-1 text-rose-400 hover:text-rose-350 transition hover:bg-slate-800 rounded cursor-pointer"
                        title="İptal"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1.5 select-none">
                    <p className="text-xs text-slate-400 font-mono">
                      Sipariş No: {projectData?.orderNo || "Belirtilmedi"} | Waybill: {projectData?.waybill || "Belirtilmedi"}
                    </p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setTempOrderNo(projectData?.orderNo || "");
                          setTempWaybill(projectData?.waybill || "");
                          setIsEditingInfo(true);
                        }}
                        className="p-0.5 text-slate-500 hover:text-white transition cursor-pointer hover:bg-slate-800 rounded"
                        title="Bilgileri Düzenle"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={handleResetTimeline}
                  disabled={resettingTimeline}
                  className="px-3.5 py-2 bg-red-650 hover:bg-red-700 disabled:bg-red-800 text-white text-[10px] font-black rounded-xl transition cursor-pointer font-mono uppercase tracking-wider shadow-md"
                >
                  {resettingTimeline ? "Güncelleniyor..." : "🔄 Lojistik Şablonunu Sıfırla/Güncelle"}
                </button>
              )}
            </div>

            {/* Simulated Live Route Progress */}
            <div className="bg-slate-955 p-4 rounded-xl border border-slate-850 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="border-r border-slate-800/40 pr-2">
                <span className="text-slate-500 block text-[10px]">MEVCUT YEREL BÖLGE:</span>
                <strong className="text-teal-400 text-sm">{currentShipment.milestones[currentShipment.currentMilestoneIndex]?.title}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">SEVKİYAT GÜZERGAHI:</span>
                <strong className="text-slate-200">Türkiye Limanı → İthalat Ülkesi Limanı</strong>
              </div>
            </div>

            {/* Milestones stepper */}
            <div className="relative pl-8 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {currentShipment.milestones.map((mil, idx) => {
                const milestoneStatus = mil.status || (mil.completed ? "Tamamlandı" : "Bekliyor");

                return (
                  <div key={mil.title} className="relative flex gap-4 text-xs">
                    
                    {/* Stepper Dot */}
                    <div className="absolute -left-[27px] flex items-center justify-center select-none">
                      {milestoneStatus === "Tamamlandı" ? (
                        <div className="h-5 w-5 rounded-full bg-emerald-600 border border-emerald-500 flex items-center justify-center">
                          <Check className="h-3 w-3 text-white font-bold" />
                        </div>
                      ) : milestoneStatus === "Devam Ediyor" ? (
                        <div className="h-5 w-5 rounded-full border-2 border-sky-400 border-t-yellow-400 animate-spin bg-slate-900" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-slate-700 bg-slate-950" />
                      )}
                    </div>

                    <div className={`flex-1 ${milestoneStatus === "Bekliyor" ? "opacity-60" : ""}`}>
                      <div className="flex items-center gap-3 justify-between">
                        <strong className={`font-semibold tracking-wide ${
                          milestoneStatus === "Devam Ediyor" 
                            ? "text-sky-400 font-bold" 
                            : milestoneStatus === "Tamamlandı" 
                            ? "text-slate-200" 
                            : "text-slate-500"
                        }`}>
                          {mil.title}
                        </strong>
                        
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-500">{mil.date}</span>
                          {isAdmin && (
                            <select
                              value={milestoneStatus}
                              onChange={(e) => handleUpdateMilestoneStatus(idx, e.target.value as any)}
                              className="bg-slate-800 border border-slate-700 text-[10px] text-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-sky-500 font-bold font-mono cursor-pointer"
                            >
                              <option value="Bekliyor">Bekliyor</option>
                              <option value="Devam Ediyor">Devam Ediyor</option>
                              <option value="Tamamlandı">Tamamlandı</option>
                            </select>
                          )}
                        </div>
                      </div>
                      <p className={`mt-0.5 leading-relaxed text-[11px] ${
                        milestoneStatus === "Devam Ediyor" 
                          ? "text-slate-200" 
                          : milestoneStatus === "Tamamlandı" 
                          ? "text-slate-400" 
                          : "text-slate-500"
                      }`}>
                        {mil.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cargo Proof Photos & Customs Documents */}
          <div className="lg:col-span-4 bg-white rounded-xl p-6 border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider font-mono">
                Doğrulama Kanıt Kutusu
              </span>
              <h4 className="text-sm font-bold text-slate-800 mt-1">Tedarik Sahası Kalite Kanıtları</h4>
              <p className="text-xs text-slate-500 mt-0.5">Türk denetim ekibi tarafından doğrudan yüklenen sevkiyat öncesi fotoğraflar</p>

              <div className="grid grid-cols-1 gap-3 mt-4">
                {currentShipment.cargoPhotos.map(ph => (
                  <div key={ph.id} className="relative rounded-lg overflow-hidden border bg-slate-100 group">
                    <img 
                      src={ph.url} 
                      alt={ph.title} 
                      className="h-28 w-full object-cover group-hover:scale-105 transition duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2.5 flex flex-col justify-end">
                      <div className="font-bold text-white text-[11px]">{ph.title}</div>
                      <div className="text-[9px] text-slate-300 font-mono">{ph.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-700">Dijital Belge Kasaları:</div>
              <div className="space-y-1.5 mt-2">
                <a href="#" className="flex justify-between p-2 rounded border bg-slate-50 text-[10px] hover:bg-slate-100 font-mono">
                  <span>📄 Certificate_of_Origin_TR.pdf</span>
                  <span className="text-blue-600">İndir</span>
                </a>
                <a href="#" className="flex justify-between p-2 rounded border bg-slate-50 text-[10px] hover:bg-slate-100 font-mono">
                  <span>📄 Export_Packing_List_1002.xls</span>
                  <span className="text-blue-600">İndir</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          B. INVENTORY DEEP INTUITIVE FORECASTING
         ======================================================= */}
      {activeSubsection === "B.B" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h4 className="text-base font-bold text-slate-800 font-display">Ayrıntılı Türkiye Depo Tahminleri</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Teslim süresi ve güvenlik stoklarını kullanarak yeniden sipariş limitlerini otomatik olarak hesaplayın. Trade2Turkey, güvensiz seviyelere yaklaşan stoklar için otomatik olarak alarm göstergelerini tetikler.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {inventory.map(item => {
              const available = item.physicalStock - item.committedStock;
              const dailyUsage = item.forecastDailySales;
              const leadTimeDays = item.leadTimeDays;
              const safetyStockDays = item.safetyStockDays;
              
              // Daily Average * LeadTime + (Daily Average * SafetyStockDays)
              const reorderPoint = (dailyUsage * leadTimeDays) + (dailyUsage * safetyStockDays);
              const statusCritical = available <= reorderPoint;

              return (
                <div key={item.id} className={`p-5 rounded-xl border bg-white relative overflow-hidden transition shadow-sm ${
                  statusCritical ? "border-red-200 ring-2 ring-red-100" : "border-slate-200"
                }`}>
                  {statusCritical && (
                    <div className="absolute top-0 right-0 p-1.5 bg-red-600 text-white text-[9px] font-bold tracking-wider font-mono uppercase px-2 rounded-bl-lg flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="h-3 w-3" /> Yeniden Sipariş Uyarısı
                    </div>
                  )}

                  <div className="font-bold text-slate-800 text-base">{item.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wide mt-0.5">SKU: {item.sku}</div>

                  <div className="grid grid-cols-2 gap-4 border-y py-4 my-4 text-xs">
                    <div>
                      <span className="text-slate-400 block font-medium">Fiziksel Stok:</span>
                      <input
                        type="number"
                        value={item.physicalStock}
                        onChange={(e) => handleUpdateInventoryField(item.id, "physicalStock", Number(e.target.value))}
                        className="font-mono text-base font-extrabold text-slate-800 focus:outline-none w-20 border-b focus:border-navy bg-transparent"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Taahhüt Edilen (B2B/B2C):</span>
                      <input
                        type="number"
                        value={item.committedStock}
                        onChange={(e) => handleUpdateInventoryField(item.id, "committedStock", Number(e.target.value))}
                        className="font-mono text-base font-extrabold text-slate-800 focus:outline-none w-20 border-b focus:border-navy bg-transparent"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Günlük Satış:</span>
                      <input
                        type="number"
                        value={item.forecastDailySales}
                        onChange={(e) => handleUpdateInventoryField(item.id, "forecastDailySales", Number(e.target.value))}
                        className="font-mono text-xs font-bold text-slate-800 focus:outline-none w-16 border-b focus:border-navy bg-transparent"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Transit Gün:</span>
                      <strong className="font-mono text-xs text-slate-800 block mt-1">{item.leadTimeDays} Transit Gün</strong>
                    </div>
                  </div>

                  {/* Math calculation display */}
                  <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-150">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Kullanılabilir miktar:</span>
                      <strong className="font-mono text-slate-800">{available} units</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Yeniden sipariş eşiği:</span>
                      <strong className="font-mono text-slate-800">{reorderPoint} units</strong>
                    </div>
                    <div className="border-t pt-2 flex justify-between uppercase font-mono font-bold text-[10px]">
                      <span className="text-slate-500">Kalan stok süresi:</span>
                      <span className={statusCritical ? "text-red-600 animate-pulse" : "text-green-600"}>
                        {Math.floor(available / (dailyUsage || 1))} Gün kaldı
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>
    );
  });

export default LogisticsSOP;
