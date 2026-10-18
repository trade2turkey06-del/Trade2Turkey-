import { safeHttps } from "../domain/operations";
import { apiFetch } from "../lib/api";
import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, Coins, Clock, Thermometer, ShieldCheck, 
  Layers, HeartPulse, Globe, Upload, Trash2, Download,
  Loader2, Link2, Unlink, CheckCircle, Database,
  Pencil, Check, X
} from "lucide-react";
import { subscribeDriveAuth, setDriveAuth } from "../lib/driveAuth";
import { db, auth } from "../lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { DriveFile, PROJECT_NAMES } from "../data/driveData";
import { emptyVaultDetails, normalizeVaultDetails, shown as shownValue, type ProjectVaultDetails } from "../domain/vaultDetails";
import { dataLang, useI18n } from "../i18n";
import { marketFromName, marketLabel } from "../domain/countries";

interface ProjectDocumentVaultProps {
  currentProjectId: string;
  readOnly?: boolean;
}

export type { ProjectVaultDetails } from "../domain/vaultDetails";

// Starting (default) state data for PROJE-UNLU MAMÜLLER
const DEFAULT_VAULT_DETAILS: Record<string, ProjectVaultDetails> = {
  "PROJE-UNLU MAMÜLLER": {
    pricingCapacity: {
      exwPriceList: "Ekli Dosya (EXW_Fiyat_Listesi_2026.pdf)",
      moq: "İlk deneme siparişi için 1x 40' HC Konteyner",
      monthlyCapacity: "45 x 40' HC Konteyner (±%10, Tortilla serisi)"
    },
    productionTransit: {
      productionFirstOrder: "İlk sipariş için 4-6 hafta",
      productionRepeatOrder: "Tekrar siparişleri için 2-4 hafta",
      shipmentTransitTime: "8-10 iş günü (Ortalama Lojistik Transit)"
    },
    storageShelfLife: {
      frozenProducts: "Donuk Ürünler (-18°C'de 18 ay raf ömrü)",
      ambientProducts: "Ortam Sıcaklığı Ürünleri (22-24°C, kuru ortamda 12 ay raf ömrü)"
    },
    certifications: {
      coa: "Tortilla CoA (Un karışımı ve bitmiş ürün analiz raporu)",
      certificates: ["Vegan Sertifikası", "BRC (Global Standard Food Safety)", "Helal Sertifikası"]
    },
    palletContainerConfig: {
      boxDimensions: "Koli (52x29.5x20 cm, 12 Paket x 400g = 4.8kg net ağırlık)",
      palletConfig: "Palet (80x120 cm, 72 Koli, 12 katman konfigürasyonu)",
      containerCapacity40HC: "40' HC Konteyner: 25 Palet, Toplam 1.800 Koli, 21.600 Paket"
    },
    nutritionalValues: {
      energy: "1108 kJ / 263 kcal",
      fat: "5.87g",
      fatSaturated: "3.19g",
      carbohydrates: "32.00g",
      sugar: "6.18g",
      protein: "20.00g",
      fiber: "3.87g",
      salt: "1.96g"
    },
    variations: [
      "Sade Tortilla",
      "Tam Buğday Tortilla",
      "Karabuğday Tortilla (Vegan veya karışık protein opsiyonlu, donuk veya ortam sıcaklığı formatlarında)"
    ],
    marketingSamples: "Numuneler hazırlanıyor. Yüksek çözünürlüklü görseller ve insert pazarlama dokümanları eklenecek.",
    exportMarkets: [
      { name: "Almanya", flag: "🇩🇪" },
      { name: "KKTC", flag: "🇨🇾" },
      { name: "Hollanda", flag: "🇳🇱" },
      { name: "Gürcistan", flag: "🇬🇪" },
      { name: "Fransa", flag: "🇫🇷" },
      { name: "Azerbaycan", flag: "🇦🇿" },
      { name: "Irak", flag: "🇮🇶" },
      { name: "Bulgaristan", flag: "🇧🇬" },
      { name: "Kuveyt", flag: "🇰🇼" },
      { name: "İtalya", flag: "🇮🇹" },
      { name: "İspanya", flag: "🇪🇸" },
      { name: "Ukrayna", flag: "🇺🇦" },
      { name: "Suudi Arabistan", flag: "🇸🇦" },
      { name: "BAE", flag: "🇦🇪" },
      { name: "Katar", flag: "🇶🇦" },
      { name: "Bahreyn", flag: "🇧🇭" }
    ],
    productClaims: ["Katkısız", "Yüksek Protein", "Vegan"]
  }
};

interface PackagingConfig {
  productVariant?: string;
  singleWeight?: number;
  packagingStyle?: string;
  innerBoxCount?: number;
  masterCartonCount?: number;
  palletCartonCount?: number;
  cartonNetWeight?: number;
  cartonGrossWeight?: number;
  cartonDimensions?: string;
  totalGrossWeight?: number;
}

const DEFAULT_PACKAGING_CONFIG: PackagingConfig = {
  productVariant: "",
  singleWeight: 0,
  packagingStyle: "",
  innerBoxCount: 0,
  masterCartonCount: 0,
  palletCartonCount: 0,
  cartonNetWeight: 0,
  cartonGrossWeight: 0,
  cartonDimensions: "",
  totalGrossWeight: 0
};


