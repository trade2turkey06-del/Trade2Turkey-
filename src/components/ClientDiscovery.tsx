import { message as msg } from "../i18n";
import { useI18n } from "../i18n";
import { userStatusKey, leadStatusKey, companyTypeKey, urgencyKey } from "../domain/statusKeys";
import { inviteUser } from "../lib/userInvites";
import { apiFetch } from "../lib/api";
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
  status: "active" | "inactivity_warning" | "suspended" | string;
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
  status: "in_progress" | "closed_lost" | "closed_won" | "initial_contact" | "quotation" | "qualified" | "negotiating" | "rejected";
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
  companyType?: "distributor" | "importer" | "wholesaler" | "retail_chain" | "ecommerce_seller";

  // Karar Verici Yetkinlik Verileri
  decisionMakerEmail?: string;
  decisionMakerPhone?: string;

  // Ürün Spesifikasyonları ve Sektörel Detaylar
  productCategory?: string;
  technicalSpecs?: string;
  urgency?: "immediate" | "within_1_3_months" | "within_1_year" | "over_1_year";

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

export default function ClientDiscovery({ currentProjectId, currentUser, projects }: ClientDiscoveryProps) {
  const { t, fmt, lang } = useI18n();
  // Read actual users and leads; never insert implicit sample data.
  const [scouters, setScouters] = useState<Scouter[]>([]);

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
      setLeads(snapshot.docs.map(item => ({ ...item.data(), id: item.id, status: leadStatusKey(item.data().status) || item.data().status, companyType: companyTypeKey(item.data().companyType) || item.data().companyType, urgency: urgencyKey(item.data().urgency) || item.data().urgency } as ClientLead)));
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
          name: u.name || u.companyName || u.email || docSnap.id,
          region: u.region || "",
          activeLeadsCount: u.activeLeadsCount ?? 0,
          lastActivityDays: u.lastActivityDays ?? 0,
          status: userStatusKey(u.status) || u.status || "active",
          email: u.email || docSnap.id,
          companyName: u.companyName || "",
          contactPerson: u.contactPerson || "",
          title: u.title || "",
          secondaryEmail: u.secondaryEmail || "",
          workPhone: u.workPhone || "",
          cellPhone: u.cellPhone || "",
          website: u.website || "",
          onboardingCompleted: userStatusKey(u.status) === "active",
          projectId: u.projectId || "",
          assignedProjects: u.assignedProjects || [],
          uid: u.uid || "",
          rawStatus: u.status
        });
      });
      setScouters(fetched);
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
      setInviteFeedback(msg("discovery", "completeAllRequiredFields"));
      return;
    }
    const emailKey = inviteEmail.trim().toLowerCase();
    try {
      const inviteResult = await inviteUser({ email: emailKey, companyName: inviteName, projectId: inviteProjectId || currentProjectId, role: "freelancer" });
      setInviteName("");
      setInviteEmail("");
      setInviteProjectId("");
      setInviteFeedback(inviteResult);
      setTimeout(() => {
        setInviteFeedback(null);
        setShowInviteModal(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to invite scouter:", err);
      setInviteFeedback(err instanceof Error ? err.message : msg("discovery", "couldNotSendTheInvitation"));
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
  const [newCompanyType, setNewCompanyType] = useState<"distributor" | "importer" | "wholesaler" | "retail_chain" | "ecommerce_seller">("distributor");
  const [newDMEmail, setNewDMEmail] = useState("");
  const [newDMPhone, setNewDMPhone] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newTechnicalSpecs, setNewTechnicalSpecs] = useState("");
  const [newUrgency, setNewUrgency] = useState<"immediate" | "within_1_3_months" | "within_1_year" | "over_1_year">("within_1_3_months");
  const [newEstimatedVolume, setNewEstimatedVolume] = useState("");
  const [newTargetPrice, setNewTargetPrice] = useState("");
  const [newPaymentTerms, setNewPaymentTerms] = useState("");
  const [newHsCode, setNewHsCode] = useState("");
  const [newDeliveryTerm, setNewDeliveryTerm] = useState("FOB");

  // Search, Filter and Accordion states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);

  // Admin logs state
  const [actionLogs, setActionLogs] = useState<{at: Date; key: keyof typeof t.discovery; values: unknown[]}[]>([]);

  const addLog = (key: keyof typeof t.discovery, ...values: unknown[]) => {
    setActionLogs(prev => [{at: new Date(), key, values}, ...prev.slice(0,4)]);
  };

  // Filtered Leads (excluding C-grade leads from general pipeline in terms of KPI or matching projectId)
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (l.projectId !== currentProjectId) return false;

      const matchesSearch =
        l.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.decisionMakerName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || l.status === statusFilter;

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
        status: "inactivity_warning",
        lastActivityDays: 13
      }, { merge: true });
      addLog("inactivityWarningRecordedForScouterValue", scouterName);
    } catch (err) {
      console.error("Failed to warn scouter in Firestore:", err);
    }
  };

  const handleSuspendScouter = async (scouterId: string, scouterName: string) => {
    try {
      const userRef = doc(db, "users", scouterId);
      await setDoc(userRef, {
        status: "suspended",
        lastActivityDays: 14
      }, { merge: true });
      addLog("scouterValueSuspendedUnderThe14DayInactivityPolicy", scouterName);
    } catch (err) {
      console.error("Failed to suspend scouter in Firestore:", err);
    }
  };

  const handleActivateScouter = async (scouterId: string, scouterName: string) => {
    try {
      const userRef = doc(db, "users", scouterId);
      await setDoc(userRef, {
        status: "active",
        lastActivityDays: 0
      }, { merge: true });
      addLog("scouterValueReactivated", scouterName);
    } catch (err) {
      console.error("Failed to activate scouter in Firestore:", err);
    }
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany || !newCountry || !newDMName || !newDMTitle || !newDMEmail || !newProductCategory) {
      setFormFeedback(msg("discovery", "completeTheRequiredFieldsCompanyNameCountryDecisionMaker"));
      return;
    }

    setFormFeedback(msg("discovery", "assessingLeadQualification"));

    const contactStr = `${newDMEmail} | ${newDMPhone || ""}`;
    const leadId = `lead_${Date.now()}`;

    const rawLead: ClientLead = {
      id: leadId,
      companyName: newCompany,
      country: newCountry,
      decisionMakerName: newDMName,
      decisionMakerTitle: newDMTitle || "",
      contactInfo: contactStr,
      status: "in_progress",
      assignedScouterId: newScouterId,
      assignedTo: "owner_admin",
      userId: "owner_admin",
      lastUpdateDays: 0,
      demandNotes: newNotes || "",
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
      const response = await apiFetch("/api/ai/evaluate-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead: rawLead, language: lang })
      });

      let evaluatedResult: any = {};
      if (response.ok) {
        evaluatedResult = await response.json();
      }

      const finalLead: ClientLead = {
        ...rawLead,
        score: evaluatedResult.ai_lead_skoru || 70,
        grade: (evaluatedResult.ai_lead_skoru >= 85 ? "A-Grade" : evaluatedResult.ai_lead_skoru >= 50 ? "B-Grade" : "C-Grade") as any,
        aiFeedback: evaluatedResult.scouter_geri_bildirim_notu || "",
        aiReasoning: evaluatedResult.analiz_gerekcesi || "",
        pillars: evaluatedResult.pillars || {
          sectorFit: "not_evaluated",
          emailCheck: "not_evaluated",
          decisionMakerAuthority: "not_evaluated",
          financialFit: "not_evaluated",
          volumeCheck: "not_evaluated",
          specClarity: "not_evaluated",
          targetPriceCheck: "not_evaluated"
        },
        status: (evaluatedResult.dashboard_status === "QUOTE READY" ? "in_progress" :
                 evaluatedResult.dashboard_status === "REJECTED" ? "closed_lost" : "in_progress") as any
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
        status: "active"
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
    setNewCompanyType("distributor");
    setNewProductCategory("");
    setNewTechnicalSpecs("");
    setNewUrgency("immediate");
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
    return scouters.filter(s => s.status === "inactivity_warning" || s.lastActivityDays >= 10 && s.status !== "suspended");
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
              {msg("discovery", "b2bBuyerDiscovery")}
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight font-display">
              {msg("discovery", "clientDiscoveryScouterDashboard")}
            </h2>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              {msg("discovery", "independentSalesProfessionalsInTargetMarkets")} <strong>{msg("discovery", "scouters")}</strong>{msg("discovery", "provideBuyerLeadsQualifiedOpportunitiesAreIdentifiedByAssessing")}
            </p>
          </div>

          <div className="flex flex-col gap-2 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm self-start md:self-auto min-w-[220px]">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest font-mono">
              {msg("discovery", "activeProject")}
            </div>
            <div className="text-sm font-black text-white font-mono mt-1">
              {getProjectName(currentProjectId)}
            </div>
            <div className="text-[10px] text-slate-400 mt-2 font-mono border-t border-slate-700/50 pt-2">
              {msg("discovery", "projectId")} <span className="text-teal-400 font-bold">{currentProjectId}</span>
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
                {msg("discovery", "sopAligned")}
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900">{msg("discovery", "30DayKpiTargets")}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {msg("discovery", "eachScouterMustRegisterAtLeast3QualifiedBuyer")}
            </p>
          </div>
          <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">{msg("discovery", "minimumQualifiedLeadTarget")}</span>
            <span className="text-slate-800 font-bold font-mono">{msg("discovery", "atLeast3Leads30Days")}</span>
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
                {msg("discovery", "participationPolicy")}
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900">{msg("discovery", "14DayInactivityPolicy")}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {msg("discovery", "representativesWithNoDataEntryLeadRegistrationOrCorrespondence")}
            </p>
          </div>
          <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">{msg("discovery", "suspensionThreshold")}</span>
            <span className="text-amber-600 font-bold font-mono">{msg("discovery", "14DaysOfInactivity")}</span>
          </div>
        </div>

        {/* Real-time Inactivity Warning Box */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase text-slate-700 tracking-wider font-mono flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                {msg("discovery", "inactivityWarning")}
              </h3>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-mono">
                {msg("discovery", "critical")}
              </span>
            </div>

            {criticalScouters.length > 0 ? (
              <div className="space-y-3 mt-2">
                {criticalScouters.map(s => (
                  <div key={s.id} className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{s.name}</span>
                      <span className="text-rose-600 font-mono">{fmt.number(s.lastActivityDays)} {msg("discovery", "daysInactive")}</span>
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
                        {msg("discovery", "reset")}
                      </button>
                      <button
                        onClick={() => handleSuspendScouter(s.id, s.name)}
                        className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-[10px] font-extrabold text-rose-700 uppercase tracking-wider cursor-pointer"
                      >
                        {msg("discovery", "suspend")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-4 text-center">
                {msg("discovery", "noInactiveScoutersAreCurrentlyApproachingTheCriticalThreshold")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. SCOUTERS LIST SECTION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Users className="h-5 w-5 text-navy" />
          <h3 className="text-lg font-black text-slate-900">{msg("discovery", "freelanceSalesRepresentativesScouters")}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {scouters.map(s => {
            const isCritical = s.status === "inactivity_warning";
            const isSuspended = s.status === "suspended";

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
                    {t.discovery[s.status] || s.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 py-3 font-semibold">
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-mono">{msg("discovery", "activeQualifiedLeads")}</div>
                    <div className="text-slate-850 font-bold text-sm mt-0.5">{fmt.number(activeLeadsCount)} {activeLeadsCount === 1 ? t.discovery.companySingle : msg("discovery", "companies")}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-mono">{msg("discovery", "lastActivity")}</div>
                    <div className="text-slate-850 font-bold text-sm mt-0.5">{lastActivityDays === 0 ? msg("discovery", "today") : (lastActivityDays === 1 ? t.discovery.oneDayAgo : msg("discovery", "valueDaysAgo", lastActivityDays))}</div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedScouterForDetail(s)}
                  className="w-full py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5 text-navy" />
                  {msg("discovery", "viewProfile")}
                </button>

                <div className="flex gap-2 justify-end pt-1">
                  {isSuspended ? (
                    <button
                      onClick={() => handleActivateScouter(s.id, s.name)}
                      className="w-full py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      {msg("discovery", "activate")}
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
                        {msg("discovery", "warn")}
                      </button>
                      <button
                        onClick={() => handleSuspendScouter(s.id, s.name)}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-extrabold uppercase tracking-wider flex-1 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <UserX className="h-3.5 w-3.5" />
                        {msg("discovery", "suspend")}
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
              {msg("discovery", "buyerDistributorLeads")}
            </h3>
            <p className="text-xs text-slate-500">
              {msg("discovery", "activeOpportunitiesProvidedByTheScouterNetwork")} <strong>{msg("discovery", "selectARowToReviewTheFourAssessmentPillars")}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={msg("discovery", "searchCompanyCountryOrDecisionMaker")}
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
              <option value="all">{msg("discovery", "allStages")}</option>
              {["in_progress","initial_contact","qualified","quotation","negotiating","closed_won","closed_lost","rejected"].map(key => <option key={key} value={key}>{t.discovery[key]}</option>)}
            </select>

            {currentUser?.role === "admin" && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-4 py-2 bg-navy text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  {msg("discovery", "addLead")}
                </button>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  {msg("discovery", "inviteScouter")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 5. ADD NEW LEAD FORM (COLLAPSIBLE WITH AI LOADER OVERLAY) */}
        {showAddForm && (
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 animate-slide-down relative">

            <h4 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wider font-mono">{msg("discovery", "registerBuyerOpportunity")}</h4>
            <form onSubmit={handleAddLead} className="space-y-6">

              {/* 1. Firma Temel Kimlik ve Güvenilirlik Verileri */}
              <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-navy"></span>
                  {msg("discovery", "1CompanyIdentityCredibility")}
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-650 mb-1">{msg("discovery", "fullLegalCompanyName")}</label>
                    <input
                      type="text"
                      value={newCompany}
                      onChange={(e) => setNewCompany(e.target.value)}
                      placeholder={msg("discovery", "registeredCompanyNameEGNordicLoungeFurnitureGmbh")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "country")}</label>
                    <input
                      type="text"
                      value={newCountry}
                      onChange={(e) => setNewCountry(e.target.value)}
                      placeholder={msg("discovery", "eGGermany")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "companyType")}</label>
                    <select
                      value={newCompanyType}
                      onChange={(e) => setNewCompanyType(e.target.value as any)}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium cursor-pointer"
                    >
                      <option value="distributor">{msg("discovery", "distributor")}</option>
                      <option value="importer">{msg("discovery", "importer")}</option>
                      <option value="wholesaler">{msg("discovery", "wholesaler")}</option>
                      <option value="retail_chain">{msg("discovery", "retailChain")}</option>
                      <option value="ecommerce_seller">{msg("discovery", "eCommerceSeller")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "website")}</label>
                    <input
                      type="url"
                      value={newWebsite}
                      onChange={(e) => setNewWebsite(e.target.value)}
                      placeholder={msg("discovery", "eGHttpsCompanyCom")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "linkedinProfile")}</label>
                    <input
                      type="url"
                      value={newLinkedinProfile}
                      onChange={(e) => setNewLinkedinProfile(e.target.value)}
                      placeholder={msg("discovery", "eGHttpsLinkedinComCompanyExample")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Karar Verici (Decision Maker) Yetkinlik Verileri */}
              <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-teal-600"></span>
                  {msg("discovery", "2DecisionMakerAuthority")}
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "decisionMakerFullName")}</label>
                    <input
                      type="text"
                      value={newDMName}
                      onChange={(e) => setNewDMName(e.target.value)}
                      placeholder={msg("discovery", "fullNameOfTheDecisionMaker")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "jobTitle")}</label>
                    <input
                      type="text"
                      value={newDMTitle}
                      onChange={(e) => setNewDMTitle(e.target.value)}
                      placeholder={msg("discovery", "eGPurchasingManager")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "businessEmailAddress")}</label>
                    <input
                      type="email"
                      value={newDMEmail}
                      onChange={(e) => setNewDMEmail(e.target.value)}
                      placeholder={msg("discovery", "eGBuyerCompanyCom")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "directPhoneWhatsapp")}</label>
                    <input
                      type="text"
                      value={newDMPhone}
                      onChange={(e) => setNewDMPhone(e.target.value)}
                      placeholder={msg("discovery", "eG49170123456")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Ürün Spesifikasyonları ve Sektörel Detaylar */}
              <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  {msg("discovery", "3ProductSpecificationsSectorDetails")}
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "productCategory")}</label>
                    <input
                      type="text"
                      value={newProductCategory}
                      onChange={(e) => setNewProductCategory(e.target.value)}
                      placeholder={msg("discovery", "eGBeanbagChairsFruitJuice")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "purchaseTimeframe")}</label>
                    <select
                      value={newUrgency}
                      onChange={(e) => setNewUrgency(e.target.value as any)}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium cursor-pointer"
                    >
                      <option value="immediate">{msg("discovery", "immediately")}</option>
                      <option value="within_1_3_months">{msg("discovery", "within13Months")}</option>
                      <option value="within_1_year">{msg("discovery", "within1Year")}</option>
                      <option value="over_1_year">{msg("discovery", "moreThan1Year")}</option>
                    </select>
                  </div>
                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "technicalRequirementsCertifications")}</label>
                    <textarea
                      value={newTechnicalSpecs}
                      onChange={(e) => setNewTechnicalSpecs(e.target.value)}
                      placeholder={msg("discovery", "eGReachComplianceEpsFillingCertificationFireResistance")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium h-20 font-sans"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Operasyonel ve Finansal Beklentiler */}
              <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  {msg("discovery", "4OperationalFinancialRequirements")}
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "estimatedPurchasingVolume")}</label>
                    <input
                      type="text"
                      value={newEstimatedVolume}
                      onChange={(e) => setNewEstimatedVolume(e.target.value)}
                      placeholder={msg("discovery", "eG240hqContainersPerMonth")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "targetPrice")}</label>
                    <input
                      type="text"
                      value={newTargetPrice}
                      onChange={(e) => setNewTargetPrice(e.target.value)}
                      placeholder={msg("discovery", "eGUsd2250FobIzmir")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "expectedPaymentTerms")}</label>
                    <input
                      type="text"
                      value={newPaymentTerms}
                      onChange={(e) => setNewPaymentTerms(e.target.value)}
                      placeholder={msg("discovery", "eG30Advance70AgainstBLBy")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "hsCode")}</label>
                    <input
                      type="text"
                      value={newHsCode}
                      onChange={(e) => setNewHsCode(e.target.value)}
                      placeholder={msg("discovery", "eG94049090")}
                      className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "incoterm")}</label>
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
                      <option value={msg("discovery", "other")}>{msg("discovery", "other")}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sorumlu Scouter ve Notlar */}
              <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/60 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "assignedScouter")}</label>
                  <select
                    value={newScouterId}
                    onChange={(e) => setNewScouterId(e.target.value)}
                    className="w-full p-2.5 text-xs border bg-white rounded-lg font-medium cursor-pointer"
                  >
                    {scouters.filter(s => s.status !== "suspended").map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-655 mb-1">{msg("discovery", "opportunityDetailsNotes")}</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder={msg("discovery", "additionalNotesEGPremiumFurnitureSegmentRequiredCertifications")}
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
                    {msg("discovery", "close")}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-all cursor-pointer animate-pulse"
                  >
                    {msg("discovery", "assessAndSaveLead")}
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
              <span className="text-xs font-mono font-bold uppercase tracking-wider">{msg("discovery", "synchronisingLeadRecords")}</span>
            </div>
          ) : filteredLeads.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider font-mono text-[9px]">
                  <th className="py-4 px-6 w-8"></th>
                  <th className="py-4 px-6">{msg("discovery", "companyName")}</th>
                  <th className="py-4 px-6">{msg("discovery", "country2")}</th>
                  <th className="py-4 px-6">{msg("discovery", "decisionMaker")}</th>
                  <th className="py-4 px-6">{msg("discovery", "assignedScouter")}</th>
                  <th className="py-4 px-6">{msg("discovery", "aiScore")}</th>
                  <th className="py-4 px-6">{msg("discovery", "processStage")}</th>
                  <th className="py-4 px-6 text-right">{msg("discovery", "lastUpdated")}</th>
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
                                {fmt.number(lead.score)} / 100 ({lead.grade})
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[10px]">{msg("discovery", "notAssessed")}</span>
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
                              lead.status === "quotation" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                              lead.status === "negotiating" ? "bg-blue-50 text-blue-700 border-blue-100" :
                              lead.status === "qualified" ? "bg-teal-50 text-teal-700 border-teal-100" :
                              lead.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-100 animate-pulse" :
                              "bg-slate-50 text-slate-700 border-slate-100"
                            }`}>
                              {t.discovery[lead.status] || lead.status}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-[10px] text-slate-400 font-semibold">
                          {lead.lastUpdateDays === 0 ? msg("discovery", "today") : (lead.lastUpdateDays === 1 ? t.discovery.oneDayAgo : msg("discovery", "valueDaysAgo", lead.lastUpdateDays))}
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
                                    {msg("discovery", "1CompanyIdentityCredibility2")}
                                  </div>
                                  <div className="space-y-2 text-xs">
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "legalCompanyName")}</span>
                                      <span className="font-bold text-slate-800">{lead.companyName}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "country3")}</span>
                                      <span className="font-bold text-slate-800">{lead.country}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "companyType2")}</span>
                                      <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold mt-0.5">
                                        {t.discovery[companyTypeKey(lead.companyType) || ""] || lead.companyType || t.discovery.distributor}
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
                                          {msg("discovery", "website2")}
                                        </a>
                                      ) : (
                                        <span className="text-slate-400 italic text-[10px]">{msg("discovery", "noWebsite")}</span>
                                      )}
                                      {lead.linkedinProfile ? (
                                        <a
                                          href={lead.linkedinProfile}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-blue-650 hover:text-blue-700 font-bold hover:underline flex items-center gap-1 text-[10px]"
                                        >
                                          {msg("discovery", "linkedinProfile2")}
                                        </a>
                                      ) : (
                                        <span className="text-slate-400 italic text-[10px]">{msg("discovery", "noLinkedinProfile")}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 2. Karar Verici Yetkinlik Verileri */}
                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-450 font-mono border-b border-slate-100 pb-1 flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-teal-600"></span>
                                    {msg("discovery", "2DecisionMakerAuthority2")}
                                  </div>
                                  <div className="space-y-2 text-xs">
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "decisionMakerName")}</span>
                                      <span className="font-bold text-slate-800">{lead.decisionMakerName}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "jobTitle2")}</span>
                                      <span className="font-bold text-slate-800">{lead.decisionMakerTitle}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "businessEmail")}</span>
                                      {lead.decisionMakerEmail ? (
                                        <a href={`mailto:${lead.decisionMakerEmail}`} className="text-teal-650 hover:underline font-bold block truncate">
                                          {lead.decisionMakerEmail}
                                        </a>
                                      ) : (
                                        <span className="font-semibold text-slate-700 block truncate">{lead.contactInfo.split(" | ")[0] || msg("discovery", "notSpecified2")}</span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "directPhoneWhatsapp2")}</span>
                                      <span className="font-bold text-slate-800 font-mono text-[11px]">
                                        {lead.decisionMakerPhone || lead.contactInfo.split(" | ")[1] || msg("discovery", "notSpecified2")}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* 3. Ürün Spesifikasyonları ve Sektör */}
                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-450 font-mono border-b border-slate-100 pb-1 flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                    {msg("discovery", "3ProductSectorDetails")}
                                  </div>
                                  <div className="space-y-2 text-xs">
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "productCategory2")}</span>
                                      <span className="font-bold text-slate-800">{lead.productCategory || msg("discovery", "notSpecified2")}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "purchaseTimeframe2")}</span>
                                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${
                                        lead.urgency === "immediate" ? "bg-rose-50 text-rose-700 border border-rose-100" :
                                        lead.urgency === "within_1_3_months" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                                        "bg-slate-100 text-slate-600"
                                      }`}>
                                        {t.discovery[urgencyKey(lead.urgency) || ""] || lead.urgency || t.discovery.within_1_3_months}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "technicalRequirementsCertifications2")}</span>
                                      <p className="text-[11px] text-slate-600 leading-normal max-h-[60px] overflow-y-auto font-sans mt-0.5">
                                        {lead.technicalSpecs || msg("discovery", "notSpecified")}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* 4. Operasyonel ve Finansal Beklentiler */}
                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-450 font-mono border-b border-slate-100 pb-1 flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                                    {msg("discovery", "4FinancialOperationalDetails")}
                                  </div>
                                  <div className="space-y-1.5 text-xs">
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <div>
                                        <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "purchasingVolume")}</span>
                                        <span className="font-bold text-slate-800 text-[11px] block truncate" title={lead.estimatedVolume}>
                                          {lead.estimatedVolume || msg("discovery", "notSpecified2")}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "targetPrice2")}</span>
                                        <span className="font-bold text-slate-850 text-[11px] block truncate" title={lead.targetPrice}>
                                          {lead.targetPrice || msg("discovery", "notSpecified2")}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-1.5">
                                      <div>
                                        <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "incoterm2")}</span>
                                        <span className="font-bold text-teal-700 text-[11px] block">{lead.deliveryTerm || "FOB"}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "hsCode2")}</span>
                                        <span className="font-bold text-slate-700 text-[11px] block font-mono">{lead.hsCode || msg("discovery", "notSpecified2")}</span>
                                      </div>
                                    </div>
                                    <div className="border-t border-slate-100 pt-1.5">
                                      <span className="text-slate-400 text-[10px] block font-semibold">{msg("discovery", "expectedPaymentTerms2")}</span>
                                      <span className="font-bold text-slate-800 block text-[11px] truncate" title={lead.paymentTerms}>
                                        {lead.paymentTerms || msg("discovery", "notSpecified2")}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                              </div>

                              <div className="space-y-2 w-full">
                                <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">{msg("discovery", "scouterNotesContactDetails")}</h5>
                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs text-xs text-slate-655 leading-relaxed font-sans min-h-[120px] flex flex-col justify-between">
                                  <p className="italic">"{lead.demandNotes}"</p>
                                  <div className="text-[10px] text-slate-400 font-mono mt-3 border-t border-slate-100 pt-2">
                                    {msg("discovery", "originalContactDetails")} {lead.contactInfo}
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
              <span>{msg("discovery", "noLeadsMatchTheSelectedProjectOrFilter")}</span>
            </div>
          )}
        </div>
      </div>

      {/* 6. ADMIN AUDIT & REALTIME ACTION LOGS */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-navy" />
            {msg("discovery", "fieldOperationsActivityLog")}
          </h4>
          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase">
            {msg("discovery", "liveMonitoring")}
          </span>
        </div>

        <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] text-slate-300 space-y-2 border border-slate-850">
          {actionLogs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-teal-400 font-bold">&gt;&gt;</span>
              <span>[{fmt.dateTime(log.at)}] {msg("discovery", log.key, ...log.values)}</span>
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
                  {msg("discovery", "fieldSalesRepresentativeProfile")}
                </div>
                <h3 className="text-lg font-black text-white font-display">
                  {selectedScouterForDetail.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedScouterForDetail(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer text-sm font-bold bg-slate-850 px-2.5 py-1 rounded-lg border border-slate-800"
              >
                {msg("discovery", "close2")}
              </button>
            </div>

            {/* Modal Content - Read-only Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">

              {/* Firma / Şahıs Adı */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">{msg("discovery", "companyOrIndividualName")}</span>
                <p className="font-bold text-white text-sm">{selectedScouterForDetail.companyName || msg("discovery", "notSpecified2")}</p>
              </div>

              {/* İletişim Kurulacak Yetkili */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">{msg("discovery", "contactPerson")}</span>
                <p className="font-bold text-white text-sm">{selectedScouterForDetail.contactPerson || msg("discovery", "notSpecified2")}</p>
              </div>

              {/* Unvan */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">{msg("discovery", "jobTitle3")}</span>
                <p className="font-bold text-white text-sm">{selectedScouterForDetail.title || msg("discovery", "notSpecified2")}</p>
              </div>

              {/* Bölge */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">{msg("discovery", "region")}</span>
                <p className="font-bold text-white text-sm">{selectedScouterForDetail.region || t.discovery.globalTestNetwork}</p>
              </div>

              {/* Ana E-posta */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1 col-span-1 md:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">{msg("discovery", "primaryEmail")}</span>
                <p className="font-bold text-teal-400 text-sm font-mono">{selectedScouterForDetail.email}</p>
              </div>

              {/* İkincil E-posta */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">{msg("discovery", "secondaryEmail")}</span>
                <p className="font-bold text-white text-sm font-mono">{selectedScouterForDetail.secondaryEmail || msg("discovery", "notSpecified2")}</p>
              </div>

              {/* İş Telefonu */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">{msg("discovery", "workPhone")}</span>
                <p className="font-bold text-white text-sm font-mono">{selectedScouterForDetail.workPhone || msg("discovery", "notSpecified2")}</p>
              </div>

              {/* Cep Telefonu */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">{msg("discovery", "mobilePhone")}</span>
                <p className="font-bold text-white text-sm font-mono">{selectedScouterForDetail.cellPhone || msg("discovery", "notSpecified2")}</p>
              </div>

              {/* Web Sitesi */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">{msg("discovery", "website")}</span>
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
                  <p className="font-bold text-white text-sm">{msg("discovery", "notSpecified2")}</p>
                )}
              </div>

              {/* Durum / Kayıt Durumu */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1 col-span-1 md:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">{msg("discovery", "registrationStatus")}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono uppercase tracking-wider border ${
                    selectedScouterForDetail.onboardingCompleted
                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-900"
                      : "bg-amber-950/40 text-amber-400 border-amber-900"
                  }`}>
                    {selectedScouterForDetail.onboardingCompleted ? msg("discovery", "profileCompleteActive") : msg("discovery", "initialRegistrationPending")}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono uppercase tracking-wider border ${
                    selectedScouterForDetail.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    selectedScouterForDetail.status === "suspended" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                    "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}>
                    {msg("discovery", "accountStatus")} {t.discovery[selectedScouterForDetail.status] || selectedScouterForDetail.status}
                  </span>
                </div>
              </div>

              {/* Proje Atama Menüsü */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2 col-span-1 md:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">{msg("discovery", "assignedProjects")}</span>
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
                              addLog("projectValueUnassignedFromScouterValue", selectedScouterForDetail.name, pId);
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
                    <span className="text-slate-500 text-xs italic">{msg("discovery", "noProjectsAssignedYet")}</span>
                  )}
                </div>

                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">{msg("discovery", "assignToProject")}</span>
                <div className="flex gap-2">
                  <select
                    value={selectedProjectToAssign}
                    onChange={(e) => setSelectedProjectToAssign(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-850 text-xs text-slate-200 py-2 px-3 rounded-xl focus:outline-none focus:border-teal-500 cursor-pointer font-bold font-mono"
                  >
                    <option value="">{msg("discovery", "selectProject")}</option>
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
                        addLog("projectValueAssignedToScouterValue", selectedScouterForDetail.name, selectedProjectToAssign);
                        setSelectedProjectToAssign("");
                      } catch (err) {
                        console.error("Failed to assign project:", err);
                      }
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-slate-955 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {msg("discovery", "assign")}
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
                {msg("discovery", "close")}
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
                  {msg("discovery", "invitationManagement")}
                </div>
                <h3 className="text-lg font-black text-white font-display">
                  {msg("discovery", "inviteScouter2")}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteFeedback(null);
                }}
                className="text-slate-400 hover:text-white transition cursor-pointer text-sm font-bold bg-slate-850 px-2.5 py-1 rounded-lg border border-slate-800"
              >
                {msg("discovery", "close2")}
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
                  {msg("discovery", "fullName")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={msg("discovery", "eGAlexMorgan")}
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition"
                />
              </div>

              {/* E-posta */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  {msg("discovery", "email")}
                </label>
                <input
                  type="email"
                  required
                  placeholder={msg("discovery", "eGRepresentativeCompanyCom")}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition font-mono"
                />
              </div>

              {/* Proje Seçimi */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  {msg("discovery", "assignToProject")}
                </label>
                <select
                  value={inviteProjectId}
                  onChange={(e) => setInviteProjectId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition font-mono font-bold cursor-pointer"
                >
                  <option value="">{msg("discovery", "noProjectAssignLater")}</option>
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
                  {msg("discovery", "cancel")}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-slate-955 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {msg("discovery", "sendInvitation")}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
