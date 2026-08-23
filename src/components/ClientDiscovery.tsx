import React, { useState, useEffect, useMemo } from "react";
import { 
  Compass, Users, Search, AlertTriangle, Plus, CheckCircle, 
  MapPin, Clock, Sparkles, ChevronDown, ChevronUp, AlertOctagon, 
  RefreshCw, TrendingUp, ShieldAlert, Award, UserCheck, UserX, Loader2, UserPlus
} from "lucide-react";
import { UserTenant } from "../data/usersData";
import { db } from "../lib/firebase";
import { 
  collection, query, onSnapshot, doc, setDoc, where, updateDoc, arrayUnion, arrayRemove, getDocs
} from "firebase/firestore";
import { PROJECT_NAMES } from "../data/driveData";

interface ClientDiscoveryProps {
  currentProjectId: string;
  currentUser: UserTenant | null;
  projects: any[];
}

interface Scouter {
  id: string;
  name: string;
  region: string;
  activeLeadsCount: number;
  lastActivityDays: number;
  status: "Aktif" | "Kritik Eylemsizlik Uyarısı" | "Askıya Alındı" | string;
  email: string;
  companyName?: string;
  contactPerson?: string;
  title?: string;
  secondaryEmail?: string;
  workPhone?: string;
  cellPhone?: string;
  website?: string;
  onboardingCompleted?: boolean;
  projectId?: string;
  assignedProjects?: string[];
  uid?: string;
  rawStatus?: string;
}

interface ClientLead {
  id: string;
  companyName: string;
  country: string;
  decisionMakerName: string;
  decisionMakerTitle: string;
  contactInfo: string;
  status: "Devam Ediyor" | "Olumsuz Sonuçlandı" | "Olumlu Sonuçlandı" | "İlk Temas" | "Teklif Aşaması" | "Nitelikli Talep" | "Görüşülüyor" | "Reddedildi";
  assignedScouterId: string;
  lastUpdateDays: number;
  demandNotes: string;
  projectId: string;
  score?: number;
  grade?: "A-Grade" | "B-Grade" | "C-Grade";
  aiFeedback?: string;
  aiReasoning?: string;
  pillars?: {
    sectorFit: string;
    emailCheck: string;
    decisionMakerAuthority: string;
    financialFit: string;
    volumeCheck: string;
    specClarity: string;
    targetPriceCheck: string;
  };
  
  // Firma Temel Kimlik ve Güvenilirlik Verileri
  website?: string;
  linkedinProfile?: string;
  companyType?: "Distribütör" | "İthalatçı" | "Toptancı" | "Perakende Zinciri" | "E-Ticaret Satıcısı";

  // Karar Verici Yetkinlik Verileri
  decisionMakerEmail?: string;
  decisionMakerPhone?: string;

  // Ürün Spesifikasyonları ve Sektörel Detaylar
  productCategory?: string;
  technicalSpecs?: string;
  urgency?: "Hemen" | "1-3 Ay İçinde" | "1 yıl" | "1 yıldan uzun";

  // Operasyonel ve Finansal Beklentiler
  estimatedVolume?: string;
  targetPrice?: string;
  paymentTerms?: string;
  hsCode?: string;
  deliveryTerm?: string;
  assignedTo?: string;
  userId?: string;
  processStage?: string;
}

const DEFAULT_SCOUTERS: Scouter[] = [
  {
    id: "freelancer_scouter",
    name: "Zulqarnain Deen",
    region: "Küresel (Test Ağı)",
    activeLeadsCount: 0,
    lastActivityDays: 0,
    status: "Aktif",
    email: "freelancer@trade2turkey.com"
  }
];

const DEFAULT_LEADS: ClientLead[] = [
  {
    id: "lead_unlumamuller_nordic",
    companyName: "Nordic Bakery Import GmbH",
    country: "Almanya",
    decisionMakerName: "Marcus Weber",
    decisionMakerTitle: "Satın Alma Müdürü",
    contactInfo: "m.weber@nordicbakery.de | +49 89 123456",
    status: "Devam Ediyor",
    assignedScouterId: "freelancer_scouter",
    lastUpdateDays: 3,
    demandNotes: "Türk simidi, poğaça ve dondurulmuş unlu mamüller ithalatıyla ilgileniyor. IFS ve BRC sertifikaları talep etti.",
    projectId: "PROJE-UNLU MAMÜLLER",
    score: 92,
    grade: "A-Grade",
    aiFeedback: "Mükemmel B2B uyumu! Sektör eşleşmesi tam, kontak kişi satın alma yetkilisi ve ödeme Advance T/T standartlarımıza uygun.",
    aiReasoning: "Firma alanında aktif bir distribütör ve satın alma doğrudan karar verici seviyesinde. Fiyatlandırma aşamasına geçilebilir.",
    pillars: {
      sectorFit: "Uyumlu (Unlu Mamüller)",
      emailCheck: "Kurumsal Domain",
      decisionMakerAuthority: "Yüksek Yetki (Satın Alma Müdürü)",
      financialFit: "%100 Peşin T/T Uyumlu",
      volumeCheck: "Konteyner Hacmi (FCL)",
      specClarity: "Detaylı Teknik Bilgi",
      targetPriceCheck: "Gerçekçi Hedef Fiyat"
    },
    website: "https://www.nordicbakery.de",
    linkedinProfile: "https://www.linkedin.com/company/nordic-bakery",
    companyType: "Distribütör",
    decisionMakerEmail: "m.weber@nordicbakery.de",
    decisionMakerPhone: "+49 89 123456",
    productCategory: "Unlu Mamüller / Dondurulmuş Gıda",
    technicalSpecs: "Dondurulmuş simit ve börek ürün grubu, BRC/IFS sertifikaları.",
    urgency: "1-3 Ay İçinde",
    estimatedVolume: "Aylık 2 x 40HQ Konteyner",
    targetPrice: "$1.20 / Adet (FOB Izmir)",
    paymentTerms: "%30 Peşin, %70 BL karşılığı T/T",
    hsCode: "1905.90.80",
    deliveryTerm: "FOB"
  }
];

