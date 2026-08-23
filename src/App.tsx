/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import MinorSheets from "./components/MinorSheets";
import ProjectDocumentVault from "./components/ProjectDocumentVault";
import LogisticsSOP from "./components/LogisticsSOP";
import ClientDiscovery from "./components/ClientDiscovery";
import ReportGenerator from "./components/ReportGenerator";
import { MarketInsightsManagement } from "./components/MarketInsights";
import LoginScreen from "./components/LoginScreen";
import FreelancerDashboard, { freelanceSOPData } from "./components/FreelancerDashboard";
import { UserTenant, INITIAL_TENANTS } from "./data/usersData";
import { setDriveAuth } from "./lib/driveAuth";
import { db } from "./lib/firebase";
import { onSnapshot, collection, query, where, doc, setDoc, deleteDoc, writeBatch, getDocs } from "firebase/firestore";

import { 
  INITIAL_TARGET_SPECS, INITIAL_RFQS, 
  INITIAL_VALUE_CHAIN_COSTINGS, INITIAL_RFQ_MATRICES, 
  INITIAL_PRODUCT_RECIPES, INITIAL_SUPPLIERS, INITIAL_SHIPMENTS, 
  INITIAL_INVENTORY_ITEMS, INITIAL_FULFILLMENT_ORDERS,
  TargetSpecification, RfqSubmission, ValueChainCosting,
  RfqComparativeMatrix, ProductRecipe, Supplier, ShipmentMilestone,
  InventoryItem, FulfillmentOrder
} from "./types";

import { 
  ClipboardList, ShieldAlert, Users, PlusCircle,
  Compass, Coins, Truck, Settings, FileText, CheckCircle, Eye, ShieldCheck, Mail, Lock
} from "lucide-react";

