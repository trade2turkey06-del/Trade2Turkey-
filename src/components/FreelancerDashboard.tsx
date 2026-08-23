import React, { useState, useEffect, useMemo } from "react";
import { 
  Compass, Search, AlertTriangle, CheckCircle, 
  MapPin, Sparkles, ChevronDown, ChevronUp, AlertOctagon, 
  RefreshCw, TrendingUp, ShieldAlert, UserCheck, UserX, LogOut,
  ShieldCheck, Loader2, FileText, Trash2
} from "lucide-react";
import { UserTenant } from "../data/usersData";
import { db, auth } from "../lib/firebase";
import { 
  query, collection, where, or, onSnapshot, doc, setDoc, deleteDoc, getDocs, writeBatch
} from "firebase/firestore";
import GoogleDriveFolder from "./GoogleDriveFolder";
import { PROJECT_NAMES } from "../data/driveData";
import { MarketInsightsView } from "./MarketInsights";

interface FreelancerDashboardProps {
  currentUser: UserTenant;
  onLogout: () => void;
  auditMode?: boolean;
  auditEmail?: string;
}

interface ClientLead {
  id: string;
  companyName: string;
  country?: string;
  decisionMakerName?: string;
  decisionMakerTitle?: string;
  contactInfo?: string;
  status: "Devam Ediyor" | "Olumsuz Sonuçlandı" | "Olumlu Sonuçlandı" | "İlk Temas" | "Teklif Aşaması" | "Nitelikli Talep" | "Görüşülüyor" | "Reddedildi";
  assignedScouterId?: string;
  assignedTo?: string;
  userId?: string;
  lastUpdateDays?: number;
  demandNotes?: string;
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
  website?: string;
  linkedinProfile?: string;
  companyType?: "Distribütör" | "İthalatçı" | "Toptancı" | "Perakende Zinciri" | "E-Ticaret Satıcısı";
  decisionMakerEmail?: string;
  decisionMakerPhone?: string;
  productCategory?: string;
  technicalSpecs?: string;
  urgency?: "Hemen" | "1-3 Ay İçinde" | "1 yıl" | "1 yıldan uzun";
  estimatedVolume?: string;
  targetPrice?: string;
  paymentTerms?: string;
  hsCode?: string;
  deliveryTerm?: string;
  createdAt?: string;
  processStage?: string;
  freelancerEmail?: string;
  sop_steps?: any[];
}

export const freelanceSOPData = [
  { step: "B.1", task: "NCNDA Sözleşmesi", kpi: "Taraflarca İmzalanmış ve Doğrulanmış NCNDA Belgesinin Yüklenmesi", storage: "Ortak Klasör - Aşama B.1" },
  { step: "B.2", task: "Tedarikçi Bilgisi Aktarımı", kpi: "Tedarikçi verilerinin ve analizlerinin sisteme eksiksiz girilmesi", storage: "Ortak Klasör - Aşama B.2" },
  { step: "B.3", task: "Potansiyel müşterinin sisteme girilmesi", kpi: "Min. 1 Uygun satın alma potansiyel tespiti", storage: "Ortak Klasör - Aşama B.3" },
  { step: "B.4", task: "Gizlilik Sözleşmesi (NDA) (Alıcı ile)", kpi: "Taraflarca İmzalanmış ve Doğrulanmış 1 NDA Belgesi", storage: "Ortak Klasör - Aşama B.4" },
  { step: "B.5", task: "İlk İletişim ve Tanıtım", kpi: "30 gün içinde potansiyel müşteriden dönüş", storage: "Ortak Klasör - Aşama B.5" },
  { step: "B.7", task: "Yurt dışı alıcılardan toplanan teklif talepleri", kpi: "Fiyat teklifi yapılması", storage: "Ortak Klasör - Aşama B.7" },
  { step: "B.8", task: "Alıcılarla yapılan ilk tanışma toplantısı", kpi: "Sunum Sonrası Toplantı Tutanaklarının %100 Eksiksiz Girilmesi", storage: "Ortak Klasör - Aşama B.8" },
  { step: "B.9", task: "Numune Gönderimi", kpi: "Müşteri Tarafından İmzalanmış Numune Talep Formu", storage: "Ortak Klasör - Aşama B.9" },
  { step: "B.10", task: "Numune Geri Bildirimi ve Revizyon Güncellemesi", kpi: "Müşteri Geri Bildirim Skoru ve Revizyon Listesinin Netleşmesi", storage: "Ortak Klasör - Aşama B.10" },
  { step: "B.11", task: "Nihai Ambalaj ve Etiketlemenin belirtilmesi", kpi: "İlgili Standartlar göre %100 Paketleme Uyumluluğu", storage: "Ortak Klasör - Aşama B.11" },
  { step: "B.12", task: "Nihai Özellikler ve son maliyetlendirme", kpi: "Hedef ve Nihai Maliyet Arasındaki Fark", storage: "Ortak Klasör - Aşama B.12" },
  { step: "B.13", task: "Sipariş Öncesi Uyum Toplantısı", kpi: "Sipariş Öncesi Teslimat ve Şartlarında Tam Mutabakat", storage: "Ortak Klasör - Aşama B.13" },
  { step: "B.14", task: "Satın Alma Siparişi (PO) ve Proforma Fatura (PI)", kpi: "Onaylı PO Belgesi ve Onaylı Proforma Faturanın sisteme yüklenmesi", storage: "Ortak Klasör - Aşama B.14" }
];

