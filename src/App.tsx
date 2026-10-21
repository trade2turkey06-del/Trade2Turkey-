import ProjectNamesPanel from "./components/ProjectNamesPanel";
import { initialWorkspaceTab, retiredPageRedirect } from "./domain/navigation";
import { nameLocale, projectDisplayName, rememberProjectNames } from "./lib/projectName";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, deleteDoc, doc, documentId, onSnapshot, query, runTransaction, setDoc, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import AdminOverview from "./components/AdminOverview";
import BackupPanel from "./components/BackupPanel";
import BuyerDirectory from "./components/BuyerDirectory";
import FreelancerDashboard, { freelanceSOPData } from "./components/FreelancerDashboard";
import LoginScreen from "./components/LoginScreen";
import { MarketInsightsManagement } from "./components/MarketInsights";
import Navbar from "./components/Navbar";
import OperationsHub from "./components/OperationsHub";
import ProjectDocumentVault from "./components/ProjectDocumentVault";
import SectorDirectory from "./components/SectorDirectory";
import SourcingWorkflow from "./components/SourcingWorkflow";
import UserManagement from "./components/UserManagement";
import { UserTenant } from "./data/usersData";
import { trustedAdministrator } from "./domain/access";
import { getMessages, useI18n } from "./i18n";
import { setDriveAuth } from "./lib/driveAuth";
import { auth, db } from "./lib/firebase";

import {
  FulfillmentOrder,
  InventoryItem,
  ProductRecipe,
  RfqComparativeMatrix,
  RfqSubmission,
  ShipmentMilestone,
  Supplier,
  TargetSpecification,
  ValueChainCosting
} from "./types";