export default function App() {
  // Active corporate context state
  const [currentUser, setCurrentUser] = useState<UserTenant | null>(() => {
    try {
      const stored = localStorage.getItem("t2t_current_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [activeProjectId, setActiveProjectId] = useState<string>("PROJE-UNLU MAMÜLLER");

  // Dynamic projects list loaded from Firestore
  const [projects, setProjects] = useState<any[]>([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjId, setNewProjId] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");
  const [newProjFeedback, setNewProjFeedback] = useState<string | null>(null);

  // Dynamic user store in localStorage to persist new corporate clients added by the owner
  const [customUsers, setCustomUsers] = useState<UserTenant[]>(() => {
    try {
      const stored = localStorage.getItem("t2t_custom_users");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Admin Workspace Creation State
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");
  const [newClientProject, setNewClientProject] = useState("PROJE-UNLU MAMÜLLER");
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  // Impersonation / Audit mode state
  const [auditedFreelancer, setAuditedFreelancer] = useState<UserTenant | null>(null);

  // Synchronize dynamic user profile mapping when logging in
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("t2t_current_user", JSON.stringify(currentUser));
      // Force change context to the tenant's exact project ID if they are a regular client
      if (currentUser.role === "client") {
        setActiveProjectId(currentUser.projectId);
      }
    } else {
      localStorage.removeItem("t2t_current_user");
    }
  }, [currentUser]);

  // Keep currently logged-in user profile updated from Firestore in real-time
  useEffect(() => {
    if (!currentUser?.id) return;
    const userDocRef = doc(db, "users", currentUser.id);
    const unsub = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const dbData = snapshot.data() as UserTenant;
        // Clean any legacy project IDs dynamically
        if (dbData.projectId === "PROJ-BEANBAG" || dbData.projectId === "PROJ-VELVET" || !dbData.projectId) {
          dbData.projectId = "PROJE-UNLU MAMÜLLER";
        }
        if (JSON.stringify(dbData) !== JSON.stringify(currentUser)) {
          setCurrentUser(dbData);
          localStorage.setItem("t2t_current_user", JSON.stringify(dbData));
        }
      }
    });
    return () => unsub();
  }, [currentUser?.id]);

  // Real-time listener for projects collection in Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "projects"), async (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data());
      });
      
      // Fallback seed if projects collection is empty
      if (items.length === 0) {
        console.log("Seeding default project PROJE-UNLU MAMÜLLER...");
        try {
          const defaultProj = {
            id: "PROJE-UNLU MAMÜLLER",
            name: "Unlu Mamüller Projesi",
            description: "Tedarik hattı unlu mamüller ve gıda dış ticaret projesi.",
            status: "active",
            createdAt: new Date().toISOString(),
            sopStepsTemplate: freelanceSOPData.map(s => ({
              step: s.step,
              task: s.task,
              kpi: s.kpi,
              storage: s.storage,
              status: "Pending"
            }))
          };
          await setDoc(doc(db, "projects", defaultProj.id), defaultProj);
          items.push(defaultProj);
        } catch (err) {
          console.error("Failed to seed default project:", err);
        }
      }

      // Sync PROJECT_NAMES map globally
      const projectMap: Record<string, string> = {};
      items.forEach(p => {
        projectMap[p.id] = p.name;
      });
      (window as any).PROJECT_NAMES = projectMap;
      localStorage.setItem("t2t_project_names", JSON.stringify(projectMap));
      setProjects(items);
    });

    return () => unsub();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim() || !newProjId.trim()) {
      setNewProjFeedback("Lütfen gerekli alanları (Proje Adı, Proje Kimliği) doldurun.");
      return;
    }

    // Transform Project ID to uppercase and space-less format
    const cleanedProjId = newProjId.trim().toUpperCase().replace(/\s+/g, "-");

    // Check if project ID already exists
    if (projects.some(p => p.id === cleanedProjId)) {
      setNewProjFeedback("Bu Proje Kimliği zaten mevcut.");
      return;
    }

    setNewProjFeedback("Proje oluşturuluyor...");

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
        description: newProjDesc.trim(),
        status: "active",
        createdAt: new Date().toISOString(),
        sopStepsTemplate: defaultSopSteps
      };
      await setDoc(projRef, newProj);
      
      setNewProjName("");
      setNewProjId("");
      setNewProjDesc("");
      setNewProjFeedback(null);
      setShowNewProjectModal(false);
    } catch (err) {
      console.error("Failed to create project:", err);
      setNewProjFeedback("Proje oluşturulurken bir hata oluştu.");
    }
  };

  // Tab control
  const [currentTab, setCurrentTab] = useState<string>("sourcing");
  const [clientMode, setClientMode] = useState<boolean>(false);
  
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

  // Seeder utility
  const seedCollection = async (collectionName: string, initialData: any[], force = false) => {
    const seedKey = `${activeProjectId}_${collectionName}`;
    if (!force && (window as any)[`seeded_${seedKey}`]) return;
    (window as any)[`seeded_${seedKey}`] = true;

    console.log(`Seeding empty collection "${collectionName}" for project ${activeProjectId}...`);
    try {
      const batch = writeBatch(db);
      initialData.forEach(item => {
        const docRef = doc(db, collectionName, `${activeProjectId}_${item.id}`);
        batch.set(docRef, { ...item, projectId: activeProjectId });
      });
      await batch.commit();
    } catch (e) {
      console.error(`Failed to seed ${collectionName}:`, e);
    }
  };

  // 1. Initial State Hydrator: loads dataset filtered strictly by active project ID from Firestore
  useEffect(() => {
    if (!currentUser) return;

    // Run one-time Firestore cleanup of test data
    const runCleanupMigration = async () => {
      const collectionsToClean = [
        "leads", "sopSteps", "targetSpecs", "rfqs", "valueChain", 
        "rfqMatrix", "recipes", "suppliers", "shipments", 
        "inventory", "fulfillmentOrders", "driveFiles"
      ];
      
      console.log("Starting Firestore migration & cleanup...");
      try {
        for (const collName of collectionsToClean) {
          const snapshot = await getDocs(collection(db, collName));
          const batch = writeBatch(db);
          let count = 0;
          snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            if (data.projectId === "PROJ-BEANBAG" || data.projectId === "PROJ-VELVET" || !data.projectId) {
              batch.delete(docSnapshot.ref);
              count++;
            }
          });
          if (count > 0) {
            await batch.commit();
            console.log(`Deleted ${count} old test documents from ${collName}`);
          }
        }
        // Migrate existing user profile document project IDs and set freelancer name
        const usersSnapshot = await getDocs(collection(db, "users"));
        const userBatch = writeBatch(db);
        let userCount = 0;
        usersSnapshot.forEach(docSnapshot => {
          const userData = docSnapshot.data();
          let needsUpdate = false;
          const updates: any = {};
          if (userData.projectId === "PROJ-BEANBAG" || userData.projectId === "PROJ-VELVET" || !userData.projectId) {
            updates.projectId = "PROJE-UNLU MAMÜLLER";
            updates.driveFolderName = userData.driveFolderName?.replace("PROJ-BEANBAG", "PROJE-UNLU MAMÜLLER")?.replace("PROJ-VELVET", "PROJE-UNLU MAMÜLLER") || "PROJE-UNLU MAMÜLLER";
            needsUpdate = true;
          }
          if (needsUpdate) {
            userBatch.update(docSnapshot.ref, updates);
            userCount++;
          }
        });
        if (userCount > 0) {
          await userBatch.commit();
          console.log(`Migrated ${userCount} user profiles in Firestore`);
        }

        console.log("Firestore migration & cleanup complete!");
      } catch (err) {
        console.error("Migration cleanup failed:", err);
      }
    };
    runCleanupMigration();

    // Listen to users from Firestore
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const dbUsers: UserTenant[] = [];
      snapshot.forEach(doc => {
        const u = doc.data() as UserTenant;
        const isDefault = INITIAL_TENANTS.some(t => t.id === u.id);
        if (!isDefault) {
          dbUsers.push(u);
        }
      });
      setCustomUsers(dbUsers);
      localStorage.setItem("t2t_custom_users", JSON.stringify(dbUsers));
    });



    const qSpecs = query(collection(db, "targetSpecs"), where("projectId", "==", activeProjectId));
    const unsubSpecs = onSnapshot(qSpecs, (snapshot) => {
      if (snapshot.empty) {
        seedCollection("targetSpecs", INITIAL_TARGET_SPECS);
      } else {
        const items = snapshot.docs.map(doc => doc.data() as TargetSpecification);
        const needsReseed = items.some(item => !item.productName.includes("Unlu Mamüller"));
        if (needsReseed) {
          console.log("targetSpecs language mismatch detected. Re-seeding...");
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          batch.commit().then(() => seedCollection("targetSpecs", INITIAL_TARGET_SPECS));
        } else {
          setTargetSpecsInternal(items);
        }
      }
    });

    const qRfqs = query(collection(db, "rfqs"), where("projectId", "==", activeProjectId));
    const unsubRfqs = onSnapshot(qRfqs, (snapshot) => {
      if (snapshot.empty) {
        seedCollection("rfqs", INITIAL_RFQS);
      } else {
        const items = snapshot.docs.map(doc => doc.data() as RfqSubmission);
        const needsReseed = items.some(item => !item.productName.includes("Unlu Mamüller"));
        if (needsReseed) {
          console.log("rfqs language mismatch detected. Re-seeding...");
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          batch.commit().then(() => seedCollection("rfqs", INITIAL_RFQS));
        } else {
          setRfqsInternal(items);
        }
      }
    });

    const qChain = query(collection(db, "valueChain"), where("projectId", "==", activeProjectId));
    const unsubChain = onSnapshot(qChain, (snapshot) => {
      if (snapshot.empty) {
        seedCollection("valueChain", INITIAL_VALUE_CHAIN_COSTINGS);
      } else {
        const items = snapshot.docs.map(doc => doc.data() as ValueChainCosting);
        const needsReseed = items.some(item => !item.productName.includes("Unlu Mamüller"));
        if (needsReseed) {
          console.log("valueChain language mismatch detected. Re-seeding...");
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          batch.commit().then(() => seedCollection("valueChain", INITIAL_VALUE_CHAIN_COSTINGS));
        } else {
          setValueChainInternal(items);
        }
      }
    });

    const qMatrix = query(collection(db, "rfqMatrix"), where("projectId", "==", activeProjectId));
    const unsubMatrix = onSnapshot(qMatrix, (snapshot) => {
      if (snapshot.empty) {
        seedCollection("rfqMatrix", INITIAL_RFQ_MATRICES);
      } else {
        const items = snapshot.docs.map(doc => doc.data() as RfqComparativeMatrix);
        const needsReseed = items.some(item => !item.productName.includes("Unlu Mamüller"));
        if (needsReseed) {
          console.log("rfqMatrix language mismatch detected. Re-seeding...");
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          batch.commit().then(() => seedCollection("rfqMatrix", INITIAL_RFQ_MATRICES));
        } else {
          setRfqMatrixInternal(items);
        }
      }
    });

    const qRecipes = query(collection(db, "recipes"), where("projectId", "==", activeProjectId));
    const unsubRecipes = onSnapshot(qRecipes, (snapshot) => {
      if (snapshot.empty) {
        seedCollection("recipes", INITIAL_PRODUCT_RECIPES);
      } else {
        const items = snapshot.docs.map(doc => doc.data() as ProductRecipe);
        const needsReseed = items.some(item => !item.productName.includes("Unlu Mamüller"));
        if (needsReseed) {
          console.log("recipes language mismatch detected. Re-seeding...");
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          batch.commit().then(() => seedCollection("recipes", INITIAL_PRODUCT_RECIPES));
        } else {
          setRecipesInternal(items);
        }
      }
    });

    const qSuppliers = query(collection(db, "suppliers"), where("projectId", "==", activeProjectId));
    const unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      if (snapshot.empty) {
        seedCollection("suppliers", INITIAL_SUPPLIERS);
      } else {
        const items = snapshot.docs.map(doc => doc.data() as Supplier);
        const needsReseed = items.some(item => !item.name.includes("Anadolu Tekstil Ltd."));
        if (needsReseed) {
          console.log("suppliers language mismatch detected. Re-seeding...");
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          batch.commit().then(() => seedCollection("suppliers", INITIAL_SUPPLIERS));
        } else {
          setSuppliersInternal(items);
        }
      }
    });

    const qShipments = query(collection(db, "shipments"), where("projectId", "==", activeProjectId));
    const unsubShipments = onSnapshot(qShipments, (snapshot) => {
      if (snapshot.empty) {
        seedCollection("shipments", INITIAL_SHIPMENTS);
      } else {
        const items = snapshot.docs.map(doc => doc.data() as ShipmentMilestone);
        const needsReseed = items.some(item => 
          !item.productName.includes("Unlu Mamüller") ||
          item.milestones.length === 0 ||
          item.milestones[0].title !== "Hammadde tedariği tamamlandı" ||
          !item.milestones.some(m => m.title === "İthalat Ülkesi Limanına Varış")
        );
        if (needsReseed) {
          console.log("shipments language mismatch or old route detected. Re-seeding...");
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          batch.commit().then(() => seedCollection("shipments", INITIAL_SHIPMENTS, true));
        } else {
          setShipmentsInternal(items);
        }
      }
    });

    const qInventory = query(collection(db, "inventory"), where("projectId", "==", activeProjectId));
    const unsubInventory = onSnapshot(qInventory, (snapshot) => {
      if (snapshot.empty) {
        seedCollection("inventory", INITIAL_INVENTORY_ITEMS);
      } else {
        const items = snapshot.docs.map(doc => doc.data() as InventoryItem);
        const needsReseed = items.some(item => !item.name.includes("Unlu Mamüller"));
        if (needsReseed) {
          console.log("inventory language mismatch detected. Re-seeding...");
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          batch.commit().then(() => seedCollection("inventory", INITIAL_INVENTORY_ITEMS));
        } else {
          setInventoryInternal(items);
        }
      }
    });

    const qOrders = query(collection(db, "fulfillmentOrders"), where("projectId", "==", activeProjectId));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      if (snapshot.empty) {
        seedCollection("fulfillmentOrders", INITIAL_FULFILLMENT_ORDERS);
      } else {
        const items = snapshot.docs.map(doc => doc.data() as FulfillmentOrder);
        const needsReseed = items.some(item => item.platform.includes("Amazon") && item.customerName.includes("Elspeth Vance"));
        if (needsReseed) {
          console.log("fulfillmentOrders language mismatch detected. Re-seeding...");
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          batch.commit().then(() => seedCollection("fulfillmentOrders", INITIAL_FULFILLMENT_ORDERS));
        } else {
          setFulfillmentOrdersInternal(items);
        }
      }
    });

    setLoadedProjectId(activeProjectId);

    return () => {
      unsubUsers();

      unsubSpecs();
      unsubRfqs();
      unsubChain();
      unsubMatrix();
      unsubRecipes();
      unsubSuppliers();
      unsubShipments();
      unsubInventory();
      unsubOrders();
    };
  }, [activeProjectId, currentUser]);

  // Sync Google Drive OAuth postMessage messages
  useEffect(() => {
    const handleGoogleMessage = (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const { accessToken, email, picture } = event.data;
        setDriveAuth(accessToken, email, picture);
      }
    };
    window.addEventListener("message", handleGoogleMessage);
    return () => window.removeEventListener("message", handleGoogleMessage);
  }, []);

  // Handle Logout Session clear
  const handleLogout = React.useCallback(() => {
    setCurrentUser(null);
    setClientMode(false);
    setCurrentTab("sourcing");
  }, []);

  // Add Dynamic user workspace as administrator
  const handleAddClientAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientEmail || !newClientCompany) {
      setAdminFeedback("Lütfen hem e-posta hem de takım bilgilerini doldurun.");
      return;
    }

    const cleanedEmail = newClientEmail.trim().toLowerCase();
    const prefix = cleanedEmail.split("@")[0];
    const generatedPass = `${prefix}2026`;

    // Create Tenant Model
    const newTenant: UserTenant = {
      id: `custom_${prefix}_${Date.now()}`,
      email: cleanedEmail,
      companyName: newClientCompany,
      role: "client",
      projectId: newClientProject,
      driveFolderName: `${newClientProject} (${newClientCompany})`
    };

    // Save in Firestore users collection
    const userDocRef = doc(db, "users", newTenant.id);
    setDoc(userDocRef, newTenant);

    // Save Preset Credentials
    // For demonstration, registering on-the-fly dynamically injects credentials matched in login preset handler
    try {
      const storedPresets = localStorage.getItem("t2t_preset_creds") || "{}";
      const parsedPresets = JSON.parse(storedPresets);
      parsedPresets[cleanedEmail] = { password: generatedPass, id: newTenant.id };
      localStorage.setItem("t2t_preset_creds", JSON.stringify(parsedPresets));
    } catch (err) {
      console.warn("Hazır kimlik kaydı başarısız oldu", err);
    }

    // Success notification
    setAdminFeedback(`🎉 Success! Workspace created for ${newClientCompany}. Credentials set to Email: ${cleanedEmail} | Password: ${generatedPass}`);
    setNewClientEmail("");
    setNewClientCompany("");
    
    setTimeout(() => setAdminFeedback(null), 12000);
  };

  // Switch workspace context and simulate dynamic client login
  const handleAdminInspectClient = React.useCallback((tenant: UserTenant) => {
    setActiveProjectId(tenant.projectId);
    setAdminFeedback(`🔍 İnceleme Modu: Konuk kiracı ile ilişkili çalışma alanı görüntüleniyor "${tenant.companyName}". Yönetici bağlamını geri yüklemek için navigasyon çubuğundaki seçim açılır menüsünü kapatın.`);
    window.scrollTo({ top: 380, behavior: "smooth" });
  }, []);

  // 3. Render login portal screen if un-authenticated
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  // 3.5. Render Freelance Dashboard if role is freelancer (strict UI isolation)
  if (currentUser.role === "freelancer") {
    return <FreelancerDashboard currentUser={currentUser} onLogout={handleLogout} />;
  }

  // List of all active tenants (initial defaults + manually added ones)
  const allCurrentTenantsList = [...INITIAL_TENANTS.filter(t => t.role !== "admin"), ...customUsers];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none antialiased">
      
      {/* Dynamic Navigation bar header */}
      <Navbar 
        currentTab={currentTab} 
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          setActiveMinorSheetKey(null); // Reset focus sheets on tab swap
        }}
        clientMode={clientMode}
        setClientMode={setClientMode}
        currentUser={currentUser}
        onLogout={handleLogout}
        activeProjectId={activeProjectId}
        setActiveProjectId={setActiveProjectId}
        projects={projects}
        onOpenNewProjectModal={() => setShowNewProjectModal(true)}
      />

      {/* Primary Context area wrapper container layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Trade2Turkey Welcome Hero Billboard Jumbotron */}
        <div className="bg-gradient-to-r from-navy via-navy-light to-black rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-navy/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          {/* Subtle geometric lines */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 transform origin-top-right pointer-events-none" />
          
          <div className="space-y-2 max-w-2xl">
            <span className="bg-black/40 text-sky-200 text-[10px] font-extrabold uppercase font-mono px-3 py-1 rounded-full tracking-wider border border-white/10 flex items-center gap-1.5 w-fit">
              <ShieldCheck className="h-3 w-3 text-sky-300" />
              {currentUser.role === 'admin' ? "Trade2Turkey Yönetici Masası" : `${currentUser.companyName} Güvenli Çalışma Alanı`}
            </span>
            <h2 className="text-2xl md:text-3xl font-black font-display tracking-tight leading-tight">
              {currentUser.role === "admin" 
                ? "Tedarik Hattı Denetçi Komuta Paneli" 
                : `${currentUser.companyName} Belge Kasası`}
            </h2>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-normal">
              {currentUser.role === "admin"
                ? "Kurumsal tedarik hatlarını izleyin, belirli Google Drive klasör senkronizasyonlarını gözden geçirin, özel çalışma alanları ekleyin ve Türk fabrikalarını veri odaklı operasyonel hassasiyetle değerlendirin."
                : `İzole edilmiş güvenli portalınıza hoş geldiniz. Şu Proje Kimliğine atanan özel Google Drive klasörlerine, sevkiyat takip haritalarına ve şeffaf bileşen maliyet sayfalarına erişiyorsunuz: ${activeProjectId}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Aktif Çalışma Alanı Status */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3 rounded-2xl text-center min-w-[130px] font-mono">
              <span className="block text-[10px] uppercase font-bold text-sky-300">Aktif Çalışma Alanı</span>
              <strong className="text-sm font-extrabold">{activeProjectId}</strong>
            </div>
          </div>
        </div>

        {/* ADMIN-ONLY: CORPORATE TENANT MANAGEMENT DESK */}
        {currentUser.role === "admin" && currentTab === "client-discovery" && (
          <div id="admin-workspace-container" className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 font-display">
                  <Users className="h-5 w-5 text-navy" /> Kurumsal Müşteri Çalışma Alanları ve Kiracı Yönetimi
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  İzole edilmiş iş akışları oluşturun, özel Google Drive dizinlerini eşleştirin ve aktif kullanıcıları anında denetleyin.
                </p>
              </div>
              <span className="text-[10px] bg-navy/5 text-navy font-extrabold px-3 py-1 rounded-full border border-navy/10 uppercase font-mono tracking-wider">
                Çoklu Kiracı Senkronizasyonu Aktif
              </span>
            </div>

            {adminFeedback && (
              <div className="bg-slate-50 border border-slate-200 text-slate-850 text-xs p-4 rounded-2xl font-mono leading-relaxed shadow-inner">
                {adminFeedback}
              </div>
            )}

            {/* Admin actions grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Form: Add New Corporate Client */}
              <form onSubmit={handleAddClientAction} className="lg:col-span-5 bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase font-mono tracking-wider">
                  <PlusCircle className="h-4.5 w-4.5 text-navy" /> Kurumsal Çalışma Alanı Tahsis Et
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Müşteri Şirket Adı
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="örn., Lüks Yaşam A.Ş."
                      value={newClientCompany}
                      onChange={(e) => setNewClientCompany(e.target.value)}
                      className="w-full p-2.5 bg-white border rounded-xl text-xs text-slate-855 placeholder:text-slate-400 focus:outline-none focus:border-navy transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Kullanıcı Kurumsal E-postası</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        placeholder="client@company.com"
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border rounded-xl text-xs text-slate-855 placeholder:text-slate-400 focus:outline-none focus:border-navy transition font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tedarik Hattı Projesi Ata</label>
                    <select
                      value={newClientProject}
                      onChange={(e) => setNewClientProject(e.target.value)}
                      className="w-full p-2.5 bg-white border rounded-xl text-xs text-slate-800 focus:outline-none focus:border-navy transition font-mono font-bold"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.id} ({p.name})</option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-[11px] leading-relaxed text-slate-700">
                    💡 <strong>Şifre Kuralı:</strong> Erişim şifresi otomatik olarak e-posta ön eki + "2026" olarak yapılandırılır. (Örn. E-posta <code>client@company.com</code> ise, şifre <code>client2026</code> olur).
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-navy hover:bg-navy-light text-white font-semibold text-xs py-3 rounded-xl transition cursor-pointer shadow-sm"
                  >
                    Güvenli İzole Çalışma Alanı Oluştur
                  </button>
                </div>
              </form>

              {/* Grid: View and switch between active corporate clients */}
              <div className="lg:col-span-7 space-y-3">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Aktif Kayıtlı Müşteri Çalışma Alanları</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                  {allCurrentTenantsList.map((tenant) => {
                    const isViewing = activeProjectId === tenant.projectId;
                    return (
                      <div
                        key={tenant.id}
                        className={`p-4 rounded-2xl border transition flex flex-col justify-between gap-3 ${
                          isViewing
                            ? "bg-navy text-white border-navy shadow-md"
                            : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold font-display truncate max-w-[170px]">
                              {tenant.companyName}
                            </h5>
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono bg-teal-500/10 text-teal-600">
                              {tenant.projectId}
                            </span>
                          </div>
                          <span className={`block text-[10px] font-mono truncate ${isViewing ? "text-slate-200" : "text-slate-500"}`}>
                            {tenant.email}
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-250/10 pt-2.5 mt-1 select-none">
                          <span className={`text-[10px] font-mono ${isViewing && tenant.role !== "freelancer" ? "text-sky-300 font-bold" : "text-slate-400"}`}>
                            {tenant.role === "freelancer" ? "Saha Temsilcisi (Freelancer)" : (isViewing ? "● Aktif İnceleme" : "İnceleme Devre Dışı")}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => {
                              if (tenant.role === "freelancer") {
                                setAuditedFreelancer(tenant);
                              } else {
                                handleAdminInspectClient(tenant);
                              }
                            }}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition ${
                              isViewing && tenant.role !== "freelancer"
                                ? "bg-white hover:bg-slate-150 text-navy"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            }`}
                          >
                            Çalışma Alanını İncele
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex gap-2.5 text-xs text-slate-800 leading-relaxed font-sans">
                  <ShieldCheck className="h-5 w-5 text-navy mt-0.5 shrink-0" />
                  <div>
                    <strong>Dual-Stitch Security Policy Enforcement:</strong> SofaStyle and Velvet Lounge users remain perfectly compartmentalized. When a user with the corporate credentials of SofaStyle logs in, they are locked to Project ID list filters. They cannot access, browse, or perform uploads to alternate pipelines.
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Dynamic active View Renderer Router logic */}
        <div className="space-y-6">

          {/* SOURCING FLOW (SECTION A) TAB VIEW */}
          {currentTab === "sourcing" && (
            <ProjectDocumentVault currentProjectId={activeProjectId} />
          )}

          {/* STRATEGIC COORDINATION & LOGISTICS (SECTION B) */}
          {currentTab === "logistics" && (
            <LogisticsSOP
              shipments={shipments}
              setShipments={setShipments}
              inventory={inventory}
              setInventory={setInventory}
              fulfillmentOrders={fulfillmentOrders}
              setFulfillmentOrders={setFulfillmentOrders}
              currentProjectId={activeProjectId}
              onChangeProjectId={(pid) => setActiveProjectId(pid)}
              canSwitchProject={currentUser?.role === "admin"}
              isAdmin={currentUser?.role === "admin"}
            />
          )}



          {/* CLIENT DISCOVERY PORTAL (FREELANCE NETWORK) */}
          {currentTab === "client-discovery" && (
            <ClientDiscovery
              currentProjectId={activeProjectId}
              currentUser={currentUser}
              projects={projects}
            />
          )}


          {/* EXECUTIVE SOURCE REPORT CENTER */}
          {currentTab === "report" && (
            <ReportGenerator
              suppliers={suppliers}
              recipes={recipes}
              shipments={shipments}
            />
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
            <span>İhracat Lojistiği ve Tedarik Denetim Merkezi</span>
          </div>
          <div className="text-slate-400 text-[10px]">
            Sistem Çalışıyor • Aktif Port: 3000 • Güvenlik uyumluluk kuralı ATR.v3 aktif
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
                  Yeni Proje Yönetimi
                </div>
                <h3 className="text-lg font-black text-white font-display">
                  Yeni Tedarik/Satış Projesi Ekle
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowNewProjectModal(false);
                  setNewProjFeedback(null);
                }}
                className="text-slate-400 hover:text-white transition cursor-pointer text-sm font-bold bg-slate-850 px-2.5 py-1 rounded-lg border border-slate-800"
              >
                ✕ Kapat
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
                  Proje Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Meyve Suyu Projesi"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition"
                />
              </div>

              {/* Proje Kimliği / ID */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Proje Kimliği / ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: PROJE-MEYVESUYU"
                  value={newProjId}
                  onChange={(e) => setNewProjId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition font-mono uppercase"
                />
                <span className="text-[9px] text-slate-500 block leading-normal mt-1">
                  Girilen kimlik otomatik olarak büyük harfe ve boşluksuz/tireli formata dönüştürülür.
                </span>
              </div>

              {/* Proje Bağlamı / Açıklaması */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Proje Bağlamı / Açıklaması
                </label>
                <textarea
                  placeholder="Projenin amacını, hedeflerini veya sektörel detaylarını belirtin..."
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
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-slate-955 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Proje Oluştur
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* AUDIT MODE OVERLAY */}
      {auditedFreelancer && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-955/90 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full h-[90vh] max-w-7xl bg-slate-955 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            
            {/* Audit Header */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="bg-red-500/10 text-red-400 text-[10px] font-black uppercase font-mono px-2.5 py-1 rounded-md border border-red-500/25 tracking-wider animate-pulse">
                  ⚠️ DENETİM MODU (SALT OKUNUR)
                </span>
                <h3 className="text-base font-black text-white font-display">
                  Denetim Modu: {auditedFreelancer.name || auditedFreelancer.displayName || auditedFreelancer.companyName || auditedFreelancer.email} Çalışma Alanı
                </h3>
              </div>
              
              <button
                onClick={() => setAuditedFreelancer(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-slate-850"
                title="Denetim Modundan Çık"
              >
                <span className="text-lg font-bold">✕</span>
              </button>
            </div>

            {/* Audit Content Container */}
            <div className="flex-1 overflow-y-auto bg-slate-955">
              <FreelancerDashboard 
                currentUser={auditedFreelancer} 
                onLogout={() => {}} 
                auditMode={true} 
                auditEmail={auditedFreelancer.email} 
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