export default function FreelancerDashboard({ currentUser, onLogout, auditMode = false, auditEmail }: FreelancerDashboardProps) {
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [activeTab, setActiveTab] = useState<"leads" | "insights">("leads");

  // Real-time listener for the logged-in user document
  const [userData, setUserData] = useState<UserTenant | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    if (!currentUser?.email) {
      setLoadingUser(false);
      return;
    }
    setLoadingUser(true);
    const emailKey = currentUser.email.toLowerCase().trim();
    const q = query(collection(db, "users"), where("email", "==", emailKey));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as UserTenant;
        setUserData(data);
      } else {
        setUserData(null);
      }
      setLoadingUser(false);
    }, (error) => {
      console.error("Error listening to user document in FreelancerDashboard:", error);
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, [currentUser?.email]);

  const activeUser = userData || currentUser;
  const assignedProjects = activeUser?.assignedProjects ?? [];

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return assignedProjects[0] || "";
  });

  useEffect(() => {
    if (assignedProjects.length > 0) {
      if (!selectedProjectId || !assignedProjects.includes(selectedProjectId)) {
        setSelectedProjectId(assignedProjects[0]);
      }
    } else {
      setSelectedProjectId("");
    }
  }, [assignedProjects, selectedProjectId]);

  const activeProjId = selectedProjectId || "PROJE-UNLU MAMÜLLER";

  // Onboarding form state
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    title: "",
    secondaryEmail: "",
    workPhone: "",
    cellPhone: "",
    website: ""
  });

  useEffect(() => {
    if (activeUser) {
      setFormData({
        companyName: activeUser.companyName || "",
        contactPerson: activeUser.contactPerson || "",
        title: activeUser.title || "",
        secondaryEmail: activeUser.secondaryEmail || "",
        workPhone: activeUser.workPhone || "",
        cellPhone: activeUser.cellPhone || "",
        website: activeUser.website || ""
      });
    }
  }, [activeUser]);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim() || !formData.contactPerson.trim() || !formData.cellPhone.trim()) {
      setFeedback("Lütfen gerekli alanları (Firma/Şahıs Adı, İletişim Yetkilisi, Cep Telefonu) doldurun.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      // 1. Update user profile document in users collection by email query
      const emailKey = activeUser.email.toLowerCase().trim();
      const usersQuery = query(collection(db, "users"), where("email", "==", emailKey));
      const usersSnap = await getDocs(usersQuery);
      if (!usersSnap.empty) {
        for (const uDoc of usersSnap.docs) {
          await setDoc(uDoc.ref, {
            ...formData,
            onboardingCompleted: true,
            displayName: formData.contactPerson,
            name: formData.contactPerson,
            status: "active"
          }, { merge: true });
        }
      }
    } catch (err) {
      console.error("Onboarding save failed:", err);
      setFeedback("Profil güncellenirken bir hata oluştu. Lütfen tekrar deneyin.");
      setSaving(false);
    }
  };

  const getProjectName = (projectId: string) => {
    const globalNames = (window as any).PROJECT_NAMES || JSON.parse(localStorage.getItem("t2t_project_names") || "{}");
    return globalNames[projectId] || PROJECT_NAMES[projectId] || projectId;
  };

  const getUserDisplayName = () => {
    if (activeUser?.displayName?.trim()) return activeUser.displayName;
    if (activeUser?.name?.trim()) return activeUser.name;
    if (activeUser?.companyName?.trim()) return activeUser.companyName;
    if (activeUser?.email) {
      return activeUser.email.split("@")[0];
    }
    return "";
  };

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Hepsi");
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);

  // SOP Steps states
  const loadingSOP = false;
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [sopSearchTerm, setSopSearchTerm] = useState("");

  // Add Lead Modal states
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadCompanyName, setNewLeadCompanyName] = useState("");
  const [addingLead, setAddingLead] = useState(false);
  const [addLeadError, setAddLeadError] = useState<string | null>(null);

  // Delete Lead states
  const [leadToDelete, setLeadToDelete] = useState<ClientLead | null>(null);
  const [deletingLead, setDeletingLead] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  // Time filtering state
  const [timeRange, setTimeRange] = useState<string>("all");

  // 1. Strict Query Isolation: Query only where freelancerEmail == email AND projectId == activeProjId
  useEffect(() => {
    if (!activeUser?.email) return;

    setLoadingLeads(true);
    const leadsCollectionRef = collection(db, "leads");
    
    const q = query(
      leadsCollectionRef,
      where("freelancerEmail", "==", activeUser.email.toLowerCase().trim()),
      where("projectId", "==", activeProjId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLeads: ClientLead[] = [];
      snapshot.forEach(doc => {
        fetchedLeads.push(doc.data() as ClientLead);
      });
      // Sort by creation or ID
      fetchedLeads.sort((a, b) => b.createdAt ? b.createdAt.localeCompare(a.createdAt) : b.id.localeCompare(a.id));
      setLeads(fetchedLeads);
      setLoadingLeads(false);
    }, (error) => {
      console.error("Firestore leads sync error:", error);
      setLoadingLeads(false);
    });

    return () => unsubscribe();
  }, [activeUser?.email, activeProjId]);

  // handle new B2B lead addition
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadCompanyName.trim() || !activeUser?.email) return;

    setAddingLead(true);
    setAddLeadError(null);

    try {
      const generatedId = `lead_${Date.now()}`;
      const newLead = {
        id: generatedId,
        leadId: generatedId,
        freelancerEmail: activeUser.email.toLowerCase().trim(),
        projectId: activeProjId,
        companyName: newLeadCompanyName.trim(),
        createdAt: new Date().toISOString(),
        status: "Devam Ediyor",
        // Deep copy empty 15 steps
        sop_steps: freelanceSOPData.map(s => ({
          step: s.step,
          task: s.task,
          kpi: s.kpi,
          storage: s.storage,
          status: "Pending"
        }))
      };

      await setDoc(doc(db, "leads", generatedId), newLead);
      setShowAddLeadModal(false);
      setNewLeadCompanyName("");
    } catch (err) {
      console.error("Failed to add new B2B Lead:", err);
      setAddLeadError("Müşteri adayı eklenirken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setAddingLead(false);
    }
  };

  // handle B2B lead deletion
  const handleConfirmDelete = async () => {
    if (!leadToDelete) return;
    setDeletingLead(true);
    try {
      await deleteDoc(doc(db, "leads", leadToDelete.id));
      setDeleteFeedback("Müşteri kaydı başarıyla silindi.");
      setTimeout(() => setDeleteFeedback(null), 5000);
      setLeadToDelete(null);
    } catch (err) {
      console.error("Failed to delete lead document:", err);
      setDeleteFeedback("Hata: Aday silinirken bir hata oluştu.");
      setTimeout(() => setDeleteFeedback(null), 5000);
    } finally {
      setDeletingLead(false);
    }
  };

  // Update Freelance SOP Step Status in Lead Document
  const handleUpdateSopStatus = async (stepIdOrKey: string, newStatus: string, leadId: string) => {
    try {
      if (!leadId || leadId.startsWith("fallback_")) return;

      // Extract step key (e.g. "B.1") from step ID if it's formatted
      const stepKey = stepIdOrKey.includes("_") 
        ? stepIdOrKey.split("_").pop() || stepIdOrKey 
        : stepIdOrKey;

      const leadRef = doc(db, "leads", leadId);
      const leadDoc = leads.find(l => l.id === leadId);
      if (!leadDoc) return;

      const updatedSopSteps = (leadDoc.sop_steps || []).map((s: any) => {
        if (s.step === stepKey) {
          const completedAt = newStatus === "Completed" ? new Date().toISOString() : null;
          return { ...s, status: newStatus, completedAt };
        }
        return s;
      });

      const stepDetails = updatedSopSteps.find((s: any) => s.step === stepKey);
      const stageText = stepDetails ? `${stepKey} - ${stepDetails.task}` : "";

      await setDoc(leadRef, {
        sop_steps: updatedSopSteps,
        processStage: stageText
      }, { merge: true });

    } catch (err) {
      console.error("Failed to update freelance SOP status in lead document:", err);
    }
  };



  // Update lead status in Firestore
  const handleUpdateStatus = async (leadId: string, newStatus: ClientLead["status"]) => {
    try {
      const docRef = doc(db, "leads", leadId);
      await setDoc(docRef, { status: newStatus, lastUpdateDays: 0 }, { merge: true });
    } catch (err) {
      console.error("Lead status update failed:", err);
    }
  };

  // Filter leads
  const filteredLeads = useMemo(() => {
    const actualFiltered = leads.filter(l => {
      const matchesSearch = 
        l.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.country || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.decisionMakerName || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const mappedStatus = ["Devam Ediyor", "Olumlu Sonuçlandı", "Olumsuz Sonuçlandı"].includes(l.status)
        ? l.status
        : "Olumsuz Sonuçlandı";

      const matchesStatus = statusFilter === "Hepsi" || mappedStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });

    // Check if there is already a lead for the active project
    const hasActiveProjLead = actualFiltered.some(l => l.projectId === activeProjId);
    
    if (!hasActiveProjLead && activeProjId) {
      const fallbackLead: ClientLead = {
        id: `fallback_${activeProjId}`,
        projectId: activeProjId,
        companyName: "Aktif Satış ve Pazarlık Projesi (Tedarik Hattı)",
        country: "Türkiye",
        decisionMakerName: "Saha Koordinatörü",
        decisionMakerTitle: "Saha Koordinatörü",
        contactInfo: "N/A",
        assignedScouterId: activeUser?.id ?? "",
        lastUpdateDays: 0,
        demandNotes: "Önceden kurgulanan kurumsal aktif proje bağlamıdır.",
        status: "Devam Ediyor",
        userId: activeUser?.id ?? "",
        assignedTo: activeUser?.id ?? "",
        score: 100,
        productCategory: "Unlu Mamüller",
        sop_steps: freelanceSOPData.map(s => ({
          step: s.step,
          task: s.task,
          kpi: s.kpi,
          storage: s.storage,
          status: "Pending"
        }))
      };
      
      // Check if it matches search and status filters
      const matchesSearch = 
        fallbackLead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fallbackLead.projectId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "Hepsi" || statusFilter === "Devam Ediyor";
      if (matchesSearch && matchesStatus) {
        actualFiltered.push(fallbackLead);
      }
    }

    return actualFiltered;
  }, [leads, searchTerm, statusFilter, activeUser, activeProjId]);

  const globalKpis = useMemo(() => {
    const criticalSteps = ["B.7", "B.8", "B.9", "B.14"];
    let totalCriticalTasks = 0;
    let totalOrders = 0;
    
    // Step-by-step breakdown counts
    const breakdown: { [key: string]: number } = {
      "B.7": 0,
      "B.8": 0,
      "B.9": 0,
      "B.14": 0
    };

    const now = new Date();
    const totalRegisteredLeads = leads.filter(l => !l.id.startsWith("fallback_")).length;

    leads.forEach(lead => {
      // Skip fallback leads
      if (lead.id.startsWith("fallback_")) return;

      (lead.sop_steps || []).forEach((s: any) => {
        if (criticalSteps.includes(s.step) && s.status === "Completed") {
          let matchesFilter = true;

          if (timeRange !== "all" && s.completedAt) {
            const completedDate = new Date(s.completedAt);
            const diffTime = Math.abs(now.getTime() - completedDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const limitDays = parseInt(timeRange);
            if (diffDays > limitDays) {
              matchesFilter = false;
            }
          } else if (timeRange !== "all" && !s.completedAt) {
            matchesFilter = false;
          }

          if (matchesFilter) {
            if (s.step === "B.14") {
              totalOrders += 1;
            } else {
              totalCriticalTasks += 1;
            }
            breakdown[s.step] = (breakdown[s.step] || 0) + 1;
          }
        }
      });
    });

    return { totalCriticalTasks, totalOrders, breakdown, totalRegisteredLeads };
  }, [leads, timeRange]);

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-slate-955 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none antialiased relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-teal-500/5 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-teal-500/5 blur-[130px] pointer-events-none" />
        <div className="relative max-w-md bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-teal-400 mx-auto" />
          <div className="space-y-2">
            <h2 className="text-lg font-black text-white font-display">Yükleniyor</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-sans font-mono">
              Saha portalı ve kullanıcı atamaları sorgulanıyor...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!auditMode && !activeUser?.onboardingCompleted) {
    return (
      <div className="min-h-screen bg-slate-955 text-slate-100 flex flex-col items-center justify-center p-4 md:p-8 selection:bg-teal-500 selection:text-black relative overflow-hidden">
        {/* Background radial soft light blobs of Navy Ink */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-teal-500/5 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-teal-500/5 blur-[130px] pointer-events-none" />

        <div className="relative w-full max-w-2xl bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 p-6 md:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2 select-none border-b border-slate-800 pb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-400 text-xs font-bold font-mono tracking-wider uppercase">
              <ShieldCheck className="h-4 w-4" />
              PROFİL TAMAMLAMA (ONBOARDING)
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white font-display tracking-tight leading-tight">
              Saha Satış Temsilcisi Kaydı
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Tedarik hattı platformunu kullanabilmek için lütfen saha satış temsilcisi profil bilgilerinizi eksiksiz tamamlayın.
            </p>
          </div>

          {feedback && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3.5 rounded-xl font-medium leading-relaxed font-mono">
              {feedback}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Firma veya Şahıs Adı */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Firma veya Şahıs Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Wahkr veya Zulqarnain Deen"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition"
                />
              </div>

              {/* İletişim Kurulacak Yetkili */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  İletişim Kurulacak Yetkili *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Zulqarnain Deen"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition"
                />
              </div>

              {/* Unvan */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Unvan (Title)
                </label>
                <input
                  type="text"
                  placeholder="Örn: Satış Temsilcisi"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition"
                />
              </div>

              {/* Ana E-posta (Salt Okunur) */}
              <div className="space-y-1.5 font-sans opacity-70">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Ana E-posta (Salt Okunur)
                </label>
                <input
                  type="email"
                  readOnly
                  disabled
                  value={activeUser?.email ?? ""}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 cursor-not-allowed font-mono"
                />
              </div>

              {/* İkincil E-posta */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  İkincil E-posta
                </label>
                <input
                  type="email"
                  placeholder="Örn: yetkili@ikincil.com"
                  value={formData.secondaryEmail}
                  onChange={(e) => setFormData({ ...formData, secondaryEmail: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition font-mono"
                />
              </div>

              {/* İş Telefonu */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  İş Telefonu
                </label>
                <input
                  type="text"
                  placeholder="Örn: +90 212 111 2233"
                  value={formData.workPhone}
                  onChange={(e) => setFormData({ ...formData, workPhone: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition font-mono"
                />
              </div>

              {/* Cep Telefonu */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Cep Telefonu *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: +90 532 111 2233"
                  value={formData.cellPhone}
                  onChange={(e) => setFormData({ ...formData, cellPhone: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition font-mono"
                />
              </div>

              {/* Web Sitesi */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Web Sitesi
                </label>
                <input
                  type="text"
                  placeholder="Örn: https://wahkr.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition font-mono"
                />
              </div>

            </div>

            <div className="pt-4 flex justify-between items-center border-t border-slate-800 mt-6">
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2 border border-slate-800 hover:border-red-500/30 hover:bg-red-950/10 text-xs font-bold text-slate-400 hover:text-red-400 rounded-xl transition cursor-pointer"
              >
                Çıkış Yap
              </button>
              
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> Kaydediliyor...
                  </>
                ) : (
                  "Profili Kaydet ve Devam Et"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 3.7. Render project warning fallback if freelancer has no assigned projects
  if (assignedProjects.length === 0) {
    return (
      <div className="min-h-screen bg-slate-955 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none antialiased relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-teal-500/5 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-teal-500/5 blur-[130px] pointer-events-none" />

        <div className="relative max-w-md bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-white font-display">Henüz Atanmış Proje Yok</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Saha satış portalını görüntüleyebilmek için yöneticiniz tarafından en az bir projeye atanmanız gerekmektedir. Lütfen yöneticinizle iletişime geçin.
            </p>
          </div>
          <button
            onClick={onLogout}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition cursor-pointer text-white border border-slate-700/50"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased selection:bg-teal-500 selection:text-black">
      
      {/* GLASSMORPHISM HEADER BANNER */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-900 bg-slate-950/80 backdrop-blur-xl py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-8 w-8 rounded-lg bg-teal-500 flex items-center justify-center text-black font-black font-mono">T</span>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white font-display flex items-center gap-1.5 leading-none">
                <span>Trade</span>
                <span className="text-teal-400 font-bold">2</span>
                <span>Turkey</span>
                <span className="text-[9px] bg-teal-500/10 text-teal-400 font-extrabold px-1.5 py-0.5 rounded font-mono tracking-wider uppercase border border-teal-500/20">
                  FREE-SATICI
                </span>
              </h1>
              <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest font-mono">
                Saha Temsilcisi İzole Paneli
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-350">{getUserDisplayName()}</span>
              <span className="text-[10px] text-slate-500 font-mono">{activeUser?.email ?? ""}</span>
            </div>

            {!auditMode ? (
              <button 
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-red-500/30 hover:bg-red-950/10 text-xs font-bold text-slate-400 hover:text-red-400 transition cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Güvenli Çıkış</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs font-bold text-amber-400 font-mono">
                🔒 DENETİM GÖRÜNÜMÜ
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Welcome Billboard */}
        <div className="bg-gradient-to-br from-slate-900 via-navy to-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 h-64 w-64 rounded-full bg-teal-500/5 blur-3xl"></div>
          <div className="space-y-3">
            <span className="bg-teal-500/10 text-teal-400 text-[10px] font-extrabold uppercase font-mono px-3 py-1 rounded-full tracking-wider border border-teal-500/20 flex items-center gap-1.5 w-fit">
              <ShieldCheck className="h-3.5 w-3.5" />
              Kişisel Saha Satış Portalı
            </span>
            <h2 className="text-2xl md:text-3xl font-black font-display tracking-tight leading-tight">
              Hoş Geldiniz{getUserDisplayName() ? `, ${getUserDisplayName()}` : ""}
            </h2>
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-3xl">
              Tedarik hattı için bulduğunuz ithalatçı ve distribütör adaylarını aşağıdan yönetebilirsiniz. Tüm veri tabanı sorgulamalarınız ve kayıtlarınız **tamamen sizin kimliğinizle ({activeUser?.id ?? ""}) izole edilmiştir.** Admin dışındaki kullanıcılar bu verilere erişemez.
            </p>

            {assignedProjects.length > 1 ? (
              <div className="mt-4 flex items-center gap-2 bg-slate-950/40 p-2 rounded-xl border border-slate-800 w-fit">
                <span className="text-[10px] font-bold text-slate-455 font-mono pl-1">ÇALIŞTIĞINIZ PROJE:</span>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs text-slate-200 py-1.5 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer font-bold font-mono"
                >
                  {assignedProjects.map(pId => (
                    <option key={pId} value={pId}>{getProjectName(pId)}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mt-4 text-xs font-bold text-slate-400 font-mono bg-slate-955/40 px-3 py-2 rounded-xl border border-slate-800/80 w-fit">
                ÇALIŞTIĞINIZ PROJE: {getProjectName(assignedProjects[0] || activeProjId)}
              </div>
            )}
          </div>
        </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-850 gap-1 select-none">
        <button
          onClick={() => setActiveTab("leads")}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === "leads"
              ? "border-teal-500 text-teal-400 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-200"
          }`}
        >
          📋 Adaylar & Performans
        </button>
        <button
          onClick={() => setActiveTab("insights")}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === "insights"
              ? "border-teal-500 text-teal-400 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-200"
          }`}
        >
          🔍 Pazar Araştırması (Market Insights)
        </button>
      </div>

      {activeTab === "leads" ? (
        <>
          {/* Satış Performans Analitiği (Global KPI Dashboard) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-teal-400" />
                Satış Performans Analitiği
              </h4>
              <p className="text-[10px] text-slate-400 mt-1">
                Tüm müşterilerinizdeki kritik satış ve keşif adımlarının genel performans durumunu izleyin.
              </p>
            </div>
            
            {/* Time Filter Dropdown */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 font-mono">ZAMAN ARALIĞI:</span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-transparent text-xs text-teal-400 font-bold focus:outline-none cursor-pointer font-mono"
              >
                <option value="all" className="bg-slate-900 text-slate-200">Tüm Zamanlar</option>
                <option value="30" className="bg-slate-900 text-slate-200">Son 30 Gün</option>
                <option value="60" className="bg-slate-900 text-slate-200">Son 60 Gün</option>
                <option value="90" className="bg-slate-900 text-slate-200">Son 90 Gün</option>
                <option value="180" className="bg-slate-900 text-slate-200">Son 180 Gün</option>
                <option value="365" className="bg-slate-900 text-slate-200">Son 1 Yıl</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* B.3 Potansiyel Müşteri */}
            <div className="bg-slate-955 p-5 rounded-2xl border border-emerald-500/30 text-emerald-400 bg-emerald-950/10 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono">B.3 - POTANSİYEL MÜŞTERİ</span>
              <div className="py-4">
                <span className="text-3xl font-black text-white font-mono tracking-tight">{globalKpis.totalRegisteredLeads}</span>
              </div>
              <span className="text-[9px] text-slate-500 font-semibold font-mono">(Sisteme Girilen Toplam Müşteri)</span>
            </div>

            {/* Breakdown Cards */}
            {[
              { key: "B.7", title: "Teklif Talebi", color: "border-purple-500/20 text-purple-400 bg-purple-950/10", subtitle: "(Toplanan Teklif Talepleri)" },
              { key: "B.8", title: "Tanışma Toplantısı", color: "border-yellow-500/20 text-yellow-400 bg-yellow-950/10", subtitle: "(Yapılan Tanışma Toplantıları)" },
              { key: "B.9", title: "Numune Gönderimi", color: "border-rose-500/20 text-rose-400 bg-rose-950/10", subtitle: "(Gerçekleşen Numune Gönderimleri)" }
            ].map(item => (
              <div key={item.key} className={`border p-5 rounded-2xl flex flex-col justify-between ${item.color}`}>
                <span className="text-[10px] font-bold uppercase tracking-widest font-mono">{item.key} - {item.title}</span>
                <div className="py-4">
                  <span className="text-3xl font-black font-mono">{globalKpis.breakdown[item.key] || 0}</span>
                </div>
                <span className="text-[9px] text-slate-500 font-semibold font-mono">{item.subtitle}</span>
              </div>
            ))}
          </div>
        </div>


        {/* CONTROLS & ADD FORM */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-base font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Compass className="h-5 w-5 text-teal-400" />
              Aday İthalatçılar & B2B Fırsatları
            </h3>
            {!auditMode && (
              <button
                onClick={() => setShowAddLeadModal(true)}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 font-mono"
              >
                <span>+ Yeni Aday Ekle</span>
              </button>
            )}
          </div>
        </div>

        {deleteFeedback && (
          <div className={`border text-xs p-3.5 rounded-xl font-medium font-mono flex justify-between items-center ${
            deleteFeedback.startsWith("Hata") 
              ? "bg-red-500/10 border-red-500/20 text-red-300" 
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
          }`}>
            <span>{deleteFeedback}</span>
            <button onClick={() => setDeleteFeedback(null)} className="text-slate-400 hover:text-white font-bold ml-2">✕</button>
          </div>
        )}

        {/* LIST SEARCH & FILTERS BAR */}
        <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input 
              type="text"
              placeholder="Arama yapın..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-slate-800 bg-slate-950 rounded-lg text-xs font-semibold focus:outline-none focus:border-teal-500 text-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-800 bg-slate-950 rounded-lg text-xs font-semibold text-slate-400 focus:outline-none cursor-pointer w-full md:w-auto"
          >
            <option value="Hepsi">Tüm Durumlar</option>
            <option value="Devam Ediyor">Devam Ediyor</option>
            <option value="Olumlu Sonuçlandı">Olumlu Sonuçlandı</option>
            <option value="Olumsuz Sonuçlandı">Olumsuz Sonuçlandı</option>
          </select>
        </div>

        {/* LEADS LIST TABLE */}
        <div className="bg-slate-900/40 border border-slate-850 rounded-2xl overflow-hidden shadow-lg">
          {loadingLeads ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
              <span className="text-xs font-mono">Size özel veri tabanı yükleniyor...</span>
            </div>
          ) : filteredLeads.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-850 text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                    <th className="p-4">MÜŞTERİ FİRMA ADI</th>
                    <th className="p-4">PROJE</th>
                    <th className="p-4">DURUM</th>
                    <th className="p-4 text-center">Eylemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredLeads.map(lead => {
                    const isExpanded = expandedLeadId === lead.id;
                    return (
                      <React.Fragment key={lead.id}>
                        <tr 
                          onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                          className={`hover:bg-slate-900/50 cursor-pointer transition ${isExpanded ? "bg-slate-900" : ""}`}
                        >
                          <td className="p-4 font-semibold text-white">
                            <span className="text-slate-200">{lead.companyName}</span>
                          </td>
                          <td className="p-4 text-slate-400 font-medium">
                            <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded text-xs font-mono">
                              {getProjectName(lead.projectId)}
                            </span>
                          </td>
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const currentStatus = ["Devam Ediyor", "Olumlu Sonuçlandı", "Olumsuz Sonuçlandı"].includes(lead.status) 
                                ? lead.status 
                                : "Olumsuz Sonuçlandı";
                              return (
                                <select
                                  disabled={auditMode || lead.id.startsWith("fallback_")}
                                  value={currentStatus}
                                  onChange={(e) => handleUpdateStatus(lead.id, e.target.value as any)}
                                  className={`text-[10px] font-black px-2.5 py-1.5 rounded-full font-mono uppercase tracking-wider border cursor-pointer focus:outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                                    currentStatus === "Olumlu Sonuçlandı" ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/30" :
                                    currentStatus === "Devam Ediyor" ? "bg-blue-950/20 text-blue-400 border-blue-500/30" :
                                    "bg-red-950/20 text-red-400 border-red-500/30"
                                  }`}
                                >
                                  <option value="Devam Ediyor" className="bg-slate-900 text-slate-200">Devam Ediyor</option>
                                  <option value="Olumlu Sonuçlandı" className="bg-slate-900 text-slate-200">Olumlu Sonuçlandı</option>
                                  <option value="Olumsuz Sonuçlandı" className="bg-slate-900 text-slate-200">Olumsuz Sonuçlandı</option>
                                </select>
                              );
                            })()}
                          </td>
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-3.5">
                              <button
                                onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                                className="text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span>Detaylar</span>
                              </button>
                              
                              {!auditMode && (
                                <button
                                  disabled={lead.id.startsWith("fallback_")}
                                  onClick={() => setLeadToDelete(lead)}
                                  className="text-xs font-bold text-red-500 hover:text-red-400 disabled:opacity-30 disabled:hover:text-red-500 transition flex items-center gap-1 cursor-pointer font-mono"
                                  title="Adayı Sil"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Sil</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* EXPANDABLE ROW - SOP TABLE */}
                        {isExpanded && (
                          <tr className="bg-slate-955/60 font-sans text-xs">
                            <td colSpan={4} className="p-6 border-b border-slate-850">
                              <div className="space-y-4">
                                
                                 {/* Müşteri KPI Özeti */}
                                {(() => {
                                  const criticalSteps = ["B.3", "B.7", "B.8", "B.9", "B.14"];
                                  const completedCriticalCount = (lead.sop_steps || [])
                                    .filter((s: any) => criticalSteps.includes(s.step) && s.status === "Completed")
                                    .length;
                                  const progressPercent = Math.round((completedCriticalCount / criticalSteps.length) * 100);

                                  return (
                                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-3">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                        <span className="text-xs font-black text-slate-200 uppercase tracking-wider font-mono">
                                          📊 Müşteri KPI Özeti (Kritik Aşamalar)
                                        </span>
                                        <span className="text-xs font-bold text-teal-400 font-mono">
                                          Kritik Başarı Adımları: {completedCriticalCount} / {criticalSteps.length} (%{progressPercent})
                                        </span>
                                      </div>
                                      
                                      {/* Progress Bar */}
                                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                                        <div 
                                          className="bg-teal-500 h-full transition-all duration-500" 
                                          style={{ width: `${progressPercent}%` }}
                                        />
                                      </div>

                                      {/* Row of Badges */}
                                      <div className="flex flex-wrap gap-2 pt-1">
                                        {criticalSteps.map(stepKey => {
                                          const stepObj = (lead.sop_steps || []).find((s: any) => s.step === stepKey);
                                          const isDone = stepObj?.status === "Completed";
                                          return (
                                            <span 
                                              key={stepKey}
                                              className={`text-[9px] font-black font-mono px-2 py-0.5 rounded-full border transition-all ${
                                                isDone 
                                                  ? "bg-teal-500/10 text-teal-400 border-teal-500/35" 
                                                  : "bg-slate-950 text-slate-500 border-slate-850"
                                              }`}
                                            >
                                              {stepKey}: {stepObj?.task || "Kritik Görev"} {isDone ? "✓" : "○"}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}

                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 border border-slate-850 p-4 rounded-xl">
                                  <span className="bg-teal-500/10 text-teal-400 text-[10px] font-extrabold px-3 py-1.5 rounded-lg border border-teal-500/20 uppercase tracking-wider font-mono">
                                    {getProjectName(lead.projectId)} - Satış ve Keşif Aşamaları ({freelanceSOPData.length} Adım)
                                  </span>
                                  <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                    <input
                                      type="text"
                                      placeholder="Satış aşamalarını arayın..."
                                      value={sopSearchTerm}
                                      onChange={(e) => setSopSearchTerm(e.target.value)}
                                      className="pl-9 pr-4 py-2 w-full border border-slate-800 bg-slate-955 rounded-lg text-xs font-semibold focus:outline-none focus:border-teal-500 text-white"
                                    />
                                  </div>
                                </div>

                                <div className="bg-slate-900/40 border border-slate-850 rounded-xl overflow-hidden shadow-lg">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                                      <thead>
                                        <tr className="bg-slate-900/80 border-b border-slate-850 text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                                          <th className="p-4 w-24">Aşama</th>
                                          <th className="p-4 w-[28%]">Görev Faaliyeti</th>
                                          <th className="p-4">Sorumlu</th>
                                          <th className="p-4">KPI / Standart Metrik</th>
                                          <th className="p-4">Durum</th>
                                          <th className="p-4">Kanıt Depolama</th>
                                          <th className="p-4 text-center">Etkileşimli Alan</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-850 text-xs">
                                        {freelanceSOPData
                                          .filter(templateStep => 
                                            templateStep.task.toLowerCase().includes(sopSearchTerm.toLowerCase()) || 
                                            templateStep.step.toLowerCase().includes(sopSearchTerm.toLowerCase())
                                          )
                                          .map(templateStep => {
                                            const stepId = `freelance_step_${activeUser.id}_${lead.id}_${templateStep.step}`;
                                            const dbStep = (lead.sop_steps || []).find(s => s.step === templateStep.step);
                                            const isStepExpanded = expandedStepId === `${lead.id}_${templateStep.step}`;
                                            const displayStep = templateStep.step;
                                            const status = dbStep?.status ?? "Pending";

                                            const getStepColorClasses = (stepKey: string) => {
                                              switch (stepKey) {
                                                case "B.3":
                                                  return {
                                                    badge: "border-emerald-500/30 text-emerald-400 bg-emerald-950/10",
                                                    title: "text-emerald-400"
                                                  };
                                                case "B.7":
                                                  return {
                                                    badge: "border-purple-500/30 text-purple-400 bg-purple-950/10",
                                                    title: "text-purple-400"
                                                  };
                                                case "B.8":
                                                  return {
                                                    badge: "border-yellow-500/30 text-yellow-400 bg-yellow-950/10",
                                                    title: "text-yellow-400"
                                                  };
                                                case "B.9":
                                                  return {
                                                    badge: "border-rose-500/30 text-rose-400 bg-rose-950/10",
                                                    title: "text-rose-400"
                                                  };
                                                case "B.14":
                                                  return {
                                                    badge: "border-emerald-500/30 text-emerald-400 bg-emerald-950/10",
                                                    title: "text-emerald-400"
                                                  };
                                                default:
                                                  return {
                                                    badge: "border-slate-850 text-slate-350 bg-slate-950",
                                                    title: "text-slate-200"
                                                  };
                                              }
                                            };
                                            const colors = getStepColorClasses(displayStep);

                                            return (
                                              <React.Fragment key={stepId}>
                                                <tr
                                                  onClick={() => setExpandedStepId(isStepExpanded ? null : `${lead.id}_${templateStep.step}`)}
                                                    className={`hover:bg-slate-900/50 group cursor-pointer transition ${
                                                      isStepExpanded ? "bg-slate-900 border-l-4 border-teal-500" : ""
                                                    }`}
                                                  >
                                                    <td className="p-4 font-mono font-bold">
                                                      <span className={`text-[11px] tracking-tight border px-2.5 py-1 rounded ${colors.badge}`}>
                                                        Aşama {displayStep}
                                                      </span>
                                                    </td>
                                                    <td className="p-4">
                                                      <div>
                                                        <div className={`font-semibold flex items-center gap-2 ${colors.title}`}>
                                                          <span>{templateStep.task}</span>
                                                          {["B.3", "B.7", "B.8", "B.9"].includes(templateStep.step) && (
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border font-mono ${
                                                              templateStep.step === "B.3" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                                                              templateStep.step === "B.7" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                                                              templateStep.step === "B.8" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                                                              "bg-rose-500/20 text-rose-400 border-rose-500/30"
                                                            }`}>
                                                              KPI
                                                            </span>
                                                          )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Bölüm B: Satış ve Müşteri Keşfi</div>
                                                      </div>
                                                    </td>
                                                    <td className="p-4 text-slate-300 font-semibold">
                                                      Freelance Satıcı
                                                    </td>
                                                    <td className="p-4 text-slate-400 max-w-[240px] leading-relaxed">
                                                      {templateStep.kpi}
                                                    </td>
                                                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                      <select
                                                        disabled={auditMode}
                                                        value={status}
                                                        onChange={(e) => handleUpdateSopStatus(stepId, e.target.value, lead.id)}
                                                        className={`text-[10px] font-black px-2.5 py-1.5 rounded-full font-mono uppercase tracking-wider border cursor-pointer focus:outline-none transition-all ${
                                                          status === "Completed" ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/30" :
                                                          status === "In Progress" ? "bg-amber-950/20 text-amber-400 border-amber-500/30" :
                                                          status === "Rejected" ? "bg-red-950/20 text-red-400 border-red-500/30" :
                                                          "bg-slate-950 text-slate-500 border-slate-850"
                                                        }`}
                                                      >
                                                        <option value="Pending" className="bg-slate-955 text-slate-350">Başlanmadı</option>
                                                        <option value="In Progress" className="bg-slate-955 text-slate-350">Devam Ediyor</option>
                                                        <option value="Completed" className="bg-slate-955 text-slate-355">Tamamlandı</option>
                                                        <option value="Rejected" className="bg-slate-955 text-slate-355">Tamamlanmadı</option>
                                                      </select>
                                                    </td>
                                                    <td className="p-4">
                                                      <span className="text-[10px] bg-slate-950 text-teal-400 border border-slate-850 px-2 py-1 rounded font-mono font-bold hover:underline">
                                                        📂 {templateStep.storage}
                                                      </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setExpandedStepId(isStepExpanded ? null : stepId);
                                                        }}
                                                        className="text-xs font-bold text-slate-400 hover:text-white transition flex items-center justify-center gap-1 mx-auto"
                                                      >
                                                        {isStepExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        <span>Çözücüyü Aç</span>
                                                      </button>
                                                    </td>
                                                  </tr>
                                                  {isStepExpanded && (
                                                    <tr className="bg-slate-950/80 font-sans">
                                                      <td colSpan={7} className="p-6 border-b border-slate-850 space-y-4">
                                                        
                                                        {/* Mikro Yönlendirme Kılavuzu */}
                                                        {(() => {
                                                          const guideMapping: { [key: string]: { aim: string; todo: string; file: string } } = {
                                                            "B.1": {
                                                              aim: "Komisyon haklarını koruma altına almak.",
                                                              todo: "İki tarafın haklarını koruyan NCNDA (Non-Circumvention Non-Disclosure Agreement) sözleşmesini alıcı ve fabrikaya imzalatın.",
                                                              file: "Taraflarca imzalanmış NCNDA Sözleşmesi (PDF)"
                                                            },
                                                            "B.2": {
                                                              aim: "Tedarikçinin yetkinliklerini alıcıya sunacak şekilde hazırlamak.",
                                                              todo: "Üretici fabrikanın üretim kapasitesi, sertifikaları ve kataloglarını içeren tanıtım dosyasını derleyip aktarın.",
                                                              file: "Fabrika Tanıtım Sunumu ve Kataloglar (PDF/ZIP)"
                                                            },
                                                            "B.3": {
                                                              aim: "Hedef pazardaki potansiyel müşteriyi sisteme tanımlamak.",
                                                              todo: "Satın alma yapabilecek ithalatçı veya distribütör adayı firmayı sisteme yeni aday (Lead) olarak kaydedin.",
                                                              file: "Aday Firma Kartı ve Web Sitesi Detayları"
                                                            },
                                                            "B.4": {
                                                              aim: "Ticari sırları ve ürün detaylarını güvenceye almak.",
                                                              todo: "Ürün spesifikasyonları paylaşılmadan önce alıcı firma ile karşılıklı Gizlilik Sözleşmesi'ni (NDA) imzalayıp sisteme ekleyin.",
                                                              file: "Alıcı tarafından İmzalanmış Gizlilik Sözleşmesi (NDA) (PDF)"
                                                            },
                                                            "B.5": {
                                                              aim: "Alıcı ile ilk teması başlatmak ve ilgi uyandırmak.",
                                                              todo: "Alıcı firmanın satın alma müdürüne gönderdiğiniz ilk tanıtım yazısını, e-postayı veya LinkedIn görüşmesini belgeleyin.",
                                                              file: "Gönderilen Tanıtım E-postası Ekran Görüntüsü veya Görüşme Notları"
                                                            },
                                                            "B.7": {
                                                              aim: "Alıcıdan resmi fiyat talebi toplamak.",
                                                              todo: "Alıcı firmanın talep ettiği ürünler için gönderdiği resmi Teklif Talebi (RFQ) belgesini sisteme yükleyin.",
                                                              file: "Resmi RFQ Belgesi veya Fiyat Talebini İçeren E-posta Görseli"
                                                            },
                                                            "B.8": {
                                                              aim: "Alıcı ve tedarikçiyi ilk tanışma toplantısında buluşturmak.",
                                                              todo: "Alıcı ve fabrika yetkilileri arasında Zoom/Teams üzerinden tanışma ve ilk teknik detay toplantısını organize edin ve tutanak tutun.",
                                                              file: "Toplantı Ekran Görüntüsü ve Görüşme Karar Tutanakları (PDF)"
                                                            },
                                                            "B.9": {
                                                              aim: "Alıcının ürünü test etmesini sağlamak.",
                                                              todo: "Fabrika tarafından üretilen veya hazırlanan numuneleri alıcı adrese kargolayın ve gönderim kanıtını ekleyin.",
                                                              file: "Kargo Gönderi Takip Fişi veya Numune Teslim Teslim Tutanakları"
                                                            },
                                                            "B.10": {
                                                              aim: "Numune sonuçlarına göre gerekli iyileştirmeleri yapmak.",
                                                              todo: "Alıcının numuneyi inceledikten sonra sunduğu geri bildirim raporunu ve varsa revizyon isteklerini sisteme aktarın.",
                                                              file: "Müşteri Numune Değerlendirme Raporu veya Revizyon Talep Yazışması"
                                                            },
                                                            "B.11": {
                                                              aim: "Nihai ürün ambalaj ve etiket tasarımlarını onaylatmak.",
                                                              todo: "Ürünün etiket tasarımı, kutu ölçüleri, koli içi adetleri ve paletleme şeması gibi paketleme detaylarını netleştirin.",
                                                              file: "Müşteri Onaylı Ambalaj ve Etiket Tasarım Şablonları (PDF/Görsel)"
                                                            },
                                                            "B.12": {
                                                              aim: "Tüm lojistik ve ek maliyetler dahil nihai birim fiyatı belirlemek.",
                                                              todo: "Fabrikanın sunduğu nihai fiyat teklif tablosunu (maliyet kırılımlarıyla birlikte) oluşturup klasöre ekleyin.",
                                                              file: "Nihai Fiyat Teklif Tablosu / Cost Sheet (PDF/Excel)"
                                                            },
                                                            "B.13": {
                                                              aim: "Sipariş öncesi son lojistik ve idari detaylarda mutabakat sağlamak.",
                                                              todo: "Teslim süresi, gümrükleme, yükleme tarihi ve ödeme vadelerinin son kez konuşulduğu sipariş öncesi toplantıyı gerçekleştirin.",
                                                              file: "Sipariş Öncesi Uyum Toplantısı Karar Defteri/Tutanak Çıktısı"
                                                            },
                                                            "B.14": {
                                                              aim: "Satışı resmi olarak kapatıp siparişi başlatmak.",
                                                              todo: "Alıcıdan gelen resmi imzalı Satın Alma Siparişi (PO) ve üreticinin düzenlediği Proforma Faturayı (PI) sisteme yükleyerek süreci tamamlayın.",
                                                              file: "İmzalı Satın Alma Siparişi (PO) ve Proforma Fatura (PI) (PDF)"
                                                            }
                                                          };

                                                          const guide = guideMapping[displayStep];
                                                          if (!guide) return null;

                                                          return (
                                                            <div className="bg-slate-900/60 border border-teal-500/20 p-4.5 rounded-2xl space-y-2.5 text-xs">
                                                              <div className="flex items-center gap-2">
                                                                <span className="text-[10px] bg-teal-500/10 text-teal-400 font-extrabold px-2 py-0.5 rounded border border-teal-500/20 font-mono uppercase tracking-wider">
                                                                  💡 AŞAMA KILAVUZU
                                                                </span>
                                                                <span className="font-bold text-slate-200">
                                                                  {displayStep}: {templateStep.task} nasıl tamamlanır?
                                                                </span>
                                                              </div>
                                                              
                                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 font-sans text-slate-350 text-[11px] leading-relaxed">
                                                                <div className="space-y-1">
                                                                  <span className="block text-[9px] font-black uppercase text-slate-500 font-mono tracking-wider">Aşama Amacı</span>
                                                                  <p>{guide.aim}</p>
                                                                </div>
                                                                <div className="space-y-1">
                                                                  <span className="block text-[9px] font-black uppercase text-slate-500 font-mono tracking-wider">Yapılması Gerekenler</span>
                                                                  <p>{guide.todo}</p>
                                                                </div>
                                                                <div className="space-y-1">
                                                                  <span className="block text-[9px] font-black uppercase text-slate-500 font-mono tracking-wider">Kanıt Dosyası</span>
                                                                  <p className="text-teal-400 font-mono">{guide.file}</p>
                                                                </div>
                                                              </div>
                                                            </div>
                                                          );
                                                        })()}

                                                        <GoogleDriveFolder
                                                          stepId={stepId}
                                                          storageLocation={templateStep.storage}
                                                          clientMode={auditMode}
                                                          currentProjectId={lead.projectId}
                                                          onStatusChange={(id, newStatus) => handleUpdateSopStatus(id, newStatus, lead.id)}
                                                        />
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
          ) : (
            <div className="p-12 text-center text-slate-500">
              <AlertOctagon className="h-8 w-8 mx-auto mb-2 text-slate-700" />
              <p className="text-xs font-semibold">
                {activeProjId ? "Kayıtlı aday bulunamadı." : "Proje bulunamadı."}
              </p>
            </div>
          )}
        </div>
        </>
      ) : (
        <MarketInsightsView currentProjectId={activeProjId} />
      )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-600 font-mono">
        <div>Trade2Turkey Co-op Ltd. • Serbest Satıcı Çalışma Alanı</div>
        <div className="text-[10px] text-slate-755 mt-1">Katı veri izolasyon kuralı `freelancerEmail == {activeUser?.email ?? ""}` devrededir.</div>
      </footer>

      {/* ADD LEAD MODAL */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-white space-y-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white font-display">
                  Yeni Aday İthalatçı Ekle
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 font-mono uppercase">
                  {getProjectName(activeProjId)}
                </p>
              </div>
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer text-sm font-bold bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-800"
              >
                ✕
              </button>
            </div>

            {addLeadError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3 rounded-xl font-medium font-mono">
                {addLeadError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateLead} className="space-y-4">
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Firma Adı / İthalatçı Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Tesco UK"
                  value={newLeadCompanyName}
                  onChange={(e) => setNewLeadCompanyName(e.target.value)}
                  className="w-full px-3.5 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition"
                  autoFocus
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-xs font-bold text-slate-400 rounded-xl transition cursor-pointer"
                >
                  Vazgeç
                </button>
                
                <button
                  type="submit"
                  disabled={addingLead || !newLeadCompanyName.trim()}
                  className="px-6 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 font-mono"
                >
                  {addingLead ? "Kaydediliyor..." : "Kaydet ve Başlat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {leadToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-955/85 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-white space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white font-display">
                  Adayı Silmeyi Onayla
                </h3>
                <p className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">
                  {leadToDelete.companyName}
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="text-xs text-slate-300 leading-relaxed font-sans">
              Bu aday ithalatçıyı ve ona ait 15 adımlık tüm iş akışı (SOP) verilerini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </div>

            {/* Modal Footer */}
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                disabled={deletingLead}
                onClick={() => setLeadToDelete(null)}
                className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-xs font-bold text-slate-400 rounded-xl transition cursor-pointer"
              >
                İptal
              </button>
              
              <button
                type="button"
                disabled={deletingLead}
                onClick={handleConfirmDelete}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 font-mono"
              >
                {deletingLead ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
