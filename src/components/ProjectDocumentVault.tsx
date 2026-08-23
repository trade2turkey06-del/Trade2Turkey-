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

interface ProjectDocumentVaultProps {
  currentProjectId: string;
}

// Structured Type for Project Details
export interface ProjectVaultDetails {
  pricingCapacity: {
    exwPriceList: string;
    moq: string;
    monthlyCapacity: string;
  };
  productionTransit: {
    productionFirstOrder: string;
    productionRepeatOrder: string;
    shipmentTransitTime: string;
  };
  storageShelfLife: {
    frozenProducts: string;
    ambientProducts: string;
  };
  certifications: {
    coa: string;
    certificates: string[];
  };
  palletContainerConfig: {
    boxDimensions: string;
    palletConfig: string;
    containerCapacity40HC: string;
  };
  nutritionalValues: {
    energy: string;
    fat: string;
    fatSaturated: string;
    carbohydrates: string;
    sugar: string;
    protein: string;
    fiber: string;
    salt: string;
  };
  variations: string[];
  marketingSamples: string;
  exportMarkets: { name: string; flag: string }[];
  productClaims?: string[];
}

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


export default function ProjectDocumentVault({ currentProjectId }: ProjectDocumentVaultProps) {
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
      
      if (list.length === 0) {
        // Seeding default manufacturer: "Bakker" for PROJE-UNLU MAMÜLLER, or "Default Üretici" for other projects
        const defaultName = currentProjectId === "PROJE-UNLU MAMÜLLER" ? "Bakker" : "Default Üretici";
        const defaultDocRef = doc(manufacturersCol, "seed_bakker");
        const seedDetails = DEFAULT_VAULT_DETAILS[currentProjectId] || {
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
        await setDoc(defaultDocRef, {
          id: "seed_bakker",
          name: defaultName,
          vaultDetails: seedDetails
        });
      } else {
        list.sort((a, b) => a.name.localeCompare(b.name));
        setManufacturers(list);
        
        // Auto-select the first one if selectedManufacturerId is empty or not in the list
        setSelectedManufacturerId((prev) => {
          if (!prev || !list.some((m) => m.id === prev)) {
            return list[0].id;
          }
          return prev;
        });
      }
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
          setVaultDetails(data.vaultDetails as ProjectVaultDetails);
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

  const details: ProjectVaultDetails = vaultDetails || DEFAULT_VAULT_DETAILS[currentProjectId] || {
    pricingCapacity: { exwPriceList: "", moq: "", monthlyCapacity: "" },
    productionTransit: { productionFirstOrder: "", productionRepeatOrder: "", shipmentTransitTime: "" },
    storageShelfLife: { frozenProducts: "", ambientProducts: "" },
    certifications: { coa: "", certificates: [] },
    palletContainerConfig: { boxDimensions: "", palletConfig: "", containerCapacity40HC: "" },
    nutritionalValues: { energy: "", fat: "", fatSaturated: "", carbohydrates: "", sugar: "", protein: "", fiber: "", salt: "" },
    variations: [],
    marketingSamples: "",
    exportMarkets: [],
    productClaims: []
  };

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

  const getFlag = (countryName: string) => {
    const lower = countryName.toLowerCase();
    if (lower.includes("almanya") || lower.includes("germany")) return "🇩🇪";
    if (lower.includes("hollanda") || lower.includes("netherland")) return "🇳🇱";
    if (lower.includes("türkiye") || lower.includes("turkey") || lower.includes("türk")) return "🇹🇷";
    if (lower.includes("fransa") || lower.includes("france")) return "🇫🇷";
    if (lower.includes("ingiltere") || lower.includes("uk") || lower.includes("united kingdom")) return "🇬🇧";
    if (lower.includes("abd") || lower.includes("usa") || lower.includes("amerika")) return "🇺🇸";
    if (lower.includes("kktc") || lower.includes("kıbrıs")) return "🇨🇾";
    if (lower.includes("gürcistan") || lower.includes("georgia")) return "🇬🇪";
    if (lower.includes("azerbaycan") || lower.includes("azerbaijan")) return "🇦🇿";
    if (lower.includes("irak") || lower.includes("iraq")) return "🇮🇶";
    if (lower.includes("bulgaristan") || lower.includes("bulgaria")) return "🇧🇬";
    if (lower.includes("kuveyt") || lower.includes("kuwait")) return "🇰🇼";
    if (lower.includes("italya") || lower.includes("italy")) return "🇮🇹";
    if (lower.includes("ispanya") || lower.includes("spain")) return "🇪🇸";
    if (lower.includes("ukrayna") || lower.includes("ukraine")) return "🇺🇦";
    if (lower.includes("suudi") || lower.includes("saudi")) return "🇸🇦";
    if (lower.includes("bae") || lower.includes("uae")) return "🇦🇪";
    if (lower.includes("katar") || lower.includes("qatar")) return "🇶🇦";
    if (lower.includes("bahreyn") || lower.includes("bahrain")) return "🇧🇭";
    return "🏳️";
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
      setFiles(snapshot.docs.map(docSnapshot => docSnapshot.data() as DriveFile));
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
      const response = await fetch("/api/auth/google-url");
      if (!response.ok) {
        throw new Error("Google yetkilendirme linki alınamadı.");
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
        alert("Açılır pencere engelleyicisi algılandı! Lütfen pencerelere izin verin.");
      }
    } catch (err: any) {
      console.error("Auth trigger failed:", err);
      alert(`Kimlik doğrulama başlatılamadı: ${err.message}`);
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
      alert("Lütfen önce Google Drive'a bağlanın.");
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
      const response = await fetch("/api/drive/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authState.accessToken}`
        },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Yükleme başarısız (Status: ${response.status})`);
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

      const docId = `${currentProjectId}_vault_${result.fileName.replace(/\s+/g, "_")}`;
      await setDoc(doc(db, "driveFiles", docId), newFile);

    } catch (err: any) {
      console.error("Vault upload failed:", err);
      setUploadError(err.message || "Dosya yüklenemedi.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteFile = async (file: DriveFile) => {
    if (!confirm(`"${file.fileName}" belgesini kasadan silmek istediğinize emin misiniz?`)) return;
    try {
      const docId = `${currentProjectId}_vault_${file.fileName.replace(/\s+/g, "_")}`;
      await deleteDoc(doc(db, "driveFiles", docId));
    } catch (err) {
      console.error("Document delete failed:", err);
      alert("Belge veritabanından silinemedi.");
    }
  };

  const getProjectName = (projectId: string) => {
    const globalNames = (window as any).PROJECT_NAMES || JSON.parse(localStorage.getItem("t2t_project_names") || "{}");
    return globalNames[projectId] || PROJECT_NAMES[projectId] || projectId;
  };

  return (
    <div className="space-y-6">
      
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
          <h2 className="text-xl font-black text-white font-display uppercase tracking-wide">
            {getProjectName(currentProjectId)} Kasası
          </h2>
          <p className="text-[11px] text-slate-300 font-mono leading-relaxed max-w-xl">
            Tedarik zinciri, lojistik paketleme ve resmi sertifikasyon dokümanlarının bulut depolama entegrasyonuyla güvenli yönetimi.
          </p>
        </div>

        {/* Google Drive Auth Area */}
        <div className="flex items-center gap-4 bg-blue-950/80 border border-blue-900/30 p-4 rounded-2xl md:self-center shrink-0">
          {authState.accessToken ? (
            <div className="flex items-center gap-3">
              {authState.picture ? (
                <img src={authState.picture} alt="Google User" className="w-8 h-8 rounded-full border border-cyan-500/40" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-mono font-bold text-cyan-400 text-xs">
                  G
                </div>
              )}
              <div className="text-left">
                <span className="block text-[9px] text-cyan-400 font-black font-mono tracking-wider uppercase leading-none">Bağlı</span>
                <span className="block text-xs font-bold text-white truncate max-w-[150px] leading-tight mt-1">{authState.email}</span>
              </div>
              <button 
                onClick={handleDisconnectGoogle}
                className="p-1.5 rounded-lg border border-blue-900/30 hover:border-red-500/30 hover:bg-red-500/10 text-slate-300 hover:text-red-400 transition cursor-pointer"
                title="Google Drive Bağlantısını Kes"
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
              <span>Google Drive'a Bağlan</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Success Toast */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-[150] bg-emerald-500 text-slate-950 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-bold text-xs animate-bounce font-mono">
          <CheckCircle className="h-4 w-4 text-slate-955" />
          Proje Bilgileri Başarıyla Kaydedildi!
        </div>
      )}

      {/* ÜRETİCİ TABS NAVIGATION */}
      <div className="bg-[#0B1221] border border-blue-900/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-350 font-mono uppercase tracking-wider">
            Üreticiler:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-1 md:flex-initial">
          {manufacturers.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                if (isEditing) {
                  if (confirm("Kaydedilmemiş değişiklikleriniz var. Değişiklikleri iptal edip üretici değiştirmek istiyor musunuz?")) {
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
            <span>+ Yeni Üretici Ekle</span>
          </button>
        </div>
      </div>

      {/* Specification Section Header with Edit Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-[#0B1221] border border-blue-900/30 px-6 py-4 rounded-2xl shadow-xl gap-4">
        <div className="space-y-1 flex-1">
          <h3 className="text-[10px] font-black tracking-widest text-cyan-400 font-mono uppercase leading-none">
            Spesifikasyon Detayları
          </h3>
          
          {/* Active Manufacturer Name with Edit Mode */}
          {!isEditingManufacturerName ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-black text-white font-display">
                {manufacturers.find(m => m.id === selectedManufacturerId)?.name || "Yükleniyor..."}
              </span>
              <button
                onClick={handleStartEditManufacturerName}
                className="text-[9px] font-bold text-slate-400 hover:text-cyan-400 transition cursor-pointer font-mono px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-md"
              >
                İsmi Düzenle
              </button>
              {selectedManufacturerId && (
                <button
                  onClick={() => setIsConfirmingDelete(true)}
                  className="text-[9px] font-bold text-red-400 hover:text-red-305 transition cursor-pointer font-mono px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-md flex items-center gap-1"
                  title="Üreticiyi Sil"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Üreticiyi Sil</span>
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
                Kaydet
              </button>
              <button
                onClick={handleCancelEditManufacturerName}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg cursor-pointer transition border border-slate-750 font-mono"
              >
                İptal
              </button>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          {!isEditing ? (
            <button
              onClick={handleStartEdit}
              className="px-4 py-2 bg-blue-650 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-sm font-mono uppercase"
            >
              Düzenle
            </button>
          ) : (
            <>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition border border-slate-750 font-mono uppercase"
              >
                İptal
              </button>
              <button
                onClick={handleSaveDetails}
                disabled={savingDetails}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-650 disabled:opacity-50 text-slate-955 text-xs font-bold rounded-xl cursor-pointer transition shadow-sm font-mono uppercase"
              >
                {savingDetails ? "Kaydediliyor..." : "Kaydet"}
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
                Fiyatlandırma & Kapasite
              </h4>
            </div>
            {isEditing && editedDetails ? (
              <div className="space-y-3 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">EXW Fiyat Listesi (Drive Linki):</label>
                  <input
                    type="text"
                    value={editedDetails.pricingCapacity.exwPriceList}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      pricingCapacity: { ...editedDetails.pricingCapacity, exwPriceList: e.target.value }
                    })}
                    placeholder="Google Drive linki..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Minimum Sipariş Hacmi (MOQ):</label>
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
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Aylık Üretim Kapasitesi:</label>
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
                  <span className="text-slate-300 block font-semibold">EXW Fiyat Listesi:</span>
                  {details.pricingCapacity.exwPriceList && details.pricingCapacity.exwPriceList.startsWith("http") ? (
                    <a href={details.pricingCapacity.exwPriceList} target="_blank" rel="noopener noreferrer" className="text-cyan-400 font-bold hover:underline block mt-1 font-mono truncate">
                      Fiyat Listesini Görüntüle ↗
                    </a>
                  ) : (
                    <span className="text-white font-bold block mt-1 font-mono">{details.pricingCapacity.exwPriceList || "N/A"}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">Minimum Sipariş Hacmi (MOQ):</span>
                  <span className="text-white font-bold block mt-1">{details.pricingCapacity.moq || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">Aylık Üretim Kapasitesi:</span>
                  <span className="text-cyan-400 font-bold block mt-1">{details.pricingCapacity.monthlyCapacity || "N/A"}</span>
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
                Üretim & Lojistik Süreler
              </h4>
            </div>
            {isEditing && editedDetails ? (
              <div className="space-y-3 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">İlk Sipariş Üretim Süresi:</label>
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
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Tekrar Siparişleri:</label>
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
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Lojistik Transit Süresi:</label>
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
                  <span className="text-slate-300 block font-semibold">İlk Sipariş Üretim Süresi:</span>
                  <span className="text-white font-bold block mt-1">{details.productionTransit.productionFirstOrder || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">Tekrar Siparişleri:</span>
                  <span className="text-white font-bold block mt-1">{details.productionTransit.productionRepeatOrder || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">Lojistik Transit Süresi:</span>
                  <span className="text-cyan-400 font-bold block mt-1 font-mono">{details.productionTransit.shipmentTransitTime || "N/A"}</span>
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
                Depolama & Raf Ömrü
              </h4>
            </div>
            {isEditing && editedDetails ? (
              <div className="space-y-3 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Donuk Ürünler:</label>
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
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Ortam Sıcaklığı Ürünleri:</label>
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
                  <span className="text-slate-300 block font-semibold">Donuk Ürünler:</span>
                  <span className="text-cyan-400 font-bold block mt-1 font-mono">{details.storageShelfLife.frozenProducts || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">Ortam Sıcaklığı Ürünleri:</span>
                  <span className="text-white font-bold block mt-1 font-mono">{details.storageShelfLife.ambientProducts || "N/A"}</span>
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
                Sertifikalar & Analizler
              </h4>
            </div>
            {isEditing && editedDetails ? (
              <div className="space-y-3 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">CoA (Certificate of Analysis):</label>
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
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Ürün Kalite Sertifikaları:</label>
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
                    placeholder="Virgülle ayırın (Örn: Vegan, BRC, Helal)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {editedDetails.certifications.certificates.map((cert, index) => (
                      <span key={index} className="px-2 py-0.5 text-[9px] font-bold font-mono bg-teal-500/10 border border-teal-500/25 text-teal-400 rounded-md uppercase">
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-4 text-xs">
                <div>
                  <span className="text-slate-300 block font-semibold">CoA (Certificate of Analysis):</span>
                  <span className="text-white font-bold block mt-1 font-mono">{details.certifications.coa || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">Ürün Kalite Sertifikaları:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {details.certifications.certificates && details.certifications.certificates.length > 0 ? (
                      details.certifications.certificates.map((cert, index) => (
                        <span key={index} className="px-2.5 py-1 text-[10px] font-black font-mono uppercase bg-blue-900/40 border border-blue-850/50 text-cyan-400 rounded-lg">
                          {cert}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 italic">Sertifika tanımlanmadı.</span>
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
                Ürün ve Paketleme Konfigürasyonu
              </h4>
              <div className="flex items-center gap-2">
                {isEditingPackaging ? (
                  <>
                    <button
                      onClick={handleSavePackagingConfig}
                      className="p-1 text-teal-400 hover:text-teal-300 rounded hover:bg-slate-800 transition cursor-pointer"
                      title="Kaydet"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleCancelPackagingEdit}
                      className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-slate-800 transition cursor-pointer"
                      title="İptal"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleStartPackagingEdit}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
                    title="Düzenle"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {isEditingPackaging ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-[11px]">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Ürün adı / Varyant:</label>
                  <input
                    type="text"
                    value={editedPackagingConfig.productVariant || ""}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, productVariant: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Tekli Ürün Ağırlığı:</label>
                  <input
                    type="number"
                    step="0.001"
                    value={editedPackagingConfig.singleWeight === undefined ? "" : editedPackagingConfig.singleWeight}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, singleWeight: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Paketleme biçimi:</label>
                  <input
                    type="text"
                    value={editedPackagingConfig.packagingStyle || ""}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, packagingStyle: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Küçük içindeki ürün adeti:</label>
                  <input
                    type="number"
                    value={editedPackagingConfig.innerBoxCount === undefined ? "" : editedPackagingConfig.innerBoxCount}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, innerBoxCount: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Büyük koli içindeki paket adeti:</label>
                  <input
                    type="number"
                    value={editedPackagingConfig.masterCartonCount === undefined ? "" : editedPackagingConfig.masterCartonCount}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, masterCartonCount: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Palet içindeki koli adeti:</label>
                  <input
                    type="number"
                    value={editedPackagingConfig.palletCartonCount === undefined ? "" : editedPackagingConfig.palletCartonCount}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, palletCartonCount: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Koli net ağırlığı:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editedPackagingConfig.cartonNetWeight === undefined ? "" : editedPackagingConfig.cartonNetWeight}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, cartonNetWeight: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Koli bürüt ağırlığı:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editedPackagingConfig.cartonGrossWeight === undefined ? "" : editedPackagingConfig.cartonGrossWeight}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, cartonGrossWeight: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Koli ölçüleri:</label>
                  <input
                    type="text"
                    value={editedPackagingConfig.cartonDimensions || ""}
                    onChange={(e) => setEditedPackagingConfig({ ...editedPackagingConfig, cartonDimensions: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Toplam gross ürün ağırlığı:</label>
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
                  <span className="text-slate-400 block font-medium">Ürün adı / Varyant:</span>
                  <span className="text-white font-semibold block mt-0.5">{packagingConfig.productVariant || "Belirtilmedi"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Tekli Ürün Ağırlığı:</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.singleWeight !== undefined && packagingConfig.singleWeight !== 0 ? `${packagingConfig.singleWeight} kg` : "Belirtilmedi"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Paketleme biçimi:</span>
                  <span className="text-white font-semibold block mt-0.5">{packagingConfig.packagingStyle || "Belirtilmedi"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Küçük içindeki ürün adeti:</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.innerBoxCount !== undefined && packagingConfig.innerBoxCount !== 0 ? `${packagingConfig.innerBoxCount} adet` : "Belirtilmedi"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Büyük koli içindeki paket adeti:</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.masterCartonCount !== undefined && packagingConfig.masterCartonCount !== 0 ? `${packagingConfig.masterCartonCount} adet` : "Belirtilmedi"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Palet içindeki koli adeti:</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.palletCartonCount !== undefined && packagingConfig.palletCartonCount !== 0 ? `${packagingConfig.palletCartonCount} koli` : "Belirtilmedi"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Koli net ağırlığı:</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.cartonNetWeight !== undefined && packagingConfig.cartonNetWeight !== 0 ? `${packagingConfig.cartonNetWeight} kg` : "Belirtilmedi"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Koli bürüt ağırlığı:</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.cartonGrossWeight !== undefined && packagingConfig.cartonGrossWeight !== 0 ? `${packagingConfig.cartonGrossWeight} kg` : "Belirtilmedi"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Koli ölçüleri:</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">{packagingConfig.cartonDimensions || "Belirtilmedi"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Toplam gross ürün ağırlığı:</span>
                  <span className="text-white font-semibold block mt-0.5 font-mono">
                    {packagingConfig.totalGrossWeight !== undefined && packagingConfig.totalGrossWeight !== 0 ? `${packagingConfig.totalGrossWeight} kg` : "Belirtilmedi"}
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
                Ürün & Pazarlama Detayları
              </h4>
            </div>
            {isEditing && editedDetails ? (
              <div className="space-y-3 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Aktif Ürün Çeşitleri:</label>
                  <textarea
                    value={editedDetails.variations.join("\n")}
                    onChange={(e) => {
                      const list = e.target.value.split("\n").map(l => l.trim()).filter(Boolean);
                      setEditedDetails({
                        ...editedDetails,
                        variations: list
                      });
                    }}
                    placeholder="Her satıra bir ürün çeşidi yazın..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500 h-20 resize-none font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Pazarlama & Numune Süreci:</label>
                  <textarea
                    value={editedDetails.marketingSamples}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      marketingSamples: e.target.value
                    })}
                    placeholder="Pazarlama ve numune detayları..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500 h-20 resize-none font-sans"
                  />
                </div>
                
                {/* Product claims under global edit mode */}
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase">Ürün İddiaları (Product Claims):</label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800 border border-slate-700 rounded-xl min-h-[40px]">
                    {(editedDetails.productClaims || []).map((claim, index) => (
                      <span key={index} className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold font-mono bg-teal-500/10 border border-teal-500/25 text-teal-400 rounded-md uppercase">
                        <span>{claim}</span>
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
                      placeholder="Yeni iddia ekle ve Enter'a bas..."
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
                  <span className="text-slate-300 block font-semibold">Aktif Ürün Çeşitleri:</span>
                  <div className="space-y-1 mt-1">
                    {details.variations && details.variations.length > 0 ? (
                      details.variations.map((v, index) => (
                        <div key={index} className="text-white font-semibold">• {v}</div>
                      ))
                    ) : (
                      <span className="text-slate-500 italic">Ürün çeşidi girilmedi.</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-slate-300 block font-semibold">Pazarlama & Numune Süreci:</span>
                  <span className="text-white font-bold block mt-1 leading-relaxed">{details.marketingSamples || "N/A"}</span>
                </div>
                
                {/* Product Claims View & Local Inline Edit Area */}
                <div className="pt-3 border-t border-blue-900/20">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold block">Ürün İddiaları (Product Claims):</span>
                    {!isEditingClaims && (
                      <button
                        onClick={handleStartEditClaims}
                        className="text-slate-400 hover:text-cyan-400 transition p-1 cursor-pointer"
                        title="İddiaları Düzenle"
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
                            <span>{claim}</span>
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
                          placeholder="Yeni iddia ekle ve Enter'a bas..."
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
                          title="İptal"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveClaims}
                          className="p-1 bg-teal-500 hover:bg-teal-650 text-slate-955 rounded-lg transition cursor-pointer"
                          title="Kaydet"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {details.productClaims && details.productClaims.length > 0 ? (
                        details.productClaims.map((claim, index) => (
                          <span key={index} className="px-2.5 py-1 text-[10px] font-black font-mono uppercase bg-blue-900/40 border border-blue-850/50 text-cyan-400 rounded-lg">
                            {claim}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">İddia belirtilmedi.</span>
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
                Besin Değerleri (100g)
              </h4>
              <span className="text-[10px] text-blue-100 font-mono font-bold uppercase bg-blue-950 px-2 py-0.5 rounded-lg border border-blue-900/30">
                100g Değerleri
              </span>
            </div>

            {isEditing && editedDetails ? (
              <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase block">Enerji:</label>
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
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase block">Yağ / Doymuş Yağ:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Yağ"
                      value={editedDetails.nutritionalValues.fat}
                      onChange={(e) => setEditedDetails({
                        ...editedDetails,
                        nutritionalValues: { ...editedDetails.nutritionalValues, fat: e.target.value }
                      })}
                      className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder="Doymuş"
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
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase block">Karb. / Şeker:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Karb."
                      value={editedDetails.nutritionalValues.carbohydrates}
                      onChange={(e) => setEditedDetails({
                        ...editedDetails,
                        nutritionalValues: { ...editedDetails.nutritionalValues, carbohydrates: e.target.value }
                      })}
                      className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder="Şeker"
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
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase block">Protein:</label>
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
                  <label className="text-slate-400 font-bold font-mono text-[9px] uppercase block">Lif / Tuz:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Lif"
                      value={editedDetails.nutritionalValues.fiber}
                      onChange={(e) => setEditedDetails({
                        ...editedDetails,
                        nutritionalValues: { ...editedDetails.nutritionalValues, fiber: e.target.value }
                      })}
                      className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder="Tuz"
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
                  <span className="text-slate-300 font-semibold">Enerji</span>
                  <strong className="text-white font-mono text-sm mt-1">{details.nutritionalValues.energy || "N/A"}</strong>
                </div>
                <div className="bg-blue-950/50 p-3 rounded-xl border border-blue-900/30 flex flex-col justify-between">
                  <span className="text-slate-300 font-semibold">Yağ (Doymuş: {details.nutritionalValues.fatSaturated || "N/A"})</span>
                  <strong className="text-white font-mono text-sm mt-1">{details.nutritionalValues.fat || "N/A"}</strong>
                </div>
                <div className="bg-blue-950/50 p-3 rounded-xl border border-blue-900/30 flex flex-col justify-between">
                  <span className="text-slate-300 font-semibold">Karbonhidrat (Şeker: {details.nutritionalValues.sugar || "N/A"})</span>
                  <strong className="text-white font-mono text-sm mt-1">{details.nutritionalValues.carbohydrates || "N/A"}</strong>
                </div>
                <div className="bg-blue-950/50 p-3 rounded-xl border border-blue-900/30 flex flex-col justify-between">
                  <span className="text-slate-300 font-semibold">Protein</span>
                  <strong className="text-cyan-400 font-mono text-sm mt-1">{details.nutritionalValues.protein || "N/A"}</strong>
                </div>
                <div className="bg-blue-950/50 p-3 rounded-xl border border-blue-900/30 flex flex-col justify-between col-span-2 flex-row items-center">
                  <div>
                    <span className="text-slate-300 font-semibold block">Lif / Tuz Oranı</span>
                    <div className="flex gap-4 mt-1 font-mono text-white text-xs">
                      <div>Lif: <strong>{details.nutritionalValues.fiber || "N/A"}</strong></div>
                      <div>Tuz: <strong>{details.nutritionalValues.salt || "N/A"}</strong></div>
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
                Hedef İhracat Pazarları ({details.exportMarkets ? details.exportMarkets.length : 0} Ülke)
              </h4>
            </div>

            {isEditing && editedDetails ? (
              <div className="space-y-2 mt-4 text-xs">
                <label className="text-slate-400 font-bold font-mono text-[9px] uppercase block">Hedef İhracat Pazarları:</label>
                <input
                  type="text"
                  value={editedDetails.exportMarkets.map(m => m.name).join(", ")}
                  onChange={(e) => {
                    const list = e.target.value.split(",").map(x => {
                      const trimmed = x.trim();
                      return { name: trimmed, flag: getFlag(trimmed) };
                    }).filter(m => m.name);
                    setEditedDetails({
                      ...editedDetails,
                      exportMarkets: list
                    });
                  }}
                  placeholder="Virgülle ayırın (Örn: Almanya, Hollanda, Fransa)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {editedDetails.exportMarkets.map((market, index) => (
                    <span key={index} className="px-2 py-0.5 text-[10px] font-bold bg-teal-500/10 border border-teal-500/25 text-teal-400 rounded-lg flex items-center gap-1">
                      <span>{market.flag}</span>
                      <span>{market.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5 mt-5">
                {details.exportMarkets && details.exportMarkets.length > 0 ? (
                  details.exportMarkets.map((market, index) => (
                    <span 
                      key={index} 
                      className="px-3 py-1.5 text-xs font-bold bg-blue-900/40 border border-blue-800/40 text-blue-100 rounded-xl flex items-center gap-1.5 hover:bg-blue-900/60 hover:border-blue-700/60 transition"
                    >
                      <span className="text-sm select-none">{market.flag}</span>
                      <span>{market.name}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 italic text-xs">Pazar tanımlanmadı.</span>
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
              Proje Doküman Listesi & Google Drive Senkronizasyonu
            </h4>
            <p className="text-[10px] text-slate-300 font-mono">
              Sözleşmeler, gümrük belgeleri ve laboratuvar analiz dokümanları.
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
                <span>{isUploading ? "Belge Yükleniyor..." : "Yeni Belge Ekle"}</span>
              </button>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-100 text-[10px] font-mono p-3 rounded-xl mt-3">
            ⚠️ Yükleme hatası: {uploadError}
          </div>
        )}

        {/* Dynamic file list fetched from Firestore */}
        <div className="mt-4">
          {loadingFiles ? (
            <div className="flex items-center justify-center gap-2 text-slate-300 py-6 text-xs font-mono">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <span>Veritabanı dökümanları yükleniyor...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-blue-900/20 rounded-xl">
              <FileText className="h-8 w-8 text-slate-600 mx-auto opacity-40" />
              <span className="block text-slate-300 text-xs mt-2 font-semibold">Kasada henüz taranmış resmi bir belge yok.</span>
              {!authState.accessToken && (
                <span className="block text-blue-100 text-[10px] mt-1 font-mono">
                  Belge eklemek için lütfen yukarıdan Google Drive bağlantısı kurun.
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
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
                        title="İndir / Görüntüle"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button 
                      onClick={() => handleDeleteFile(file)}
                      className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-500 hover:text-red-400 transition cursor-pointer"
                      title="Kayıt Sil"
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
                Yeni Üretici Ekle
              </h3>
              <p className="text-[10px] text-slate-455 font-sans">
                Lütfen projeye atamak istediğiniz yeni üreticinin/fabrikanın adını girin.
              </p>
            </div>
            
            <form onSubmit={handleAddManufacturer} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Üretici / Fabrika Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Bakker"
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
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-650 text-slate-955 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Üretici Ekle
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
                Üreticiyi Sil
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Bu üreticiyi ve ona ait tüm spesifikasyon verilerini silmek istediğinize emin misiniz? <strong>Bu işlem geri alınamaz.</strong>
              </p>
            </div>
            
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-750 font-mono"
              >
                Vazgeç
              </button>
              <button
                onClick={handleDeleteManufacturer}
                className="px-4 py-2 bg-red-650 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer font-mono"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