export default function ProjectDocumentVault({ currentProjectId, readOnly = false }: ProjectDocumentVaultProps) {
  const { t } = useI18n();
  const v = t.vault, f = v.fields;
  const market = (item: ProjectVaultDetails["exportMarkets"][number]) => marketLabel(item, t.countries);
  const shown = (value?: string) => shownValue(value, v.notSpecified);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch details dynamically from Firestore or default fallback map
  const [vaultDetails, setVaultDetails] = useState<ProjectVaultDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDetails, setEditedDetails] = useState<ProjectVaultDetails | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  // Manufacturers subcollection states
  const [manufacturers, setManufacturers] = useState<{ id: string; name: string; vaultDetails?: ProjectVaultDetails }[]>([]);
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<string>("");
  const [isAddingManufacturer, setIsAddingManufacturer] = useState(false);
  const [newManufacturerName, setNewManufacturerName] = useState("");
  const [isEditingManufacturerName, setIsEditingManufacturerName] = useState(false);
  const [editedManufacturerName, setEditedManufacturerName] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Product claims local inline states
  const [isEditingClaims, setIsEditingClaims] = useState(false);
  const [editedClaims, setEditedClaims] = useState<string[]>([]);
  const [newClaimInput, setNewClaimInput] = useState("");

  // Packaging config local states
  const [packagingConfig, setPackagingConfig] = useState<PackagingConfig>(DEFAULT_PACKAGING_CONFIG);
  const [isEditingPackaging, setIsEditingPackaging] = useState(false);
  const [editedPackagingConfig, setEditedPackagingConfig] = useState<PackagingConfig>(DEFAULT_PACKAGING_CONFIG);

  // 1. Fetch manufacturers subcollection in real-time
  useEffect(() => {
    if (!currentProjectId) return;
    const manufacturersCol = collection(db, "projects", currentProjectId, "manufacturers");
    const unsubscribe = onSnapshot(manufacturersCol, async (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      
      list.sort((a, b) => a.name.localeCompare(b.name));
      setManufacturers(list);
      setSelectedManufacturerId(previous => list.some(item => item.id === previous) ? previous : list[0]?.id || "");
    });
    return () => unsubscribe();
  }, [currentProjectId]);

  // 2. Fetch specific manufacturer vaultDetails dynamically in real-time
  useEffect(() => {
    if (!currentProjectId || !selectedManufacturerId) {
      setVaultDetails(null);
      return;
    }
    const docRef = doc(db, "projects", currentProjectId, "manufacturers", selectedManufacturerId);
    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.vaultDetails) {
          // Eksik bölümlü eski kayıtlar ekranı çökertmesin diye güvenli varsayılanlarla tamamlanır.
          setVaultDetails(normalizeVaultDetails(data.vaultDetails));
        } else {
          setVaultDetails(null);
        }
      } else {
        setVaultDetails(null);
      }
    });
    return () => unsub();
  }, [currentProjectId, selectedManufacturerId]);

  // 3. Fetch project packaging_config in real-time
  useEffect(() => {
    if (!currentProjectId) return;
    const projectRef = doc(db, "projects", currentProjectId);
    const unsub = onSnapshot(projectRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.packaging_config) {
          setPackagingConfig(data.packaging_config as PackagingConfig);
        } else {
          setPackagingConfig(DEFAULT_PACKAGING_CONFIG);
        }
      }
    });
    return () => unsub();
  }, [currentProjectId]);

  const handleStartPackagingEdit = () => {
    setEditedPackagingConfig({ ...packagingConfig });
    setIsEditingPackaging(true);
  };

  const handleCancelPackagingEdit = () => {
    setIsEditingPackaging(false);
    setEditedPackagingConfig(DEFAULT_PACKAGING_CONFIG);
  };

  const handleSavePackagingConfig = async () => {
    if (!currentProjectId) return;
    try {
      const projectRef = doc(db, "projects", currentProjectId);
      await updateDoc(projectRef, {
        packaging_config: editedPackagingConfig
      });
      setPackagingConfig(editedPackagingConfig);
      setIsEditingPackaging(false);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3000);
    } catch (err) {
      console.error("Failed to save project packaging config:", err);
    }
  };

  const details: ProjectVaultDetails = vaultDetails || emptyVaultDetails();

  const handleStartEdit = () => {
    setEditedDetails({
      ...details,
      productClaims: details.productClaims || []
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedDetails(null);
  };

  const handleSaveDetails = async () => {
    if (!editedDetails || !selectedManufacturerId) return;
    setSavingDetails(true);
    try {
      const docRef = doc(db, "projects", currentProjectId, "manufacturers", selectedManufacturerId);
      await setDoc(docRef, { vaultDetails: editedDetails }, { merge: true });
      setVaultDetails(editedDetails);
      setIsEditing(false);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3000);
    } catch (err) {
      console.error("Failed to save project manufacturer details:", err);
    } finally {
      setSavingDetails(false);
    }
  };

  const handleAddManufacturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newManufacturerName.trim()) return;
    
    try {
      const manufacturersCol = collection(db, "projects", currentProjectId, "manufacturers");
      const newDocRef = doc(manufacturersCol);
      const newId = newDocRef.id;
      const initialDetails: ProjectVaultDetails = {
        pricingCapacity: { exwPriceList: "", moq: "", monthlyCapacity: "" },
        productionTransit: { productionFirstOrder: "", productionRepeatOrder: "", shipmentTransitTime: "" },
        storageShelfLife: { frozenProducts: "", ambientProducts: "" },
        certifications: { coa: "", certificates: [] },
        palletContainerConfig: { boxDimensions: "", palletConfig: "", containerCapacity40HC: "" },
        nutritionalValues: { energy: "", fat: "", fatSaturated: "", carbohydrates: "", sugar: "", protein: "", fiber: "", salt: "" },
        variations: [],
        marketingSamples: "",
        exportMarkets: []
      };
      
      await setDoc(newDocRef, {
        id: newId,
        name: newManufacturerName.trim(),
        vaultDetails: initialDetails
      });
      
      setSelectedManufacturerId(newId);
      setNewManufacturerName("");
      setIsAddingManufacturer(false);
    } catch (err) {
      console.error("Failed to add manufacturer:", err);
    }
  };

  const handleStartEditManufacturerName = () => {
    const activeMan = manufacturers.find((m) => m.id === selectedManufacturerId);
    if (activeMan) {
      setEditedManufacturerName(activeMan.name);
      setIsEditingManufacturerName(true);
    }
  };

  const handleSaveManufacturerName = async () => {
    if (!editedManufacturerName.trim() || !selectedManufacturerId) return;
    try {
      const docRef = doc(db, "projects", currentProjectId, "manufacturers", selectedManufacturerId);
      await setDoc(docRef, { name: editedManufacturerName.trim() }, { merge: true });
      setIsEditingManufacturerName(false);
    } catch (err) {
      console.error("Failed to save manufacturer name:", err);
    }
  };

  const handleCancelEditManufacturerName = () => {
    setIsEditingManufacturerName(false);
    setEditedManufacturerName("");
  };

  const handleStartEditClaims = () => {
    setEditedClaims(details.productClaims || []);
    setIsEditingClaims(true);
  };

  const handleRemoveClaimTag = (claimToRemove: string) => {
    setEditedClaims(editedClaims.filter(c => c !== claimToRemove));
  };

  const handleClaimInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = newClaimInput.trim();
      if (trimmed) {
        const parsed = trimmed.split(",").map(c => c.trim()).filter(Boolean);
        const updated = [...editedClaims];
        parsed.forEach(c => {
          if (!updated.includes(c)) {
            updated.push(c);
          }
        });
        setEditedClaims(updated);
        setNewClaimInput("");
      }
    }
  };

  const handleSaveClaims = async () => {
    if (!selectedManufacturerId || !currentProjectId) return;
    setSavingDetails(true);
    try {
      let finalClaims = [...editedClaims];
      if (newClaimInput.trim()) {
        const parsed = newClaimInput.split(",").map(c => c.trim()).filter(Boolean);
        parsed.forEach(c => {
          if (!finalClaims.includes(c)) {
            finalClaims.push(c);
          }
        });
      }

      const docRef = doc(db, "projects", currentProjectId, "manufacturers", selectedManufacturerId);
      await updateDoc(docRef, {
        "vaultDetails.productClaims": finalClaims
      });

      // Update local state immediately for instant feedback
      setVaultDetails(prev => {
        if (!prev) return null;
        return {
          ...prev,
          productClaims: finalClaims
        };
      });

      setIsEditingClaims(false);
      setNewClaimInput("");
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3000);
    } catch (err) {
      console.error("Failed to save product claims:", err);
    } finally {
      setSavingDetails(false);
    }
  };

  const handleDeleteManufacturer = async () => {
    if (!selectedManufacturerId || !currentProjectId) return;
    try {
      const docRef = doc(db, "projects", currentProjectId, "manufacturers", selectedManufacturerId);
      await deleteDoc(docRef);
      
      const remaining = manufacturers.filter((m) => m.id !== selectedManufacturerId);
      if (remaining.length > 0) {
        setSelectedManufacturerId(remaining[0].id);
      } else {
        setSelectedManufacturerId("");
      }
      
      setIsConfirmingDelete(false);
    } catch (err) {
      console.error("Failed to delete manufacturer:", err);
    }
  };


  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Shared active Google OAuth token
  const [authState, setAuthState] = useState<{
    accessToken: string | null;
    email: string | null;
    picture: string | null;
  }>({ accessToken: null, email: null, picture: null });

  useEffect(() => {
    const unsubscribe = subscribeDriveAuth((authData) => {
      setAuthState(authData);
    });
    return unsubscribe;
  }, []);

  // Fetch drive documents from Firestore for this project context
  useEffect(() => {
    setLoadingFiles(true);
    const q = query(
      collection(db, "driveFiles"),
      where("projectId", "==", currentProjectId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFiles(snapshot.docs.map(docSnapshot => ({...docSnapshot.data(),documentId:docSnapshot.id} as DriveFile)));
      setLoadingFiles(false);
    }, (err) => {
      console.error("Failed to fetch vault documents:", err);
      setLoadingFiles(false);
    });
    return unsubscribe;
  }, [currentProjectId]);

  // Google OAuth Auth trigger
  const handleConnectGoogle = async () => {
    try {
      const response = await apiFetch("/api/auth/google-url");
      if (!response.ok) {
        throw new Error(v.documents.authLinkFailed);
      }
      const { url } = await response.json();
      const width = 580;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        url,
        "google_drive_oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );

      if (!popup) {
        alert(v.documents.popupBlocked);
      }
    } catch (err: any) {
      console.error("Auth trigger failed:", err);
      alert(v.documents.authFailed(err.message));
    }
  };

  const handleDisconnectGoogle = () => {
    setDriveAuth(null, null, null);
  };

  // Upload handler via proxy server
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    if (!authState.accessToken) {
      alert(v.documents.connectFirst);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", rawFile);
    formData.append("folderName", `${currentProjectId} Belge Kasası`);
    formData.append("projectId", currentProjectId);
    formData.append("stepId", "project_vault");

    try {
      const response = await apiFetch("/api/drive/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authState.accessToken}`
        },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || v.documents.uploadStatus(response.status));
      }

      const result = await response.json();

      let fileType: DriveFile["fileType"] = "PDF";
      if (rawFile.name.endsWith(".xls") || rawFile.name.endsWith(".xlsx")) {
        fileType = "RFQ Sheet";
      } else if (rawFile.name.match(/\.(jpg|jpeg|png)$/i)) {
        fileType = "Image";
      }

      const newFile: DriveFile = {
        stepId: "project_vault",
        folderName: `${currentProjectId} Belge Kasası`,
        projectId: currentProjectId,
        fileName: result.fileName,
        fileType: fileType,
        downloadUrl: result.downloadUrl,
        fileSize: result.fileSize,
        dateAdded: result.dateAdded,
        fileId: result.fileId,
        assignedTo: auth.currentUser?.uid || "owner_admin",
        userId: auth.currentUser?.uid || "owner_admin"
      };

      const docId = `${currentProjectId}_vault_${result.fileId}`;
      await setDoc(doc(db, "driveFiles", docId), newFile);

    } catch (err: any) {
      console.error("Vault upload failed:", err);
      setUploadError(err.message || v.documents.uploadFailed);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteFile = async (file: DriveFile) => {
    if (!confirm(v.documents.deleteConfirm(file.fileName))) return;
    try {
      const docId = file.documentId || `${currentProjectId}_vault_${file.fileName.replace(/\s+/g, "_")}`;
      await deleteDoc(doc(db, "driveFiles", docId));
    } catch (err) {
      console.error("Document delete failed:", err);
      alert(v.documents.deleteFailed);
    }
  };

  const getProjectName = (projectId: string) => {
    const globalNames = (window as any).PROJECT_NAMES || JSON.parse(localStorage.getItem("t2t_project_names") || "{}");
    return globalNames[projectId] || PROJECT_NAMES[projectId] || projectId;
  };

  return (
    <div className="space-y-6"><fieldset disabled={readOnly} className="space-y-6">
      
      {/* 1. VAULT TOP HEADER */}
      <div className="bg-[#0B1221] border border-blue-900/30 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        {/* Background glow overlay */}
        <div className="absolute top-[-50%] right-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-xs font-black tracking-widest text-cyan-400 uppercase font-mono">
              Trade2Turkey Cloud Storage
            </h3>
          </div>
          <h2 lang={dataLang(getProjectName(currentProjectId))} className="text-xl font-black text-white font-display uppercase tracking-wide">
            {v.title(getProjectName(currentProjectId))}
          </h2>
          <p className="text-[11px] text-slate-300 font-mono leading-relaxed max-w-xl">
            {v.subtitle}
          </p>
        </div>

        {/* Google Drive Auth Area */}
        <div className="flex items-center gap-4 bg-blue-950/80 border border-blue-900/30 p-4 rounded-2xl md:self-center shrink-0">
          {authState.accessToken ? (
            <div className="flex items-center gap-3">
              {authState.picture ? (
                <img src={authState.picture} alt={v.googleUser} className="w-8 h-8 rounded-full border border-cyan-500/40" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-mono font-bold text-cyan-400 text-xs">
                  G
                </div>
              )}
              <div className="text-left">
                <span className="block text-[9px] text-cyan-400 font-black font-mono tracking-wider uppercase leading-none">{v.connected}</span>
                <span className="block text-xs font-bold text-white truncate max-w-[150px] leading-tight mt-1">{authState.email}</span>
              </div>
              <button 
                onClick={handleDisconnectGoogle}
                className="p-1.5 rounded-lg border border-blue-900/30 hover:border-red-500/30 hover:bg-red-500/10 text-slate-300 hover:text-red-400 transition cursor-pointer"
                title={v.disconnect}
              >
                <Unlink className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              className="bg-navy hover:bg-navy-light text-white text-xs font-black px-4 py-2.5 rounded-xl border border-navy/20 flex items-center gap-2 transition cursor-pointer select-none"
            >
              <Link2 className="h-4 w-4 text-cyan-400" />
              <span>{v.connect}</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Success Toast */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-[150] bg-emerald-500 text-slate-950 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-bold text-xs animate-bounce font-mono">
          <CheckCircle className="h-4 w-4 text-slate-955" />
          {v.savedToast}
        </div>
      )}

      {/* ÜRETİCİ TABS NAVIGATION */}
      <div className="bg-[#0B1221] border border-blue-900/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
            {v.manufacturers}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-1 md:flex-initial">
          {manufacturers.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                if (isEditing) {
                  if (confirm(v.unsavedSwitch)) {
                    setIsEditing(false);
                    setSelectedManufacturerId(m.id);
                  }
                } else {
                  setSelectedManufacturerId(m.id);
                }
              }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer font-mono border ${
                selectedManufacturerId === m.id
                  ? "bg-teal-500 text-slate-950 border-teal-400"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              {m.name}
            </button>
          ))}
          
          <button
            onClick={() => setIsAddingManufacturer(true)}
            className="px-4 py-2 bg-blue-950/80 hover:bg-blue-900 border border-blue-800/40 text-cyan-400 hover:text-cyan-300 text-xs font-bold rounded-xl cursor-pointer transition shadow-sm font-mono flex items-center gap-1.5"
          >
            <span>{v.addManufacturerButton}</span>
          </button>
        </div>
      </div>

      {/* Specification Section Header with Edit Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-[#0B1221] border border-blue-900/30 px-6 py-4 rounded-2xl shadow-xl gap-4">
        <div className="space-y-1 flex-1">
          <h3 className="text-[10px] font-black tracking-widest text-cyan-400 font-mono uppercase leading-none">
            {v.specDetails}
          </h3>
          
          {/* Active Manufacturer Name with Edit Mode */}
          {!isEditingManufacturerName ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-black text-white font-display">
                {manufacturers.find(m => m.id === selectedManufacturerId)?.name || v.noManufacturerSelected}
              </span>
              <button
                disabled={!selectedManufacturerId} onClick={handleStartEditManufacturerName}
                className="text-[9px] font-bold text-slate-400 hover:text-cyan-400 transition cursor-pointer font-mono px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-md"
              >
                {v.editName}
              </button>
              {selectedManufacturerId && (
                <button
                  onClick={() => setIsConfirmingDelete(true)}
                  className="text-[9px] font-bold text-red-400 hover:text-red-305 transition cursor-pointer font-mono px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-md flex items-center gap-1"
                  title={v.deleteManufacturer}
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{v.deleteManufacturer}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={editedManufacturerName}
                onChange={(e) => setEditedManufacturerName(e.target.value)}
                className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition font-bold"
              />
              <button
                onClick={handleSaveManufacturerName}
                className="px-2 py-1 bg-teal-500 hover:bg-teal-650 text-slate-955 text-[10px] font-bold rounded-lg cursor-pointer transition font-mono"
              >
                {v.save}
              </button>
              <button
                onClick={handleCancelEditManufacturerName}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg cursor-pointer transition border border-slate-750 font-mono"
              >
                {v.cancel}
              </button>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          {!isEditing ? (
            <button
              disabled={!selectedManufacturerId} onClick={handleStartEdit}
              className="px-4 py-2 bg-blue-650 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-sm font-mono uppercase"
            >
              {v.edit}
            </button>
          ) : (
            <>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition border border-slate-750 font-mono uppercase"
              >
                {v.cancel}
              </button>
              <button
                onClick={handleSaveDetails}
                disabled={savingDetails}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-650 disabled:opacity-50 text-slate-955 text-xs font-bold rounded-xl cursor-pointer transition shadow-sm font-mono uppercase"
              >
                {savingDetails ? v.saving : v.save}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. SPECIFICATION CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Card 1: Fiyatlandırma & Kapasite */}
        <div className="bg-[#0B1221] border border-blue-900/30 p-5 rounded-2xl hover:border-blue-800/40 shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-blue-900/20">
              <h4 className="text-xs font-bold text-white tracking-wide font-mono uppercase flex items-center gap-2">
                <Coins className="h-4 w-4 text-white" />
                {v.sections.pricing}
              </h4>
            </div>
            {isEditing && editedDetails ? (
              <div className="space-y-3 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.exwPriceListLink}</label>
                  <input
                    type="text"
                    value={editedDetails.pricingCapacity.exwPriceList}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      pricingCapacity: { ...editedDetails.pricingCapacity, exwPriceList: e.target.value }
                    })}
                    placeholder={f.driveLinkPlaceholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.moq}</label>
                  <input
                    type="text"
                    value={editedDetails.pricingCapacity.moq}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      pricingCapacity: { ...editedDetails.pricingCapacity, moq: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.monthlyCapacity}</label>
                  <input
                    type="text"
                    value={editedDetails.pricingCapacity.monthlyCapacity}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      pricingCapacity: { ...editedDetails.pricingCapacity, monthlyCapacity: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-4 text-xs">
                <div>
                  <span className="text-slate-300 block font-semibold">{f.exwPriceList}</span>
                  {details.pricingCapacity.exwPriceList && details.pricingCapacity.exwPriceList.startsWith("http") ? (
                    <a href={details.pricingCapacity.exwPriceList} target="_blank" rel="noopener noreferrer" className="text-cyan-400 font-bold hover:underline block mt-1 font-mono truncate">
                      {f.viewPriceList}
                    </a>
                  ) : (
                    <span className="text-white font-bold block mt-1 font-mono">{shown(details.pricingCapacity.exwPriceList)}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">{f.moq}</span>
                  <span className="text-white font-bold block mt-1">{shown(details.pricingCapacity.moq)}</span>
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">{f.monthlyCapacity}</span>
                  <span className="text-cyan-400 font-bold block mt-1">{shown(details.pricingCapacity.monthlyCapacity)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Üretim ve Sevkiyat Süreleri */}
        <div className="bg-[#0B1221] border border-blue-900/30 p-5 rounded-2xl hover:border-blue-800/40 shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-blue-900/20">
              <h4 className="text-xs font-bold text-white tracking-wide font-mono uppercase flex items-center gap-2">
                <Clock className="h-4 w-4 text-white" />
                {v.sections.production}
              </h4>
            </div>
            {isEditing && editedDetails ? (
              <div className="space-y-3 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.firstOrder}</label>
                  <input
                    type="text"
                    value={editedDetails.productionTransit.productionFirstOrder}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      productionTransit: { ...editedDetails.productionTransit, productionFirstOrder: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.repeatOrder}</label>
                  <input
                    type="text"
                    value={editedDetails.productionTransit.productionRepeatOrder}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      productionTransit: { ...editedDetails.productionTransit, productionRepeatOrder: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.transit}</label>
                  <input
                    type="text"
                    value={editedDetails.productionTransit.shipmentTransitTime}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      productionTransit: { ...editedDetails.productionTransit, shipmentTransitTime: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-4 text-xs">
                <div>
                  <span className="text-slate-300 block font-semibold">{f.firstOrder}</span>
                  <span className="text-white font-bold block mt-1">{shown(details.productionTransit.productionFirstOrder)}</span>
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">{f.repeatOrder}</span>
                  <span className="text-white font-bold block mt-1">{shown(details.productionTransit.productionRepeatOrder)}</span>
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">{f.transit}</span>
                  <span className="text-cyan-400 font-bold block mt-1 font-mono">{shown(details.productionTransit.shipmentTransitTime)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Depolama ve Raf Ömrü */}
        <div className="bg-[#0B1221] border border-blue-900/30 p-5 rounded-2xl hover:border-blue-800/40 shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-blue-900/20">
              <h4 className="text-xs font-bold text-white tracking-wide font-mono uppercase flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-white" />
                {v.sections.storage}
              </h4>
            </div>
            {isEditing && editedDetails ? (
              <div className="space-y-3 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.frozen}</label>
                  <input
                    type="text"
                    value={editedDetails.storageShelfLife.frozenProducts}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      storageShelfLife: { ...editedDetails.storageShelfLife, frozenProducts: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.ambient}</label>
                  <input
                    type="text"
                    value={editedDetails.storageShelfLife.ambientProducts}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      storageShelfLife: { ...editedDetails.storageShelfLife, ambientProducts: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-4 text-xs">
                <div>
                  <span className="text-slate-300 block font-semibold">{f.frozen}</span>
                  <span className="text-cyan-400 font-bold block mt-1 font-mono">{shown(details.storageShelfLife.frozenProducts)}</span>
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">{f.ambient}</span>
                  <span className="text-white font-bold block mt-1 font-mono">{shown(details.storageShelfLife.ambientProducts)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Sertifikalar ve Analizler */}
        <div className="bg-[#0B1221] border border-blue-900/30 p-5 rounded-2xl hover:border-blue-800/40 shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-blue-900/20">
              <h4 className="text-xs font-bold text-white tracking-wide font-mono uppercase flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-white" />
                {v.sections.certifications}
              </h4>
            </div>
            {isEditing && editedDetails ? (
              <div className="space-y-3 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.coa}</label>
                  <input
                    type="text"
                    value={editedDetails.certifications.coa}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      certifications: { ...editedDetails.certifications, coa: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.certificates}</label>
                  <input
                    type="text"
                    value={editedDetails.certifications.certificates.join(", ")}
                    onChange={(e) => {
                      const list = e.target.value.split(",").map(c => c.trim()).filter(Boolean);
                      setEditedDetails({
                        ...editedDetails,
                        certifications: { ...editedDetails.certifications, certificates: list }
                      });
                    }}
                    placeholder={f.certificatesPlaceholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {editedDetails.certifications.certificates.map((cert, index) => (
                      <span key={index} lang={dataLang(cert)} className="px-2 py-0.5 text-[9px] font-bold font-mono bg-teal-500/10 border border-teal-500/25 text-teal-400 rounded-md uppercase">
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-4 text-xs">
                <div>
                  <span className="text-slate-300 block font-semibold">{f.coa}</span>
                  <span className="text-white font-bold block mt-1 font-mono">{shown(details.certifications.coa)}</span>
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">{f.certificates}</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {details.certifications.certificates && details.certifications.certificates.length > 0 ? (
                      details.certifications.certificates.map((cert, index) => (
                        <span key={index} lang={dataLang(cert)} className="px-2.5 py-1 text-[10px] font-black font-mono uppercase bg-blue-900/40 border border-blue-850/50 text-cyan-400 rounded-lg">
                          {cert}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 italic">{f.noCertificates}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 5: Ürün ve Paketleme Konfigürasyonu */}
        <div className="bg-[#0B1221] border border-blue-900/30 p-5 rounded-2xl hover:border-blue-800/40 shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-blue-900/20">
              <h4 className="text-xs font-bold text-white tracking-wide font-mono uppercase flex items-center gap-2">
                <Layers className="h-4 w-4 text-white" />
                {v.sections.packaging}
              </h4>
              <div className="flex items-center gap-2">
                {isEditingPackaging ? (
                  <>
                    <button
                      onClick={handleSavePackagingConfig}
                      className="p-1 text-teal-400 hover:text-teal-300 rounded hover:bg-slate-800 transition cursor-pointer"
                      title={v.save}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleCancelPackagingEdit}
                      className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-slate-800 transition cursor-pointer"
                      title={v.cancel}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    disabled={!selectedManufacturerId} onClick={handleStartPackagingEdit}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
                    title={v.edit}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {isEditingPackaging ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-[11px]">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.productVariant}</label>
                  <input
                    type="text"
                    value={editedPackagingConfig.productVariant || ""}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, productVariant: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.singleWeight}</label>
                  <input
                    type="number"
                    step="0.001"
                    value={editedPackagingConfig.singleWeight === undefined ? "" : editedPackagingConfig.singleWeight}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, singleWeight: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.packagingStyle}</label>
                  <input
                    type="text"
                    value={editedPackagingConfig.packagingStyle || ""}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, packagingStyle: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.innerBoxCount}</label>
                  <input
                    type="number"
                    value={editedPackagingConfig.innerBoxCount === undefined ? "" : editedPackagingConfig.innerBoxCount}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, innerBoxCount: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.masterCartonCount}</label>
                  <input
                    type="number"
                    value={editedPackagingConfig.masterCartonCount === undefined ? "" : editedPackagingConfig.masterCartonCount}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, masterCartonCount: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.palletCartonCount}</label>
                  <input
                    type="number"
                    value={editedPackagingConfig.palletCartonCount === undefined ? "" : editedPackagingConfig.palletCartonCount}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, palletCartonCount: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.cartonNetWeight}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editedPackagingConfig.cartonNetWeight === undefined ? "" : editedPackagingConfig.cartonNetWeight}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, cartonNetWeight: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.cartonGrossWeight}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editedPackagingConfig.cartonGrossWeight === undefined ? "" : editedPackagingConfig.cartonGrossWeight}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, cartonGrossWeight: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.cartonDimensions}</label>
                  <input
                    type="text"
                    value={editedPackagingConfig.cartonDimensions || ""}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, cartonDimensions: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.totalGrossWeight}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editedPackagingConfig.totalGrossWeight === undefined ? "" : editedPackagingConfig.totalGrossWeight}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, totalGrossWeight: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5 mt-4 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-medium">{f.productVariant}</span>
                  <span className="text-white font-semibold block mt-0.5">{packagingConfig.productVariant || v.notSpecified}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">{f.singleWeight}</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.singleWeight !== undefined && packagingConfig.singleWeight !== 0 ? `${packagingConfig.singleWeight} ${v.units.kg}` : v.notSpecified}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">{f.packagingStyle}</span>
                  <span className="text-white font-semibold block mt-0.5">{packagingConfig.packagingStyle || v.notSpecified}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">{f.innerBoxCount}</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.innerBoxCount !== undefined && packagingConfig.innerBoxCount !== 0 ? `${packagingConfig.innerBoxCount} ${v.units.pieces}` : v.notSpecified}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">{f.masterCartonCount}</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.masterCartonCount !== undefined && packagingConfig.masterCartonCount !== 0 ? `${packagingConfig.masterCartonCount} ${v.units.pieces}` : v.notSpecified}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">{f.palletCartonCount}</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.palletCartonCount !== undefined && packagingConfig.palletCartonCount !== 0 ? `${packagingConfig.palletCartonCount} ${v.units.cartons}` : v.notSpecified}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">{f.cartonNetWeight}</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.cartonNetWeight !== undefined && packagingConfig.cartonNetWeight !== 0 ? `${packagingConfig.cartonNetWeight} ${v.units.kg}` : v.notSpecified}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">{f.cartonGrossWeight}</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.cartonGrossWeight !== undefined && packagingConfig.cartonGrossWeight !== 0 ? `${packagingConfig.cartonGrossWeight} ${v.units.kg}` : v.notSpecified}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">{f.cartonDimensions}</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">{packagingConfig.cartonDimensions || v.notSpecified}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">{f.totalGrossWeight}</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.totalGrossWeight !== undefined && packagingConfig.totalGrossWeight !== 0 ? `${packagingConfig.totalGrossWeight} ${v.units.kg}` : v.notSpecified}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 6: Ürün Çeşitleri ve Numuneler */}
        <div className="bg-[#0B1221] border border-blue-900/30 p-5 rounded-2xl hover:border-blue-800/40 shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-blue-900/20">
              <h4 className="text-xs font-bold text-white tracking-wide font-mono uppercase flex items-center gap-2">
                <FileText className="h-4 w-4 text-white" />
                {v.sections.marketing}
              </h4>
            </div>
            {isEditing && editedDetails ? (
              <div className="space-y-3 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.variations}</label>
                  <textarea
                    value={editedDetails.variations.join("\n")}
                    onChange={(e) => {
                      const list = e.target.value.split("\n").map(l => l.trim()).filter(Boolean);
                      setEditedDetails({
                        ...editedDetails,
                        variations: list
                      });
                    }}
                    placeholder={f.variationsPlaceholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500 h-20 resize-none font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.marketingSamples}</label>
                  <textarea
                    value={editedDetails.marketingSamples}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      marketingSamples: e.target.value
                    })}
                    placeholder={f.marketingPlaceholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500 h-20 resize-none font-sans"
                  />
                </div>
                
                {/* Product claims under global edit mode */}
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">{f.claims}</label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800 border border-slate-700 rounded-xl min-h-[40px]">
                    {(editedDetails.productClaims || []).map((claim, index) => (
                      <span key={index} className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold font-mono bg-teal-500/10 border border-teal-500/25 text-teal-400 rounded-md uppercase">
                        <span lang={dataLang(claim)}>{claim}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (editedDetails.productClaims || []).filter(c => c !== claim);
                            setEditedDetails({
                              ...editedDetails,
                              productClaims: updated
                            });
                          }}
                          className="text-red-400 hover:text-red-305 font-bold ml-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder={f.claimPlaceholder}
                      value={newClaimInput}
                      onChange={(e) => setNewClaimInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const trimmed = newClaimInput.trim();
                          if (trimmed && !(editedDetails.productClaims || []).includes(trimmed)) {
                            setEditedDetails({
                              ...editedDetails,
                              productClaims: [...(editedDetails.productClaims || []), trimmed]
                            });
                            setNewClaimInput("");
                          }
                        }
                      }}
                      className="bg-transparent text-white text-xs placeholder:text-slate-500 focus:outline-none flex-1 min-w-[120px]"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-4 text-xs">
                <div>
                  <span className="text-slate-300 block font-semibold">{f.variations}</span>
                  <div className="space-y-1 mt-1">
                    {details.variations && details.variations.length > 0 ? (
                      details.variations.map((v, index) => (
                        <div key={index} className="text-white font-semibold">• {v}</div>
                      ))
                    ) : (
                      <span className="text-slate-500 italic">{f.noVariations}</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">{f.marketingSamples}</span>
                  <span className="text-white font-bold block mt-1 leading-relaxed">{shown(details.marketingSamples)}</span>
                </div>
                
                {/* Product Claims View & Local Inline Edit Area */}
                <div className="pt-3 border-t border-blue-900/20">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold block">{f.claims}</span>
                    {!isEditingClaims && (
                      <button
                        disabled={!selectedManufacturerId} onClick={handleStartEditClaims}
                        className="text-slate-400 hover:text-cyan-400 transition p-1 cursor-pointer"
                        title={f.editClaims}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  
                  {isEditingClaims ? (
                    <div className="space-y-2 mt-2">
                      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800 border border-slate-700 rounded-xl min-h-[40px]">
                        {editedClaims.map((claim, index) => (
                          <span key={index} className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black font-mono uppercase bg-blue-900/40 border border-blue-850/50 text-cyan-400 rounded-lg">
                            <span lang={dataLang(claim)}>{claim}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveClaimTag(claim)}
                              className="text-red-400 hover:text-red-305 font-bold ml-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          placeholder={f.claimPlaceholder}
                          value={newClaimInput}
                          onChange={(e) => setNewClaimInput(e.target.value)}
                          onKeyDown={handleClaimInputKeyDown}
                          className="bg-transparent text-white text-xs placeholder:text-slate-500 focus:outline-none flex-1 min-w-[120px]"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsEditingClaims(false)}
                          className="p-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
                          title={v.cancel}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveClaims}
                          className="p-1 bg-teal-500 hover:bg-teal-650 text-slate-955 rounded-lg transition cursor-pointer"
                          title={v.save}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {details.productClaims && details.productClaims.length > 0 ? (
                        details.productClaims.map((claim, index) => (
                          <span key={index} lang={dataLang(claim)} className="px-2.5 py-1 text-[10px] font-black font-mono uppercase bg-blue-900/40 border border-blue-850/50 text-cyan-400 rounded-lg">
                            {claim}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">{f.noClaims}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 3. NUTRITIONAL VALUES & EXPORT MARKETS SPLIT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 7: Nutritional Values */}
        <div className="bg-[#0B1221] border border-blue-900/30 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-blue-900/20">
              <h4 className="text-xs font-bold text-white tracking-wide font-mono uppercase flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-white animate-pulse" />
                {v.sections.nutrition}
              </h4>
              <span className="text-[10px] text-blue-100 font-mono font-bold uppercase bg-blue-950 px-2 py-0.5 rounded-lg border border-blue-900/30">
                {v.sections.nutritionBadge}
              </span>
            </div>

            {isEditing && editedDetails ? (
              <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase block">{f.energyLabel}</label>
                  <input
                    type="text"
                    value={editedDetails.nutritionalValues.energy}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      nutritionalValues: { ...editedDetails.nutritionalValues, energy: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase block">{f.fatSaturated}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={f.fatPlaceholder}
                      value={editedDetails.nutritionalValues.fat}
                      onChange={(e) => setEditedDetails({
                        ...editedDetails,
                        nutritionalValues: { ...editedDetails.nutritionalValues, fat: e.target.value }
                      })}
                      className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder={f.saturatedPlaceholder}
                      value={editedDetails.nutritionalValues.fatSaturated}
                      onChange={(e) => setEditedDetails({
                        ...editedDetails,
                        nutritionalValues: { ...editedDetails.nutritionalValues, fatSaturated: e.target.value }
                      })}
                      className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase block">{f.carbsSugar}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={f.carbsPlaceholder}
                      value={editedDetails.nutritionalValues.carbohydrates}
                      onChange={(e) => setEditedDetails({
                        ...editedDetails,
                        nutritionalValues: { ...editedDetails.nutritionalValues, carbohydrates: e.target.value }
                      })}
                      className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder={f.sugarPlaceholder}
                      value={editedDetails.nutritionalValues.sugar}
                      onChange={(e) => setEditedDetails({
                        ...editedDetails,
                        nutritionalValues: { ...editedDetails.nutritionalValues, sugar: e.target.value }
                      })}
                      className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase block">{f.proteinLabel}</label>
                  <input
                    type="text"
                    value={editedDetails.nutritionalValues.protein}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      nutritionalValues: { ...editedDetails.nutritionalValues, protein: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase block">{f.fiberSalt}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={f.fiberPlaceholder}
                      value={editedDetails.nutritionalValues.fiber}
                      onChange={(e) => setEditedDetails({
                        ...editedDetails,
                        nutritionalValues: { ...editedDetails.nutritionalValues, fiber: e.target.value }
                      })}
                      className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder={f.saltPlaceholder}
                      value={editedDetails.nutritionalValues.salt}
                      onChange={(e) => setEditedDetails({
                        ...editedDetails,
                        nutritionalValues: { ...editedDetails.nutritionalValues, salt: e.target.value }
                      })}
                      className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                <div className="bg-blue-950/50 p-3 rounded-xl border border-blue-900/30 flex flex-col justify-between">
                  <span className="text-slate-300 font-semibold">{f.energy}</span>
                  <strong className="text-white font-mono text-sm mt-1">{shown(details.nutritionalValues.energy)}</strong>
                </div>
                <div className="bg-blue-950/50 p-3 rounded-xl border border-blue-900/30 flex flex-col justify-between">
                  <span className="text-slate-300 font-semibold">{f.fatView(shown(details.nutritionalValues.fatSaturated))}</span>
                  <strong className="text-white font-mono text-sm mt-1">{shown(details.nutritionalValues.fat)}</strong>
                </div>
                <div className="bg-blue-950/50 p-3 rounded-xl border border-blue-900/30 flex flex-col justify-between">
                  <span className="text-slate-300 font-semibold">{f.carbsView(shown(details.nutritionalValues.sugar))}</span>
                  <strong className="text-white font-mono text-sm mt-1">{shown(details.nutritionalValues.carbohydrates)}</strong>
                </div>
                <div className="bg-blue-950/50 p-3 rounded-xl border border-blue-900/30 flex flex-col justify-between">
                  <span className="text-slate-300 font-semibold">{f.protein}</span>
                  <strong className="text-cyan-400 font-mono text-sm mt-1">{shown(details.nutritionalValues.protein)}</strong>
                </div>
                <div className="bg-blue-950/50 p-3 rounded-xl border border-blue-900/30 flex flex-col justify-between col-span-2 flex-row items-center">
                  <div>
                    <span className="text-slate-300 font-semibold block">{f.fiberSaltRatio}</span>
                    <div className="flex gap-4 mt-1 font-mono text-white text-xs">
                      <div>{f.fiber} <strong>{shown(details.nutritionalValues.fiber)}</strong></div>
                      <div>{f.salt} <strong>{shown(details.nutritionalValues.salt)}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 8: Export Markets */}
        <div className="bg-[#0B1221] border border-blue-900/30 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-blue-900/20">
              <h4 className="text-xs font-bold text-white tracking-wide font-mono uppercase flex items-center gap-2">
                <Globe className="h-4 w-4 text-white animate-spin-slow" />
                {v.sections.markets(details.exportMarkets ? details.exportMarkets.length : 0)}
              </h4>
            </div>

            {isEditing && editedDetails ? (
              <div className="space-y-2 mt-4 text-xs">
                <label className="text-slate-400 font-bold font-mono text-[9px] uppercase block">{f.exportMarkets}</label>
                <input
                  type="text"
                  value={editedDetails.exportMarkets.map(m => m.name).join(", ")}
                  onChange={(e) => {
                    const list = e.target.value.split(",").map(x => {
                      return marketFromName(x.trim());
                    }).filter(m => m.name);
                    setEditedDetails({
                      ...editedDetails,
                      exportMarkets: list
                    });
                  }}
                  placeholder={f.marketsPlaceholder}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {editedDetails.exportMarkets.map((item, index) => { const shownMarket = market(item); return (
                    <span key={index} className="px-2 py-0.5 text-[10px] font-bold bg-teal-500/10 border border-teal-500/25 text-teal-400 rounded-lg flex items-center gap-1">
                      <span>{shownMarket.flag}</span>
                      <span lang={shownMarket.isData ? dataLang(shownMarket.label) : undefined}>{shownMarket.label}</span>
                    </span>
                  ); })}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5 mt-5">
                {details.exportMarkets && details.exportMarkets.length > 0 ? (
                  details.exportMarkets.map((item, index) => { const shownMarket = market(item); return (
                    <span 
                      key={index} 
                      title={shownMarket.isData ? undefined : item.name}
                      className="px-3 py-1.5 text-xs font-bold bg-blue-900/40 border border-blue-800/40 text-blue-100 rounded-xl flex items-center gap-1.5 hover:bg-blue-900/60 hover:border-blue-700/60 transition"
                    >
                      <span className="text-sm select-none">{shownMarket.flag}</span>
                      <span lang={shownMarket.isData ? dataLang(shownMarket.label) : undefined}>{shownMarket.label}</span>
                    </span>
                  ); })
                ) : (
                  <span className="text-slate-500 italic text-xs">{f.noMarkets}</span>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 4. REAL-TIME STORAGE / GOOGLE DRIVE DOCUMENT VAULT LIST */}
      <div className="bg-[#0B1221] border border-blue-900/30 p-6 rounded-2xl shadow-xl relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-blue-900/20 gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-white tracking-wide font-mono uppercase flex items-center gap-2">
              <Database className="h-4 w-4 text-white" />
              {v.documents.title}
            </h4>
            <p className="text-[10px] text-slate-300 font-mono">
              {v.documents.subtitle}
            </p>
          </div>

          {/* Upload triggers */}
          {authState.accessToken && (
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 hover:border-teal-500/50 text-teal-400 text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer select-none disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span>{isUploading ? v.documents.uploading : v.documents.add}</span>
              </button>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-100 text-[10px] font-mono p-3 rounded-xl mt-3">
            {v.documents.uploadError(uploadError)}
          </div>
        )}

        {/* Dynamic file list fetched from Firestore */}
        <div className="mt-4">
          {loadingFiles ? (
            <div className="flex items-center justify-center gap-2 text-slate-300 py-6 text-xs font-mono">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <span>{v.documents.loading}</span>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-blue-900/20 rounded-xl">
              <FileText className="h-8 w-8 text-slate-600 mx-auto opacity-40" />
              <span className="block text-slate-300 text-xs mt-2 font-semibold">{v.documents.empty}</span>
              {!authState.accessToken && (
                <span className="block text-blue-100 text-[10px] mt-1 font-mono">
                  {v.documents.connectHint}
                </span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {files.map((file, idx) => (
                <div 
                  key={idx}
                  className="bg-blue-950/50 border border-blue-900/30 p-3.5 rounded-xl flex items-center justify-between gap-4 hover:border-blue-800/40 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-900/40 border border-blue-850/50 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div className="text-left min-w-0">
                      <span className="block text-xs font-bold text-white truncate pr-2" title={file.fileName}>
                        {file.fileName}
                      </span>
                      <span className="block text-[9px] text-slate-300 font-mono mt-0.5 uppercase tracking-wider">
                        {file.fileSize} • {file.fileType}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {file.downloadUrl && file.downloadUrl !== "#" && (
                      <a 
                        href={safeHttps(file.downloadUrl) ? file.downloadUrl : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
                        title={v.documents.open}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button 
                      onClick={() => handleDeleteFile(file)}
                      className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-500 hover:text-red-400 transition cursor-pointer"
                      title={v.documents.remove}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* ADD MANUFACTURER OVERLAY MODAL */}
      {isAddingManufacturer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-white font-mono uppercase tracking-wide">
                {v.addModal.title}
              </h3>
              <p className="text-[10px] text-slate-455 font-sans">
                {v.addModal.text}
              </p>
            </div>
            
            <form onSubmit={handleAddManufacturer} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  {v.addModal.name}
                </label>
                <input
                  type="text"
                  required
                  placeholder={v.addModal.placeholder}
                  value={newManufacturerName}
                  onChange={(e) => setNewManufacturerName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 transition"
                  autoFocus
                />
              </div>
              
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingManufacturer(false);
                    setNewManufacturerName("");
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-750"
                >
                  {v.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-650 text-slate-955 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {v.addModal.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION OVERLAY MODAL */}
      {isConfirmingDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-red-500 font-mono uppercase tracking-wide flex items-center gap-1.5 leading-none">
                <Trash2 className="h-4 w-4" />
                {v.deleteManufacturer}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {v.deleteModal.text} <strong>{v.deleteModal.irreversible}</strong>
              </p>
            </div>
            
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-750 font-mono"
              >
                {v.deleteModal.cancel}
              </button>
              <button
                onClick={handleDeleteManufacturer}
                className="px-4 py-2 bg-red-650 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer font-mono"
              >
                {v.deleteModal.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

    </fieldset></div>
  );
}