export default function App() {
  // Active corporate context state
  const [currentUser, setCurrentUser] = useState<UserTenant | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [appError, setAppError] = useState("");
  const { t, fmt, lang, bindUser } = useI18n();

  useEffect(() => {
    let stopProfile = () => {};
    const stopAuth = onAuthStateChanged(auth, user => {
      stopProfile();
      setDriveAuth(null, null, null);
      setCurrentUser(null);
      localStorage.removeItem("t2t_current_user");
      localStorage.removeItem("t2t_preset_creds");
      localStorage.removeItem("t2t_custom_users");
      if (!user) { bindUser(null); setAuthReady(true); return; }
      setAuthReady(false);
      stopProfile = onSnapshot(doc(db, "users", user.uid), async snapshot => {
        const profile = snapshot.data();
        if (profile && profile.status !== "suspended" && profile.status !== "Askıya Alındı") {
          if (["admin","owner"].includes(profile.role)) {
            try {
              const result=await user.getIdTokenResult();
              if (!trustedAdministrator(user.uid,result.claims)) {setCurrentUser(null);setAppError(getMessages().shell.errors.adminNotVerified);setAuthReady(true);return;}
            } catch {setAppError(getMessages().shell.errors.sessionNotVerified);setAuthReady(true);return;}
          }
          if (auth.currentUser?.uid !== user.uid) return;
          setAppError("");
          // Dil tercihi: profildeki değer, yoksa bu kullanıcının yerel seçimi; değişiklik profile de yazılır.
          bindUser(user.uid, profile.language, language => updateDoc(doc(db, "users", user.uid), { language }));
          setCurrentUser({ ...profile, role: profile.role === "owner" ? "admin" : profile.role, id: user.uid, uid: user.uid } as UserTenant);
        } else {
          setCurrentUser(null);
          setAppError(getMessages().shell.errors.noProjectAccess);
        }
        setAuthReady(true);
      }, () => { setAppError(getMessages().shell.errors.authFailed); setAuthReady(true); });
    });
    return () => { stopAuth(); stopProfile(); };
  }, []);

  const [activeProjectId, setActiveProjectId] = useState<string>("PROJE-UNLU MAMÜLLER");

  // Dynamic projects list loaded from Firestore
  const [projects, setProjects] = useState<any[]>([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjNameEn, setNewProjNameEn] = useState("");
  const [newProjId, setNewProjId] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");
  const [newProjFeedback, setNewProjFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.role === "client") setActiveProjectId(currentUser.projectId);
  }, [currentUser?.id, currentUser?.projectId]);

  // Real-time listener for projects collection in Firestore
  useEffect(() => {
    if (!currentUser) { setProjects([]); return; }
    const accessibleIds = [...new Set([currentUser.projectId, ...(currentUser.assignedProjects || [])].filter(Boolean))].slice(0,30);
    const projectsQuery = currentUser.role === "admin" ? collection(db, "projects") : query(collection(db, "projects"), where(documentId(), "in", accessibleIds.length ? accessibleIds : ["__none__"]));
    const unsub = onSnapshot(projectsQuery, snapshot => {
      const items: any[] = snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
      // Shared name registry for components that only know a project id (see lib/projectName).
      rememberProjectNames(items);
      setProjects(items);
      setActiveProjectId(previous => items.some(item => item.id === previous) ? previous : items[0]?.id || "");
    }, () => setAppError(getMessages().shell.errors.projectsLoad));

    return () => unsub();
  }, [currentUser?.id, currentUser?.role, currentUser?.projectId, JSON.stringify(currentUser?.assignedProjects)]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim() || !newProjId.trim()) {
      setNewProjFeedback(t.shell.newProjectModal.required);
      return;
    }

    // Transform Project ID to uppercase and space-less format
    const cleanedProjId = newProjId.trim().toUpperCase().replace(/\s+/g, "-");
    if (cleanedProjId.length > 100 || cleanedProjId.includes("/") || [".",".."].includes(cleanedProjId)) {setNewProjFeedback(t.shell.newProjectModal.invalidId);return;}

    // Check if project ID already exists
    if (projects.some(p => p.id === cleanedProjId)) {
      setNewProjFeedback(t.shell.newProjectModal.exists);
      return;
    }

    setNewProjFeedback(t.shell.newProjectModal.creating);

    try {
      const projRef = doc(db, "projects", cleanedProjId);
      const defaultSopSteps = freelanceSOPData.map(s => ({
        step: s.step,
        task: s.task,
        kpi: s.kpi,
        storage: s.storage,
        status: "Pending"
      }));
      const newProj = {
        id: cleanedProjId,
        name: newProjName.trim(),
        // Optional English name; empty means the Turkish name is shown in English too.
        ...(newProjNameEn.trim() ? { nameEn: newProjNameEn.trim() } : {}),
        description: newProjDesc.trim(),
        status: "active",
        createdAt: new Date().toISOString(),
        sopStepsTemplate: defaultSopSteps
      };
      await runTransaction(db,async tx=>{const existing=await tx.get(projRef);if(existing.exists())throw new Error(t.shell.newProjectModal.exists);tx.set(projRef,newProj);});
      
      setNewProjName("");
      setNewProjNameEn("");
      setNewProjId("");
      setNewProjDesc("");
      setNewProjFeedback(null);
      setShowNewProjectModal(false);
    } catch (err) {
      console.error("Failed to create project:", err);
      setNewProjFeedback(t.shell.newProjectModal.failed);
    }
  };

  // Tab control
  const [currentTab, setCurrentTab] = useState<string>(() => initialWorkspaceTab(window.location.href));
  useEffect(() => {
    const redirect = retiredPageRedirect(window.location.href);
    if (redirect) window.history.replaceState(null, "", redirect);
  }, []);
  useEffect(() => {
    if (currentUser?.role === "client" && currentTab === "overview") setCurrentTab("sourcing");
  }, [currentUser?.role, currentTab]);
  
  // Embedded Minor sheet key tracker (linked from click on certain Major SOP steps)
  const [activeMinorSheetKey, setActiveMinorSheetKey] = useState<string | null>(null);

  // State synchronization guard (stores the project associated with active memory states to prevent race overrides)
  const [loadedProjectId, setLoadedProjectId] = useState<string>("");

  // Core application persisted states

  const [targetSpecs, setTargetSpecsInternal] = useState<TargetSpecification[]>([]);
  const [rfqs, setRfqsInternal] = useState<RfqSubmission[]>([]);
  const [valueChain, setValueChainInternal] = useState<ValueChainCosting[]>([]);
  const [rfqMatrix, setRfqMatrixInternal] = useState<RfqComparativeMatrix[]>([]);
  const [recipes, setRecipesInternal] = useState<ProductRecipe[]>([]);
  const [suppliers, setSuppliersInternal] = useState<Supplier[]>([]);
  const [shipments, setShipmentsInternal] = useState<ShipmentMilestone[]>([]);
  const [inventory, setInventoryInternal] = useState<InventoryItem[]>([]);
  const [fulfillmentOrders, setFulfillmentOrdersInternal] = useState<FulfillmentOrder[]>([]);

  // Dynamic refs to support stable callback setters without stale closure issues
  const activeProjectIdRef = React.useRef(activeProjectId);

  const targetSpecsRef = React.useRef(targetSpecs);
  const rfqsRef = React.useRef(rfqs);
  const valueChainRef = React.useRef(valueChain);
  const rfqMatrixRef = React.useRef(rfqMatrix);
  const recipesRef = React.useRef(recipes);
  const suppliersRef = React.useRef(suppliers);
  const shipmentsRef = React.useRef(shipments);
  const inventoryRef = React.useRef(inventory);
  const fulfillmentOrdersRef = React.useRef(fulfillmentOrders);

  React.useEffect(() => { activeProjectIdRef.current = activeProjectId; }, [activeProjectId]);

  React.useEffect(() => { targetSpecsRef.current = targetSpecs; }, [targetSpecs]);
  React.useEffect(() => { rfqsRef.current = rfqs; }, [rfqs]);
  React.useEffect(() => { valueChainRef.current = valueChain; }, [valueChain]);
  React.useEffect(() => { rfqMatrixRef.current = rfqMatrix; }, [rfqMatrix]);
  React.useEffect(() => { recipesRef.current = recipes; }, [recipes]);
  React.useEffect(() => { suppliersRef.current = suppliers; }, [suppliers]);
  React.useEffect(() => { shipmentsRef.current = shipments; }, [shipments]);
  React.useEffect(() => { inventoryRef.current = inventory; }, [inventory]);
  React.useEffect(() => { fulfillmentOrdersRef.current = fulfillmentOrders; }, [fulfillmentOrders]);

  // Generic collection synchronizer
  const syncCollection = React.useCallback(async <T extends { id: string }>(
    collectionName: string,
    newItems: T[],
    oldItems: T[]
  ) => {
    try {
      const projId = activeProjectIdRef.current;
      // Find modified/added
      for (const item of newItems) {
        const existing = oldItems.find(o => o.id === item.id);
        if (!existing || JSON.stringify(existing) !== JSON.stringify(item)) {
          const docRef = doc(db, collectionName, `${projId}_${item.id}`);
          await setDoc(docRef, { ...item, projectId: projId }, { merge: true });
        }
      }
      // Find deleted
      for (const oldItem of oldItems) {
        const existsInNew = newItems.some(n => n.id === oldItem.id);
        if (!existsInNew) {
          const docRef = doc(db, collectionName, `${projId}_${oldItem.id}`);
          await deleteDoc(docRef);
        }
      }
    } catch (e) {
      console.error(`Failed to sync collection ${collectionName} with Firestore:`, e);
      setAppError(getMessages().shell.errors.changeNotSaved);
    }
  }, []);

  // Custom setter wrappers that push changes to Firestore


  const setTargetSpecs = React.useCallback((val: React.SetStateAction<TargetSpecification[]>) => {
    const current = targetSpecsRef.current;
    const nextVal = typeof val === "function" ? (val as Function)(current) : val;
    syncCollection("targetSpecs", nextVal, current);
  }, [syncCollection]);

  const setRfqs = React.useCallback((val: React.SetStateAction<RfqSubmission[]>) => {
    const current = rfqsRef.current;
    const nextVal = typeof val === "function" ? (val as Function)(current) : val;
    syncCollection("rfqs", nextVal, current);
  }, [syncCollection]);

  const setValueChain = React.useCallback((val: React.SetStateAction<ValueChainCosting[]>) => {
    const current = valueChainRef.current;
    const nextVal = typeof val === "function" ? (val as Function)(current) : val;
    syncCollection("valueChain", nextVal, current);
  }, [syncCollection]);

  const setRfqMatrix = React.useCallback((val: React.SetStateAction<RfqComparativeMatrix[]>) => {
    const current = rfqMatrixRef.current;
    const nextVal = typeof val === "function" ? (val as Function)(current) : val;
    syncCollection("rfqMatrix", nextVal, current);
  }, [syncCollection]);

  const setRecipes = React.useCallback((val: React.SetStateAction<ProductRecipe[]>) => {
    const current = recipesRef.current;
    const nextVal = typeof val === "function" ? (val as Function)(current) : val;
    syncCollection("recipes", nextVal, current);
  }, [syncCollection]);

  const setSuppliers = React.useCallback((val: React.SetStateAction<Supplier[]>) => {
    const current = suppliersRef.current;
    const nextVal = typeof val === "function" ? (val as Function)(current) : val;
    syncCollection("suppliers", nextVal, current);
  }, [syncCollection]);

  const setShipments = React.useCallback((val: React.SetStateAction<ShipmentMilestone[]>) => {
    const current = shipmentsRef.current;
    const nextVal = typeof val === "function" ? (val as Function)(current) : val;
    syncCollection("shipments", nextVal, current);
  }, [syncCollection]);

  const setInventory = React.useCallback((val: React.SetStateAction<InventoryItem[]>) => {
    const current = inventoryRef.current;
    const nextVal = typeof val === "function" ? (val as Function)(current) : val;
    syncCollection("inventory", nextVal, current);
  }, [syncCollection]);

  const setFulfillmentOrders = React.useCallback((val: React.SetStateAction<FulfillmentOrder[]>) => {
    const current = fulfillmentOrdersRef.current;
    const nextVal = typeof val === "function" ? (val as Function)(current) : val;
    syncCollection("fulfillmentOrders", nextVal, current);
  }, [syncCollection]);

  // Real-time snapshots are required to keep stock and order changes consistent across sessions.
  useEffect(() => {
    const setters: Record<string, (items: any[]) => void> = {
      targetSpecs: setTargetSpecsInternal, rfqs: setRfqsInternal, valueChain: setValueChainInternal,
      rfqMatrix: setRfqMatrixInternal, recipes: setRecipesInternal, suppliers: setSuppliersInternal,
      shipments: setShipmentsInternal, inventory: setInventoryInternal, fulfillmentOrders: setFulfillmentOrdersInternal,
    };
    Object.values(setters).forEach(setter => setter([]));
    setLoadedProjectId("");
    if (!currentUser || !activeProjectId || currentUser.role === "freelancer") return;
    const unsubscribers = Object.entries(setters).map(([name, setter]) => onSnapshot(
      query(collection(db, name), where("projectId", "==", activeProjectId)),
      snapshot => setter(snapshot.docs.map(item => ({ ...item.data(), id: item.data().id || item.id }))),
      () => setAppError(getMessages().shell.errors.collectionLoad(name))
    ));
    setLoadedProjectId(activeProjectId);
    return () => unsubscribers.forEach(stop => stop());
  }, [activeProjectId, currentUser?.id, currentUser?.role]);

  // Sync Google Drive OAuth postMessage messages
  useEffect(() => {
    const handleGoogleMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === "OAUTH_AUTH_SUCCESS" && event.data.firebaseUid === auth.currentUser?.uid) {
        const { accessToken, email, picture } = event.data;
        setDriveAuth(accessToken, email, picture);
      }
    };
    window.addEventListener("message", handleGoogleMessage);
    return () => window.removeEventListener("message", handleGoogleMessage);
  }, []);

  // Handle Logout Session clear
  const handleLogout = React.useCallback(async () => {
    bindUser(null);
    await signOut(auth);
    setDriveAuth(null, null, null);
    setCurrentUser(null);
    setCurrentTab("sourcing");
  }, []);

  // 3. Render login portal screen if un-authenticated
  if (!authReady) return <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" /><p className="text-sm font-medium text-slate-500">{t.shell.preparing}</p></div>;
  if (!currentUser) {
    return <LoginScreen initialError={appError} onLoginSuccess={() => {}} />;
  }

  // 3.5. Render Freelance Dashboard if role is freelancer (strict UI isolation)
  if (currentUser.role === "freelancer") {
    return <FreelancerDashboard currentUser={currentUser} onLogout={handleLogout} />;
  }

  return (
    <div className="workspace-app min-h-screen bg-slate-50 flex flex-col font-sans antialiased">
      
      {/* Dynamic Navigation bar header */}
      <Navbar 
        currentTab={currentTab} 
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          setActiveMinorSheetKey(null); // Reset focus sheets on tab swap
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        activeProjectId={activeProjectId}
        setActiveProjectId={setActiveProjectId}
        projects={projects}
        onOpenNewProjectModal={currentUser.role === "admin" ? () => setShowNewProjectModal(true) : undefined}
      />

      {/* Primary Context area wrapper container layout */}
      <main id="workspace-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        <div className="page-intro">
          <div><p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-teal-700"><span className="h-1.5 w-1.5 rounded-full bg-teal-600" /> <span lang={nameLocale(lang)}>{projectDisplayName(projects.find(project => project.id === activeProjectId), lang, t.shell.defaultWorkspaceName)}</span></p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">{t.shell.intro.titles[currentTab] || t.shell.intro.defaultTitle}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{t.shell.intro.texts[currentTab]}</p>
          </div>
          <div className="intro-date"><span className="text-[10px] uppercase tracking-widest text-slate-400">{t.shell.today}</span><span className="mt-1 block text-xs font-semibold text-slate-600">{fmt.date(new Date())}</span></div>
        </div>

        {appError && <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">{appError}<button className="ml-4 underline" onClick={() => setAppError("")}>{t.common.close}</button></div>}
        {/* Dynamic active View Renderer Router logic */}
        <div className="space-y-6">

          {currentUser.role === "admin" && currentTab === "buyers" && <BuyerDirectory />}

          {currentUser.role === "admin" && currentTab === "sectors" && (
            <SectorDirectory />
          )}

          {/* SOURCING FLOW (SECTION A) TAB VIEW */}
          {!activeProjectId && <p className="rounded-xl border bg-white p-6">{t.shell.noAccessibleProject}</p>}
          {activeProjectId && currentTab === "sourcing" && (
            <div key={activeProjectId} className="space-y-6">
              <SourcingWorkflow projectId={activeProjectId} currentUser={currentUser} />
              <ProjectDocumentVault currentProjectId={activeProjectId} readOnly={currentUser.role !== "admin"} />
            </div>
          )}

          {activeProjectId && currentTab === "overview" && currentUser.role === "admin" && <div className="space-y-6"><AdminOverview projectId={activeProjectId} onNavigate={setCurrentTab} /><ProjectNamesPanel project={projects.find(project => project.id === activeProjectId)} /><UserManagement projects={projects} /><BackupPanel projectId={activeProjectId} /></div>}

          {/* STRATEGIC COORDINATION & LOGISTICS (SECTION B) */}
          {activeProjectId && currentTab === "logistics" && (
            <div key={activeProjectId} className="space-y-6">
              <h2 className="text-2xl font-bold text-navy">{t.logistics.heading}</h2>
              <SourcingWorkflow projectId={activeProjectId} currentUser={currentUser} workflow="logistics" />
              <OperationsHub projectId={activeProjectId} isAdmin={currentUser.role === "admin"} />
            </div>
          )}



          {/* MARKET INSIGHTS MANAGEMENT PANEL */}
          {currentTab === "market-insights" && (
            <MarketInsightsManagement currentProjectId={activeProjectId} />
          )}

        </div>

      </main>

      {/* Solid humanized minimal branding footer */}
      <footer className="border-t border-slate-200 bg-white py-6 select-none mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium font-mono">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-800">Trade2Turkey Co-op Ltd.</span>
            <span>|</span>
            <span>{t.shell.footerTagline}</span>
          </div>
          <div className="text-slate-400 text-[10px]">
            {t.shell.footerNote}
          </div>
        </div>
      </footer>

      {/* 8. NEW PROJECT CREATION MODAL */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-white space-y-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-400 text-[10px] font-bold font-mono tracking-wider uppercase">
                  {t.shell.newProjectModal.badge}
                </div>
                <h3 className="text-lg font-black text-white font-display">
                  {t.shell.newProjectModal.title}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowNewProjectModal(false);
                  setNewProjFeedback(null);
                }}
                className="text-slate-400 hover:text-white transition cursor-pointer text-sm font-bold bg-slate-850 px-2.5 py-1 rounded-lg border border-slate-800"
              >
                {t.shell.newProjectModal.close}
              </button>
            </div>

            {newProjFeedback && (
              <div className="bg-teal-500/10 border border-teal-500/20 text-teal-350 text-xs p-3.5 rounded-xl font-medium leading-relaxed font-mono">
                {newProjFeedback}
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleCreateProject} className="space-y-4">
              
              {/* Proje Adı */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  {t.shell.newProjectModal.name}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.shell.newProjectModal.namePlaceholder}
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition"
                />
              </div>

              {/* Proje Adı (İngilizce) — opsiyonel */}
              <div className="space-y-1.5 font-sans">
                <label htmlFor="new-project-name-en" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  {t.shell.newProjectModal.nameEn}
                </label>
                <input
                  id="new-project-name-en"
                  type="text"
                  maxLength={200}
                  placeholder={t.shell.newProjectModal.nameEnPlaceholder}
                  value={newProjNameEn}
                  onChange={(e) => setNewProjNameEn(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition"
                />
                <p className="text-[10px] text-slate-500">{t.shell.newProjectModal.nameEnHint}</p>
              </div>

              {/* Proje Kimliği / ID */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  {t.shell.newProjectModal.id}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.shell.newProjectModal.idPlaceholder}
                  value={newProjId}
                  onChange={(e) => setNewProjId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition font-mono uppercase"
                />
                <span className="text-[9px] text-slate-500 block leading-normal mt-1">
                  {t.shell.newProjectModal.idHint}
                </span>
              </div>

              {/* Proje Bağlamı / Açıklaması */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  {t.shell.newProjectModal.description}
                </label>
                <textarea
                  placeholder={t.shell.newProjectModal.descriptionPlaceholder}
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition h-20 resize-none font-sans"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewProjectModal(false);
                    setNewProjFeedback(null);
                  }}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-850 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
                >
                  {t.shell.newProjectModal.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-slate-955 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {t.shell.newProjectModal.create}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


    </div>
  );
}