export default function ClientDiscovery({ currentProjectId, currentUser, projects }: ClientDiscoveryProps) {
  // Load scouters dynamically from Firestore (fallback to DEFAULT_SCOUTERS)
  const [scouters, setScouters] = useState<Scouter[]>(DEFAULT_SCOUTERS);

  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  const getProjectName = (projectId: string) => {
    const globalNames = (window as any).PROJECT_NAMES || JSON.parse(localStorage.getItem("t2t_project_names") || "{}");
    return globalNames[projectId] || PROJECT_NAMES[projectId] || projectId;
  };

  // Sync leads with Firestore collection "leads" and seed it if empty
  useEffect(() => {
    setLoadingLeads(true);
    const q = query(collection(db, "leads"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        console.log("Seeding leads database...");
        try {
          for (const lead of DEFAULT_LEADS) {
            await setDoc(doc(db, "leads", lead.id), {
              ...lead,
              assignedTo: "owner_admin",
              userId: "owner_admin"
            });
          }
        } catch (err) {
          console.error("Failed to seed default leads in Firestore:", err);
        }
      } else {
        const fetched: ClientLead[] = [];
        snapshot.forEach(doc => {
          fetched.push(doc.data() as ClientLead);
        });
        setLeads(fetched);
      }
      setLoadingLeads(false);
    }, (error) => {
      console.error("Firestore leads sync error:", error);
      setLoadingLeads(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync scouters from Firestore users collection in real-time
  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "freelancer"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Scouter[] = [];
      snapshot.forEach(docSnap => {
        const u = docSnap.data();
        fetched.push({
          id: docSnap.id,
          name: u.name || "Test Satıcı",
          region: u.region || "Küresel (Test Ağı)",
          activeLeadsCount: u.activeLeadsCount ?? 0,
          lastActivityDays: u.lastActivityDays ?? 0,
          status: u.status === "pending_auth" ? "Askıya Alındı" : (u.status === "active" ? "Aktif" : u.status || "Aktif"),
          email: u.email || docSnap.id,
          companyName: u.companyName || "",
          contactPerson: u.contactPerson || "",
          title: u.title || "",
          secondaryEmail: u.secondaryEmail || "",
          workPhone: u.workPhone || "",
          cellPhone: u.cellPhone || "",
          website: u.website || "",
          onboardingCompleted: u.status === "active",
          projectId: u.projectId || "",
          assignedProjects: u.assignedProjects || [],
          uid: u.uid || "",
          rawStatus: u.status
        });
      });
      if (fetched.length > 0) {
        setScouters(fetched);
      } else {
        // Seed default scouter inside users collection
        const defaultScouter = {
          id: "freelancer_scouter",
          name: "Zulqarnain Deen",
          displayName: "Zulqarnain Deen",
          email: "freelancer@trade2turkey.com",
          status: "active",
          role: "freelancer",
          assignedProjects: ["PROJE-UNLU MAMÜLLER"],
          region: "Küresel (Test Ağı)",
          companyName: "Wahkr"
        };
        setDoc(doc(db, "users", defaultScouter.id), defaultScouter);
        fetched.push({
          id: defaultScouter.id,
          name: defaultScouter.name,
          region: defaultScouter.region,
          activeLeadsCount: 0,
          lastActivityDays: 0,
          status: "Aktif",
          email: defaultScouter.email,
          onboardingCompleted: true,
          assignedProjects: defaultScouter.assignedProjects,
          rawStatus: "active"
        });
        setScouters(fetched);
      }
    }, (error) => {
      console.error("Firestore users sync error:", error);
    });

    return () => unsubscribe();
  }, []);

  // Form states
  const [selectedScouterForDetail, setSelectedScouterForDetail] = useState<Scouter | null>(null);
  const [selectedProjectToAssign, setSelectedProjectToAssign] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteProjectId, setInviteProjectId] = useState("");
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteFeedback("Lütfen gerekli tüm alanları doldurun.");
      return;
    }
    const emailKey = inviteEmail.trim().toLowerCase();
    try {
      const docRef = doc(db, "users", emailKey);
      await setDoc(docRef, {
        id: emailKey,
        name: inviteName.trim(),
        displayName: inviteName.trim(),
        email: emailKey,
        status: "pending_auth",
        role: "freelancer",
        assignedProjects: inviteProjectId ? [inviteProjectId] : [],
        createdAt: new Date().toISOString()
      });
      setInviteName("");
      setInviteEmail("");
      setInviteProjectId("");
      setInviteFeedback("Scouter başarıyla davet edildi! Kayıt bekleniyor.");
      setTimeout(() => {
        setInviteFeedback(null);
        setShowInviteModal(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to invite scouter:", err);
      setInviteFeedback("Davet gönderilirken bir hata oluştu.");
    }
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [newDMName, setNewDMName] = useState("");
  const [newDMTitle, setNewDMTitle] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newScouterId, setNewScouterId] = useState(scouters[0]?.id || "");
  const [newNotes, setNewNotes] = useState("");
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  // New Form states
  const [newWebsite, setNewWebsite] = useState("");
  const [newLinkedinProfile, setNewLinkedinProfile] = useState("");
  const [newCompanyType, setNewCompanyType] = useState<"Distribütör" | "İthalatçı" | "Toptancı" | "Perakende Zinciri" | "E-Ticaret Satıcısı">("Distribütör");
  const [newDMEmail, setNewDMEmail] = useState("");
  const [newDMPhone, setNewDMPhone] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newTechnicalSpecs, setNewTechnicalSpecs] = useState("");
  const [newUrgency, setNewUrgency] = useState<"Hemen" | "1-3 Ay İçinde" | "1 yıl" | "1 yıldan uzun">("1-3 Ay İçinde");
  const [newEstimatedVolume, setNewEstimatedVolume] = useState("");
  const [newTargetPrice, setNewTargetPrice] = useState("");
  const [newPaymentTerms, setNewPaymentTerms] = useState("");
  const [newHsCode, setNewHsCode] = useState("");
  const [newDeliveryTerm, setNewDeliveryTerm] = useState("FOB");

  // Search, Filter and Accordion states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Hepsi");
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);

  // Admin logs state
  const [actionLogs, setActionLogs] = useState<string[]>([
    "Sistem Operasyonel: Scouter takip günlükleri senkronize edildi.",
    "Performans İzleyici: 30-Günlük KPI denetimleri arka planda devrede."
  ]);

  const addLog = (log: string) => {
    const time = new Date().toLocaleTimeString("tr-TR");
    setActionLogs(prev => [`[${time}] ${log}`, ...prev.slice(0, 4)]);
  };

  // Filtered Leads (excluding C-grade leads from general pipeline in terms of KPI or matching projectId)
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (l.projectId !== currentProjectId) return false;
      
      const matchesSearch = 
        l.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.decisionMakerName.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchesStatus = statusFilter === "Hepsi" || l.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [leads, currentProjectId, searchTerm, statusFilter]);

  // Dynamically calculate scouter lead counts EXCLUDING C-grade (rejected) leads
  const scouterLeadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    scouters.forEach(s => {
      counts[s.id] = leads.filter(l => l.assignedScouterId === s.id && l.grade !== "C-Grade").length;
    });
    return counts;
  }, [scouters, leads]);

  // Sync count metrics to scouters array
  useEffect(() => {
    setScouters(prev => prev.map(s => {
      const calculatedCount = scouterLeadCounts[s.id] || 0;
      if (s.activeLeadsCount !== calculatedCount) {
        return { ...s, activeLeadsCount: calculatedCount };
      }
      return s;
    }));
  }, [scouterLeadCounts]);

  // Scouter action handlers
  const handleWarnScouter = async (scouterId: string, scouterName: string) => {
    try {
      const userRef = doc(db, "users", scouterId);
      await setDoc(userRef, {
        status: "Kritik Eylemsizlik Uyarısı",
        lastActivityDays: 13
      }, { merge: true });
      addLog(`Scouter ${scouterName} için eylemsizlik uyarısı e-postası gönderildi.`);
    } catch (err) {
      console.error("Failed to warn scouter in Firestore:", err);
    }
  };

  const handleSuspendScouter = async (scouterId: string, scouterName: string) => {
    try {
      const userRef = doc(db, "users", scouterId);
      await setDoc(userRef, {
        status: "Askıya Alındı",
        lastActivityDays: 14
      }, { merge: true });
      addLog(`Scouter ${scouterName} 14-günlük eylemsizlik kuralı sebebiyle askıya alındı.`);
    } catch (err) {
      console.error("Failed to suspend scouter in Firestore:", err);
    }
  };

  const handleActivateScouter = async (scouterId: string, scouterName: string) => {
    try {
      const userRef = doc(db, "users", scouterId);
      await setDoc(userRef, {
        status: "Aktif",
        lastActivityDays: 0
      }, { merge: true });
      addLog(`Scouter ${scouterName} yeniden aktif konuma getirildi.`);
    } catch (err) {
      console.error("Failed to activate scouter in Firestore:", err);
    }
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany || !newCountry || !newDMName || !newDMTitle || !newDMEmail || !newProductCategory) {
      setFormFeedback("Lütfen gerekli alanları (Şirket Adı, Ülke, Karar Verici Adı, Unvan, E-Posta, Ürün Kategorisi) doldurun.");
      return;
    }

    setFormFeedback("Yapay Zeka algoritması ile talep skoru hesaplanıyor...");

    const contactStr = `${newDMEmail} | ${newDMPhone || "Tel Belirtilmedi"}`;
    const leadId = `lead_${Date.now()}`;

    const rawLead: ClientLead = {
      id: leadId,
      companyName: newCompany,
      country: newCountry,
      decisionMakerName: newDMName,
      decisionMakerTitle: newDMTitle || "Yetkili",
      contactInfo: contactStr,
      status: "Devam Ediyor",
      assignedScouterId: newScouterId,
      assignedTo: "owner_admin",
      userId: "owner_admin",
      lastUpdateDays: 0,
      demandNotes: newNotes || "Açıklama girilmedi.",
      projectId: currentProjectId,
      website: newWebsite,
      linkedinProfile: newLinkedinProfile,
      companyType: newCompanyType,
      decisionMakerEmail: newDMEmail,
      decisionMakerPhone: newDMPhone,
      productCategory: newProductCategory,
      technicalSpecs: newTechnicalSpecs,
      urgency: newUrgency,
      estimatedVolume: newEstimatedVolume,
      targetPrice: newTargetPrice,
      paymentTerms: newPaymentTerms,
      hsCode: newHsCode,
      deliveryTerm: newDeliveryTerm
    };

    try {
      const response = await fetch("/api/ai/evaluate-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead: rawLead })
      });

      let evaluatedResult: any = {};
      if (response.ok) {
        evaluatedResult = await response.json();
      }

      const finalLead: ClientLead = {
        ...rawLead,
        score: evaluatedResult.ai_lead_skoru || 70,
        grade: (evaluatedResult.ai_lead_skoru >= 85 ? "A-Grade" : evaluatedResult.ai_lead_skoru >= 50 ? "B-Grade" : "C-Grade") as any,
        aiFeedback: evaluatedResult.scouter_geri_bildirim_notu || "Talep kaydedildi.",
        aiReasoning: evaluatedResult.analiz_gerekcesi || "Yerel denetim standartlarına göre işlendi.",
        pillars: evaluatedResult.pillars || {
          sectorFit: "Değerlendirilmedi",
          emailCheck: "Değerlendirilmedi",
          decisionMakerAuthority: "Değerlendirilmedi",
          financialFit: "Değerlendirilmedi",
          volumeCheck: "Değerlendirilmedi",
          specClarity: "Değerlendirilmedi",
          targetPriceCheck: "Değerlendirilmedi"
        },
        status: (evaluatedResult.dashboard_status === "QUOTE READY" ? "Devam Ediyor" : 
                 evaluatedResult.dashboard_status === "REJECTED" ? "Olumsuz Sonuçlandı" : "Devam Ediyor") as any
      };

      await setDoc(doc(db, "leads", leadId), finalLead);
    } catch (err: any) {
      console.error("AI Sourcing Lead evaluation or Firestore save failed:", err);
      // Fallback
      await setDoc(doc(db, "leads", leadId), rawLead);
    }

    // Update Scouter activity details in Firestore
    try {
      const userRef = doc(db, "users", newScouterId);
      await setDoc(userRef, {
        lastActivityDays: 0,
        status: "Aktif"
      }, { merge: true });
    } catch (err) {
      console.error("Failed to update scouter activity in Firestore:", err);
    }

    // Reset Form Fields
    setNewCompany("");
    setNewCountry("");
    setNewDMName("");
    setNewDMTitle("");
    setNewDMEmail("");
    setNewDMPhone("");
    setNewNotes("");
    setNewWebsite("");
    setNewLinkedinProfile("");
    setNewCompanyType("Distribütör");
    setNewProductCategory("");
    setNewTechnicalSpecs("");
    setNewUrgency("Hemen");
    setNewEstimatedVolume("");
    setNewTargetPrice("");
    setNewPaymentTerms("");
    setNewHsCode("");
    setNewDeliveryTerm("FOB");
    setFormFeedback(null);
    setShowAddForm(false);
  };

  const toggleRow = (id: string) => {
    setExpandedLeadId(expandedLeadId === id ? null : id);
  };

  // Critical scouters list for warning panels
  const criticalScouters = useMemo(() => {
    return scouters.filter(s => s.status === "Kritik Eylemsizlik Uyarısı" || s.lastActivityDays >= 10 && s.status !== "Askıya Alındı");
  }, [scouters]);

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* 1. HEADER & INTRO SYSTEM */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-navy to-slate-900 p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl"></div>
        <div className="absolute left-1/3 bottom-0 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl"></div>
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-400 text-xs font-bold font-mono tracking-wider uppercase">
              <Users className="h-3.5 w-3.5" />
              B2B İthalatçı Keşfi Aktif
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight font-display">
              Müşteri Keşfi & Scouter Paneli
            </h2>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Hedef pazarlardaki bağımsız satış profesyonellerimiz <strong>"Scouter"</strong>lar tarafından girilen ithalatçı verileri. Sektör uyumluluğu, karar verici yetkisi, alım hacmi ve ödeme koşulları değerlendirilerek nitelikli talepler filtre edilir.
            </p>
          </div>
          
          <div className="flex flex-col gap-2 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm self-start md:self-auto min-w-[220px]">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest font-mono">
              Aktif Proje Bağlamı
            </div>
            <div className="text-sm font-black text-white font-mono mt-1">
              {getProjectName(currentProjectId)}
            </div>
            <div className="text-[10px] text-slate-400 mt-2 font-mono border-t border-slate-700/50 pt-2">
              Proje Kimliği: <span className="text-teal-400 font-bold">{currentProjectId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PERFORMANCE METRICS & ALERTS (SOP RULES) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KPI Goal Indicator */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-teal-50 text-teal-600">
                <TrendingUp className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full font-mono">
                SOP UYUMLU
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900">30-Günlük KPI Hedefleri</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ağın verimli kalması için her Scouter, 30 günlük süreçte en az 3 adet nitelikli ithalatçı adayını sisteme kazandırmak zorundadır. **AI tarafından reddedilen (C-Grade) lead'ler KPI havuzuna dahil edilmez.**
            </p>
          </div>
          <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">Asgari Nitelikli Aday Hızı:</span>
            <span className="text-slate-800 font-bold font-mono">Min 3 Aday / 30 Gün</span>
          </div>
        </div>

        {/* Inactivity Rule Indicator */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-mono">
                KATILIM KURALI
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900">14-Gün Eylemsizlik Kuralı</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              14 gün boyunca sistemde hiçbir veri girişi, aday kaydı veya yazışma güncellemesi yapmayan temsilciler sistemden otomatik olarak askıya alınır.
            </p>
          </div>
          <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">Askıya Alma Eşiği:</span>
            <span className="text-amber-600 font-bold font-mono">14 GÜN Hareketsizlik</span>
          </div>
        </div>

        {/* Real-time Inactivity Warning Box */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase text-slate-700 tracking-wider font-mono flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                Eylemsizlik Uyarısı
              </h3>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-mono">
                KRİTİK DURUM
              </span>
            </div>
            
            {criticalScouters.length > 0 ? (
              <div className="space-y-3 mt-2">
                {criticalScouters.map(s => (
                  <div key={s.id} className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{s.name}</span>
                      <span className="text-rose-600 font-mono">{s.lastActivityDays} gün eylemsiz</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all" 
                        style={{ width: `${(s.lastActivityDays / 14) * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-end gap-1.5 mt-2.5">
                      <button 
                        onClick={() => handleActivateScouter(s.id, s.name)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-extrabold text-slate-700 uppercase tracking-wider cursor-pointer"
                      >
                        Sıfırla
                      </button>
                      <button 
                        onClick={() => handleSuspendScouter(s.id, s.name)}
                        className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-[10px] font-extrabold text-rose-700 uppercase tracking-wider cursor-pointer"
                      >
                        Askıya Al
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-4 text-center">
                Şu an kritik eşiğe yaklaşan eylemsiz scouter bulunmamaktadır.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. SCOUTERS LIST SECTION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Users className="h-5 w-5 text-navy" />
          <h3 className="text-lg font-black text-slate-900">Freelance Satış Temsilcileri (Scouter'lar)</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {scouters.map(s => {
            const isCritical = s.status === "Kritik Eylemsizlik Uyarısı";
            const isSuspended = s.status === "Askıya Alındı";
            
            // Calculate dynamic active leads count and last update days from Firestore synced leads
            const scouterLeads = leads.filter(l => l.assignedScouterId === s.id);
            const activeLeadsCount = scouterLeads.length;
            
            let lastActivityDays = s.lastActivityDays;
            if (scouterLeads.length > 0) {
              const minDays = Math.min(...scouterLeads.map(l => l.lastUpdateDays ?? 0));
              lastActivityDays = minDays;
            }

            return (
              <div 
                key={s.id} 
                className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 relative overflow-hidden transition-all ${
                  isCritical ? "border-amber-400 bg-amber-50/10" : 
                  isSuspended ? "border-slate-200 bg-slate-50/50 opacity-75" : "border-slate-200"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-base">{s.name}</h4>
                    <span className="text-slate-400 text-[10px] font-semibold tracking-wider uppercase font-mono block mt-0.5">
                      {s.region}
                    </span>
                  </div>
                  
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full font-mono uppercase tracking-wider border ${
                    isCritical ? "bg-amber-50 text-amber-700 border-amber-200" :
                    isSuspended ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                  }`}>
                    {s.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 py-3 font-semibold">
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-mono">Aktif Adaylar (Nitelikli)</div>
                    <div className="text-slate-850 font-bold text-sm mt-0.5">{activeLeadsCount} Firma</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-mono">Son Aktivite</div>
                    <div className="text-slate-850 font-bold text-sm mt-0.5">{lastActivityDays === 0 ? "Bugün" : `${lastActivityDays} gün önce`}</div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedScouterForDetail(s)}
                  className="w-full py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5 text-navy" />
                  Profili İncele
                </button>

                <div className="flex gap-2 justify-end pt-1">
                  {isSuspended ? (
                    <button 
                      onClick={() => handleActivateScouter(s.id, s.name)}
                      className="w-full py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Aktifleştir
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleWarnScouter(s.id, s.name)}
                        disabled={isCritical}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-extrabold uppercase tracking-wider flex-1 flex items-center justify-center gap-1 cursor-pointer ${
                          isCritical ? "border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed" : "border-amber-200 text-amber-700 hover:bg-amber-50"
                        }`}
                      >
                        Uyar
                      </button>
                      <button 
                        onClick={() => handleSuspendScouter(s.id, s.name)}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-extrabold uppercase tracking-wider flex-1 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <UserX className="h-3.5 w-3.5" />
                        Askıya Al
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. LEADS PIPELINE SECTION */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Table Header Controls */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Award className="h-5 w-5 text-teal-600" />
              Keşfedilen Aday İthalatçılar & Distribütörler
            </h3>
            <p className="text-xs text-slate-500">
              Scouter ağı tarafından sağlanan aktif talepler. <strong>Satırlara tıklayarak 4 Ana Sütun Değerlendirme Analizi'ni inceleyebilirsiniz.</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Firma, ülke veya yetkili ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border bg-white rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-navy w-[220px]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border bg-white rounded-lg text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="Hepsi">Tüm Aşamalar</option>
              <option value="İlk Temas">İlk Temas</option>
              <option value="Teklif Aşaması">Teklif Aşaması</option>
              <option value="Nitelikli Talep">Nitelikli Talep</option>
              <option value="Görüşülüyor">Görüşülüyor</option>
              <option value="Reddedildi">Reddedildi (AI)</option>
            </select>

            {currentUser?.role === "admin" && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-4 py-2 bg-navy text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Yeni Aday Ekle
                </button>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  + Yeni Scouter Davet Et
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 5. ADD NEW LEAD FORM (COLLAPSIBLE WITH AI LOADER OVERLAY) */}
        {showAddForm && (
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 animate-slide-down relative">

            <h4 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wider font-mono">Yeni İthalatçı Talebi Kaydet</h4>
            <form onSubmit={handleAddLead} className="space-y-6">
              
              {/* 1. Firma Temel Kimlik ve Güvenilirlik Verileri */}
              <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-navy"></span>
                  1. Firma Temel Kimlik ve Güvenilirlik Verileri
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-650 mb-1">Şirket Tam Adı *</label>
                    <input 
                      type="text" 
                      value={newCompany} 
                      onChange={(e) => setNewCompany(e.target.value)}
                      placeholder="Resmi ticari unvan (örn. Nordic Lounge Furniture GmbH)"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Ülke *</label>
                    <input 
                      type="text" 
                      value={newCountry} 
                      onChange={(e) => setNewCountry(e.target.value)}
                      placeholder="örn. Almanya"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Firma Tipi *</label>
                    <select
                      value={newCompanyType}
                      onChange={(e) => setNewCompanyType(e.target.value as any)}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium cursor-pointer"
                    >
                      <option value="Distribütör">Distribütör</option>
                      <option value="İthalatçı">İthalatçı</option>
                      <option value="Toptancı">Toptancı</option>
                      <option value="Perakende Zinciri">Perakende Zinciri</option>
                      <option value="E-Ticaret Satıcısı">E-Ticaret Satıcısı</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Web Sitesi</label>
                    <input 
                      type="url" 
                      value={newWebsite} 
                      onChange={(e) => setNewWebsite(e.target.value)}
                      placeholder="örn. https://sirket.com"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">LinkedIn Profili</label>
                    <input 
                      type="url" 
                      value={newLinkedinProfile} 
                      onChange={(e) => setNewLinkedinProfile(e.target.value)}
                      placeholder="örn. https://linkedin.com/company/sirket"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Karar Verici (Decision Maker) Yetkinlik Verileri */}
              <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-teal-600"></span>
                  2. Karar Verici Yetkinlik Verileri
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Yetkili Adı ve Soyadı *</label>
                    <input 
                      type="text" 
                      value={newDMName} 
                      onChange={(e) => setNewDMName(e.target.value)}
                      placeholder="Karar verici kişinin adı soyadı"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Unvan (Job Title) *</label>
                    <input 
                      type="text" 
                      value={newDMTitle} 
                      onChange={(e) => setNewDMTitle(e.target.value)}
                      placeholder="örn. Satın Alma Müdürü"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Kurumsal E-Posta Adresi *</label>
                    <input 
                      type="email" 
                      value={newDMEmail} 
                      onChange={(e) => setNewDMEmail(e.target.value)}
                      placeholder="örn. yetkili@sirket.com"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Direkt Telefon / WhatsApp</label>
                    <input 
                      type="text" 
                      value={newDMPhone} 
                      onChange={(e) => setNewDMPhone(e.target.value)}
                      placeholder="örn. +49 170 123456"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Ürün Spesifikasyonları ve Sektörel Detaylar */}
              <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  3. Ürün Spesifikasyonları ve Sektörel Detaylar
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Ürün Kategorisi *</label>
                    <input 
                      type="text" 
                      value={newProductCategory} 
                      onChange={(e) => setNewProductCategory(e.target.value)}
                      placeholder="örn. Armut Koltuk / Meyve Suyu"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Talep Aciliyeti *</label>
                    <select
                      value={newUrgency}
                      onChange={(e) => setNewUrgency(e.target.value as any)}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium cursor-pointer"
                    >
                      <option value="Hemen">Hemen</option>
                      <option value="1-3 Ay İçinde">1-3 Ay İçinde</option>
                      <option value="1 yıl">1 yıl</option>
                      <option value="1 yıldan uzun">1 yıldan uzun</option>
                    </select>
                  </div>
                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Teknik Beklentiler ve Sertifikasyonlar</label>
                    <textarea 
                      value={newTechnicalSpecs} 
                      onChange={(e) => setNewTechnicalSpecs(e.target.value)}
                      placeholder="örn. REACH standartlarına uyum, EPS dolgu sertifikası, alev almazlık vb."
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium h-20 font-sans"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Operasyonel ve Finansal Beklentiler */}
              <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  4. Operasyonel ve Finansal Beklentiler
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Tahmini Alım Hacmi</label>
                    <input 
                      type="text" 
                      value={newEstimatedVolume} 
                      onChange={(e) => setNewEstimatedVolume(e.target.value)}
                      placeholder="örn. Aylık 2 x 40HQ Konteyner"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Hedef Fiyat (Target Price)</label>
                    <input 
                      type="text" 
                      value={newTargetPrice} 
                      onChange={(e) => setNewTargetPrice(e.target.value)}
                      placeholder="örn. $22.50 / FOB İzmir"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Ödeme Şartı Beklentisi</label>
                    <input 
                      type="text" 
                      value={newPaymentTerms} 
                      onChange={(e) => setNewPaymentTerms(e.target.value)}
                      placeholder="örn. %30 Peşin, %70 BL T/T"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">HS Code</label>
                    <input 
                      type="text" 
                      value={newHsCode} 
                      onChange={(e) => setNewHsCode(e.target.value)}
                      placeholder="örn. 9404.90.90"
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">Teslimat Şekli</label>
                    <select
                      value={newDeliveryTerm}
                      onChange={(e) => setNewDeliveryTerm(e.target.value)}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium cursor-pointer"
                    >
                      <option value="FOB">FOB</option>
                      <option value="CIF">CIF</option>
                      <option value="EXW">EXW</option>
                      <option value="DDP">DDP</option>
                      <option value="CFR">CFR</option>
                      <option value="FCA">FCA</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sorumlu Scouter ve Notlar */}
              <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/60 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-655 mb-1">Sorumlu Scouter</label>
                  <select
                    value={newScouterId}
                    onChange={(e) => setNewScouterId(e.target.value)}
                    className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium cursor-pointer"
                  >
                    {scouters.filter(s => s.status !== "Askıya Alındı").map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-655 mb-1">Talep Detayları ve Notlar</label>
                  <input 
                    type="text" 
                    value={newNotes} 
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Ek Notlar (Örn: Lüks mobilya segmenti odaklı, sertifika talepleri var vb.)"
                    className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                  />
                </div>
              </div>

              <div className="col-span-1 md:col-span-3 flex justify-between items-center border-t border-slate-200/60 pt-4">
                {formFeedback && (
                  <span className="text-xs font-bold text-teal-700 font-mono animate-pulse">{formFeedback}</span>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    Kapat
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-all cursor-pointer animate-pulse"
                  >
                    Talebi Analiz Et ve Kaydet
                  </button>
                </div>
              </div>

            </form>
          </div>
        )}

        {/* Table representation */}
        <div className="overflow-x-auto">
          {loadingLeads ? (
            <div className="p-12 text-center text-slate-550 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-navy" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider">Aday Veri Tabanı Senkronize Ediliyor...</span>
            </div>
          ) : filteredLeads.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider font-mono text-[9px]">
                  <th className="py-4 px-6 w-8"></th>
                  <th className="py-4 px-6">Şirket Adı</th>
                  <th className="py-4 px-6">Ülke</th>
                  <th className="py-4 px-6">Karar Verici</th>
                  <th className="py-4 px-6">Sorumlu Scouter</th>
                  <th className="py-4 px-6">Yapay Zeka Skoru</th>
                  <th className="py-4 px-6">Süreç Aşaması</th>
                  <th className="py-4 px-6 text-right">Son Güncelleme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150/40 text-xs">
                {filteredLeads.map(lead => {
                  const scouterName = scouters.find(s => s.id === lead.assignedScouterId)?.name || "Bilinmiyor";
                  const isExpanded = expandedLeadId === lead.id;
                  
                  return (
                    <React.Fragment key={lead.id}>
                      <tr 
                        onClick={() => toggleRow(lead.id)}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-6">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-800">
                          {lead.companyName}
                        </td>
                        <td className="py-4 px-6 font-medium text-slate-600">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {lead.country}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-700">{lead.decisionMakerName}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{lead.decisionMakerTitle}</div>
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-medium">
                          {scouterName}
                        </td>
                        <td className="py-4 px-6">
                          {lead.score !== undefined ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono border ${
                                lead.grade === "A-Grade" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                lead.grade === "B-Grade" ? "bg-amber-50 text-amber-700 border-amber-100" :
                                "bg-rose-50 text-rose-700 border-rose-100"
                              }`}>
                                {lead.score} / 100 ({lead.grade})
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[10px]">ANALİZ EDİLMEDİ</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {lead.processStage ? (
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full font-mono uppercase tracking-wider border ${
                              (() => {
                                const stageCode = lead.processStage.split(" ")[0]; // e.g. "B.1" or "B.14"
                                if (["B.14", "B.13", "B.12", "B.11"].includes(stageCode)) {
                                  return "bg-emerald-50 text-emerald-700 border-emerald-100";
                                } else if (["B.10", "B.9", "B.8"].includes(stageCode)) {
                                  return "bg-blue-50 text-blue-700 border-blue-100";
                                } else if (["B.7", "B.5"].includes(stageCode)) {
                                  return "bg-purple-50 text-purple-700 border-purple-100";
                                } else {
                                  return "bg-amber-50 text-amber-700 border-amber-100";
                                }
                              })()
                            }`}>
                              {lead.processStage}
                            </span>
                          ) : (
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full font-mono uppercase tracking-wider border ${
                              lead.status === "Teklif Aşaması" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                              lead.status === "Görüşülüyor" ? "bg-blue-50 text-blue-700 border-blue-100" :
                              lead.status === "Nitelikli Talep" ? "bg-teal-50 text-teal-700 border-teal-100" :
                              lead.status === "Reddedildi" ? "bg-rose-50 text-rose-700 border-rose-100 animate-pulse" :
                              "bg-slate-50 text-slate-700 border-slate-100"
                            }`}>
                              {lead.status}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-[10px] text-slate-400 font-semibold">
                          {lead.lastUpdateDays === 0 ? "Bugün" : `${lead.lastUpdateDays} gün önce`}
                        </td>
                      </tr>

                      {/* Expandable row for AI Quality Audit details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={8} className="py-5 px-8 border-t border-b border-slate-200/50">
                            <div className="space-y-6 animate-fade-in">
                              
                              {/* 4 Sections of Detailed Lead Data */}
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                
                                {/* 1. Firma Temel Kimlik ve Güvenilirlik Verileri */}
                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-450 font-mono border-b border-slate-100 pb-1 flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-navy"></span>
                                    1. Firma Kimlik & Güvenilirlik
                                  </div>
                                  <div className="space-y-2 text-xs">
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">Resmi Ünvan:</span>
                                      <span className="font-bold text-slate-800">{lead.companyName}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">Ülke:</span>
                                      <span className="font-bold text-slate-800">{lead.country}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">Firma Tipi:</span>
                                      <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold mt-0.5">
                                        {lead.companyType || "Distribütör"}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100">
                                      {lead.website ? (
                                        <a 
                                          href={lead.website} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="text-teal-650 hover:text-teal-700 font-bold hover:underline flex items-center gap-1 text-[10px]"
                                        >
                                          🌐 Web Sitesi
                                        </a>
                                      ) : (
                                        <span className="text-slate-400 italic text-[10px]">🌐 Web adresi yok</span>
                                      )}
                                      {lead.linkedinProfile ? (
                                        <a 
                                          href={lead.linkedinProfile} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="text-blue-650 hover:text-blue-700 font-bold hover:underline flex items-center gap-1 text-[10px]"
                                        >
                                          🔗 LinkedIn Profili
                                        </a>
                                      ) : (
                                        <span className="text-slate-400 italic text-[10px]">🔗 LinkedIn yok</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 2. Karar Verici Yetkinlik Verileri */}
                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-450 font-mono border-b border-slate-100 pb-1 flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-teal-600"></span>
                                    2. Karar Verici Yetkisi
                                  </div>
                                  <div className="space-y-2 text-xs">
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">Yetkili Adı Soyadı:</span>
                                      <span className="font-bold text-slate-800">{lead.decisionMakerName}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">Unvan (Job Title):</span>
                                      <span className="font-bold text-slate-800">{lead.decisionMakerTitle}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">Kurumsal E-Posta:</span>
                                      {lead.decisionMakerEmail ? (
                                        <a href={`mailto:${lead.decisionMakerEmail}`} className="text-teal-650 hover:underline font-bold block truncate">
                                          {lead.decisionMakerEmail}
                                        </a>
                                      ) : (
                                        <span className="font-semibold text-slate-700 block truncate">{lead.contactInfo.split(" | ")[0] || "Belirtilmedi"}</span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">Direkt Tel / WhatsApp:</span>
                                      <span className="font-bold text-slate-800 font-mono text-[11px]">
                                        {lead.decisionMakerPhone || lead.contactInfo.split(" | ")[1] || "Belirtilmedi"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* 3. Ürün Spesifikasyonları ve Sektör */}
                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-450 font-mono border-b border-slate-100 pb-1 flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                    3. Ürün & Sektörel Detaylar
                                  </div>
                                  <div className="space-y-2 text-xs">
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">Ürün Kategorisi:</span>
                                      <span className="font-bold text-slate-800">{lead.productCategory || "Belirtilmedi"}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">Talep Aciliyeti:</span>
                                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${
                                        lead.urgency === "Hemen" ? "bg-rose-50 text-rose-700 border border-rose-100" :
                                        lead.urgency === "1-3 Ay İçinde" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                                        "bg-slate-100 text-slate-600"
                                      }`}>
                                        {lead.urgency || "1-3 Ay İçinde"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">Teknik Beklentiler & Sertifikalar:</span>
                                      <p className="text-[11px] text-slate-600 leading-normal max-h-[60px] overflow-y-auto font-sans mt-0.5">
                                        {lead.technicalSpecs || "Belirtilmemiş."}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* 4. Operasyonel ve Finansal Beklentiler */}
                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-450 font-mono border-b border-slate-100 pb-1 flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                                    4. Finansal & Operasyonel
                                  </div>
                                  <div className="space-y-1.5 text-xs">
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <div>
                                        <span className="text-slate-400 text-[10px] block font-semibold">Alım Hacmi:</span>
                                        <span className="font-bold text-slate-800 text-[11px] block truncate" title={lead.estimatedVolume}>
                                          {lead.estimatedVolume || "Belirtilmedi"}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 text-[10px] block font-semibold">Hedef Fiyat:</span>
                                        <span className="font-bold text-slate-850 text-[11px] block truncate" title={lead.targetPrice}>
                                          {lead.targetPrice || "Belirtilmedi"}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-1.5">
                                      <div>
                                        <span className="text-slate-400 text-[10px] block font-semibold">Teslimat Şekli:</span>
                                        <span className="font-bold text-teal-700 text-[11px] block">{lead.deliveryTerm || "FOB"}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 text-[10px] block font-semibold">HS Code:</span>
                                        <span className="font-bold text-slate-700 text-[11px] block font-mono">{lead.hsCode || "Belirtilmedi"}</span>
                                      </div>
                                    </div>
                                    <div className="border-t border-slate-100 pt-1.5">
                                      <span className="text-slate-400 text-[10px] block font-semibold">Ödeme Beklentisi:</span>
                                      <span className="font-bold text-slate-800 block text-[11px] truncate" title={lead.paymentTerms}>
                                        {lead.paymentTerms || "Belirtilmedi"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                              </div>

                              <div className="space-y-2 w-full">
                                <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Scouter Ek Notları & İletişim</h5>
                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs text-xs text-slate-655 leading-relaxed font-sans min-h-[120px] flex flex-col justify-between">
                                  <p className="italic">"{lead.demandNotes}"</p>
                                  <div className="text-[10px] text-slate-400 font-mono mt-3 border-t border-slate-100 pt-2">
                                    Orijinal Kontak Verisi: {lead.contactInfo}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Users className="h-8 w-8 text-slate-300" />
              <span>Seçilen proje veya filtre ile eşleşen aday kaydı bulunmamaktadır.</span>
            </div>
          )}
        </div>
      </div>

      {/* 6. ADMIN AUDIT & REALTIME ACTION LOGS */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-navy" />
            Saha Operasyon Günlüğü
          </h4>
          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase">
            Canlı İzleme Aktif
          </span>
        </div>
        
        <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] text-slate-300 space-y-2 border border-slate-850">
          {actionLogs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-teal-400 font-bold">&gt;&gt;</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 7. SCOUTER PROFILE DETAIL MODAL */}
      {selectedScouterForDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-white space-y-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-400 text-[10px] font-bold font-mono tracking-wider uppercase">
                  Saha Satış Temsilcisi Profili
                </div>
                <h3 className="text-lg font-black text-white font-display">
                  {selectedScouterForDetail.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedScouterForDetail(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer text-sm font-bold bg-slate-850 px-2.5 py-1 rounded-lg border border-slate-800"
              >
                ✕ Kapat
              </button>
            </div>

            {/* Modal Content - Read-only Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* Firma / Şahıs Adı */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Firma veya Şahıs Adı</span>
                <p className="font-bold text-white text-sm">{selectedScouterForDetail.companyName || "Belirtilmedi"}</p>
              </div>

              {/* İletişim Kurulacak Yetkili */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">İletişim Kurulacak Yetkili</span>
                <p className="font-bold text-white text-sm">{selectedScouterForDetail.contactPerson || "Belirtilmedi"}</p>
              </div>

              {/* Unvan */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Unvan (Title)</span>
                <p className="font-bold text-white text-sm">{selectedScouterForDetail.title || "Belirtilmedi"}</p>
              </div>

              {/* Bölge */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Bölge</span>
                <p className="font-bold text-white text-sm">{selectedScouterForDetail.region || "Küresel (Test Ağı)"}</p>
              </div>

              {/* Ana E-posta */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1 col-span-1 md:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Ana E-posta</span>
                <p className="font-bold text-teal-400 text-sm font-mono">{selectedScouterForDetail.email}</p>
              </div>

              {/* İkincil E-posta */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">İkincil E-posta</span>
                <p className="font-bold text-white text-sm font-mono">{selectedScouterForDetail.secondaryEmail || "Belirtilmedi"}</p>
              </div>

              {/* İş Telefonu */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">İş Telefonu</span>
                <p className="font-bold text-white text-sm font-mono">{selectedScouterForDetail.workPhone || "Belirtilmedi"}</p>
              </div>

              {/* Cep Telefonu */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Cep Telefonu</span>
                <p className="font-bold text-white text-sm font-mono">{selectedScouterForDetail.cellPhone || "Belirtilmedi"}</p>
              </div>

              {/* Web Sitesi */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Web Sitesi</span>
                {selectedScouterForDetail.website ? (
                  <a
                    href={selectedScouterForDetail.website}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-teal-400 hover:text-teal-300 hover:underline block truncate text-sm font-mono"
                  >
                    {selectedScouterForDetail.website}
                  </a>
                ) : (
                  <p className="font-bold text-white text-sm">Belirtilmedi</p>
                )}
              </div>

              {/* Durum / Kayıt Durumu */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1 col-span-1 md:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Kayıt Durumu</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono uppercase tracking-wider border ${
                    selectedScouterForDetail.onboardingCompleted 
                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-900" 
                      : "bg-amber-950/40 text-amber-400 border-amber-900"
                  }`}>
                    {selectedScouterForDetail.onboardingCompleted ? "Profil Tamamlandı (Aktif)" : "İlk Kayıt Bekleniyor"}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono uppercase tracking-wider border ${
                    selectedScouterForDetail.status === "Aktif" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    selectedScouterForDetail.status === "Askıya Alındı" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                    "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}>
                    Sistem Durumu: {selectedScouterForDetail.status}
                  </span>
                </div>
              </div>

              {/* Proje Atama Menüsü */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2 col-span-1 md:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">Atanmış Projeler</span>
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedScouterForDetail.assignedProjects && selectedScouterForDetail.assignedProjects.length > 0 ? (
                    selectedScouterForDetail.assignedProjects.map(pId => (
                      <span key={pId} className="px-2 py-1 bg-teal-500/10 border border-teal-500/25 text-teal-400 text-[10px] font-bold rounded-lg font-mono flex items-center gap-1.5">
                        {pId}
                        <button
                          onClick={async () => {
                            const updated = selectedScouterForDetail.assignedProjects?.filter(x => x !== pId) || [];
                            try {
                              // Find user in "users" collection by email to update their assignedProjects
                              const emailKey = selectedScouterForDetail.email.toLowerCase().trim();
                              const usersQuery = query(collection(db, "users"), where("email", "==", emailKey));
                              const usersSnap = await getDocs(usersQuery);
                              if (!usersSnap.empty) {
                                for (const uDoc of usersSnap.docs) {
                                  await updateDoc(uDoc.ref, {
                                    assignedProjects: arrayRemove(pId)
                                  });
                                }
                              }
                              
                              setSelectedScouterForDetail(prev => prev ? { ...prev, assignedProjects: updated } : null);
                              addLog(`Scouter ${selectedScouterForDetail.name} için proje '${pId}' ataması kaldırıldı.`);
                            } catch (err) {
                              console.error("Failed to remove project assignment:", err);
                            }
                          }}
                          className="text-red-400 hover:text-red-300 font-bold ml-1 cursor-pointer font-sans"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 text-xs italic">Henüz atanmış bir proje yok.</span>
                  )}
                </div>

                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">Projeye Ata</span>
                <div className="flex gap-2">
                  <select
                    value={selectedProjectToAssign}
                    onChange={(e) => setSelectedProjectToAssign(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-850 text-xs text-slate-200 py-2 px-3 rounded-xl focus:outline-none focus:border-teal-500 cursor-pointer font-bold font-mono"
                  >
                    <option value="">Proje Seçin</option>
                    {projects
                      .filter(p => !selectedScouterForDetail.assignedProjects?.includes(p.id))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.id} ({p.name})</option>
                      ))}
                  </select>
                  <button
                    onClick={async () => {
                      if (!selectedProjectToAssign) return;
                      const updated = [...(selectedScouterForDetail.assignedProjects || []), selectedProjectToAssign];
                      try {
                        // Also query and update users collection document by email
                        const emailKey = selectedScouterForDetail.email.toLowerCase().trim();
                        const usersQuery = query(collection(db, "users"), where("email", "==", emailKey));
                        const usersSnap = await getDocs(usersQuery);
                        if (!usersSnap.empty) {
                          for (const uDoc of usersSnap.docs) {
                            await updateDoc(uDoc.ref, {
                              assignedProjects: arrayUnion(selectedProjectToAssign)
                            });
                          }
                        }
                        
                        setSelectedScouterForDetail(prev => prev ? { ...prev, assignedProjects: updated } : null);
                        addLog(`Scouter ${selectedScouterForDetail.name} için '${selectedProjectToAssign}' projesi atandı.`);
                        setSelectedProjectToAssign("");
                      } catch (err) {
                        console.error("Failed to assign project:", err);
                      }
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-slate-955 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Ata
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedScouterForDetail(null)}
                className="px-5 py-2 bg-slate-850 hover:bg-slate-800 text-xs font-bold rounded-xl transition border border-slate-800 cursor-pointer text-white"
              >
                Kapat
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 9. SCOUTER INVITATION MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-white space-y-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-400 text-[10px] font-bold font-mono tracking-wider uppercase">
                  Davet Sistemi
                </div>
                <h3 className="text-lg font-black text-white font-display">
                  Yeni Scouter Davet Et
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteFeedback(null);
                }}
                className="text-slate-400 hover:text-white transition cursor-pointer text-sm font-bold bg-slate-850 px-2.5 py-1 rounded-lg border border-slate-800"
              >
                ✕ Kapat
              </button>
            </div>

            {inviteFeedback && (
              <div className="bg-teal-500/10 border border-teal-500/20 text-teal-350 text-xs p-3.5 rounded-xl font-medium leading-relaxed font-mono">
                {inviteFeedback}
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              
              {/* Ad Soyad */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Ad Soyad *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Test Satıcı"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition"
                />
              </div>

              {/* E-posta */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  E-posta *
                </label>
                <input
                  type="email"
                  required
                  placeholder="Örn: satici@firma.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition font-mono"
                />
              </div>

              {/* Proje Seçimi */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Projeye Ata
                </label>
                <select
                  value={inviteProjectId}
                  onChange={(e) => setInviteProjectId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition font-mono font-bold cursor-pointer"
                >
                  <option value="">Proje Seçilmesin (Sonra Atanacak)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.id} ({p.name})</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteFeedback(null);
                  }}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-850 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-slate-955 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Daveti Gönder
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
