import { safeHttps } from "../domain/operations";
import { useProjectName } from "../lib/projectName";
import { apiFetch } from "../lib/api";
import React, { useState, useEffect, useRef } from "react";
import {
  FileText, Folder, RefreshCw, Upload, ShieldCheck, ShieldAlert,
  Trash2, Download, CheckCircle, Database, ChevronRight, HelpCircle,
  Link2, Unlink
} from "lucide-react";
import { parseCSVToDriveFiles, DriveFile, DRIVE_MAPPING_CSV_RAW } from "../data/driveData";
import { subscribeDriveAuth, setDriveAuth } from "../lib/driveAuth";
import { db, auth } from "../lib/firebase";
import { onSnapshot, collection, query, where, doc, setDoc, deleteDoc, getDocs } from "firebase/firestore";
import { useI18n } from "../i18n";

interface GoogleDriveFolderProps {
  stepId: string;
  storageLocation: string;
  clientMode: boolean;
  currentProjectId: string; // e.g. "PROJE-UNLU MAMÜLLER"
  onStatusChange?: (stepId: string, status: string) => void;
  onFileUploadedNotify?: (fileName: string) => void;
}

export default function GoogleDriveFolder({
  stepId,
  storageLocation,
  clientMode,
  currentProjectId,
  onStatusChange,
  onFileUploadedNotify
}: GoogleDriveFolderProps) {
  const g = useI18n().t.drive;
  const [files, setFiles] = useState<DriveFile[]>([]);

  const getProjectName = useProjectName();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [customFileName, setCustomFileName] = useState("");
  const [customFileType, setCustomFileType] = useState<DriveFile["fileType"]>("PDF");
  const [isSimulatingUpload, setIsSimulatingUpload] = useState(false);

  // Real Drive uploads states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Centralized In-memory Google Auth State
  const [authState, setAuthState] = useState<{
    accessToken: string | null;
    email: string | null;
    picture: string | null;
  }>({ accessToken: null, email: null, picture: null });

  // Subscribe to shared active Google token cache
  useEffect(() => {
    const unsubscribe = subscribeDriveAuth((auth) => {
      setAuthState(auth);
    });
    return unsubscribe;
  }, []);

  // Trigger Google OAuth dynamic login popup
  const handleConnectGoogle = async () => {
    try {
      const response = await apiFetch("/api/auth/google-url");
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch Google auth url");
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
        alert(g.popupBlocked);
      }
    } catch (err: any) {
      console.error("Auth trigger failed:", err);
      alert(g.authError(String(err.message || err)));
    }
  };

  // Perform physical Google Drive multi-tier mapping upload via server proxy
  const handlePhysicalFileUpload = async (rawFile: File) => {
    if (!authState.accessToken) {
      alert(g.tokenExpired);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", rawFile);
    formData.append("folderName", storageLocation || "SOP Varsayılan Belge Depolama Alanı");
    formData.append("projectId", currentProjectId || "PROJE-UNLU MAMÜLLER");
    formData.append("stepId", stepId);

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
        throw new Error(errData.error || `Upload failed with status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Real Google Drive Upload complete:", result);

      const detectedRawType = rawFile.type;
      let mappedType: DriveFile["fileType"] = "PDF";
      if (detectedRawType.includes("sheet") || rawFile.name.endsWith(".xls") || rawFile.name.endsWith(".xlsx")) {
        mappedType = "RFQ Sheet";
      } else if (detectedRawType.includes("image") || rawFile.name.endsWith(".jpg") || rawFile.name.endsWith(".jpeg") || rawFile.name.endsWith(".png")) {
        mappedType = "Photoshoot Proof";
      } else if (rawFile.name.toLowerCase().includes("cert") || rawFile.name.toLowerCase().includes("test")) {
        mappedType = "Certificate";
      }

      const newFile: DriveFile = {
        stepId: stepId,
        folderName: storageLocation || "Ortak Klasör Çalışma Alanı",
        projectId: currentProjectId || "PROJE-UNLU MAMÜLLER",
        fileName: result.fileName,
        fileType: mappedType,
        downloadUrl: result.downloadUrl,
        fileSize: result.fileSize,
        dateAdded: result.dateAdded,
        fileId: result.fileId,
        assignedTo: auth.currentUser?.uid || "",
        userId: auth.currentUser?.uid || ""
      };

      // Persist in custom drive files list
      const docId = `${currentProjectId}_${stepId}_${result.fileId}`;
      await setDoc(doc(db, "driveFiles", docId), newFile);

      // Update tracker status to completed
      if (onStatusChange) {
        onStatusChange(stepId, "In Progress");
      }

      if (onFileUploadedNotify) {
        onFileUploadedNotify(result.fileName);
      }
    } catch (err: any) {
      console.error("Physical upload error:", err);
      setUploadError(err.message || "Failed to complete physical upload");
      alert(g.uploadFailed(err.message || g.uploadFailedHint));
    } finally {
      setIsUploading(false);
    }
  };

  // Load and parse initial files list, merging with Firestore to protect custom uploads
  useEffect(() => {
    if (!auth.currentUser) return;

    let q;
    if (stepId.startsWith("freelance_step_")) {
      q = query(
        collection(db, "driveFiles"),
        where("stepId", "==", stepId),
        where("assignedTo", "==", auth.currentUser.uid),
        where("projectId", "==", currentProjectId)
      );
    } else {
      q = query(
        collection(db, "driveFiles"),
        where("projectId", "==", currentProjectId),
        where("stepId", "==", stepId)
      );
    }

    const unsub = onSnapshot(q, (snapshot) => {
      setFiles(snapshot.docs.map(doc => ({...doc.data(),documentId:doc.id} as DriveFile)));
    }, (err) => {
      console.error("Firestore driveFiles snapshot error:", err);
    });
    return unsub;
  }, [currentProjectId, stepId]);

  // Sync Google Drive simulator action
  const handleSyncDrive = async () => {
    setIsSyncing(true); setUploadError(null);
    try {
      const conditions = [where("projectId", "==", currentProjectId), where("stepId", "==", stepId)];
      if (stepId.startsWith("freelance_step_")) conditions.push(where("assignedTo", "==", auth.currentUser?.uid || ""));
      const snapshot = await getDocs(query(collection(db,"driveFiles"),...conditions));
      setFiles(snapshot.docs.map(item=>({...item.data(),documentId:item.id} as DriveFile)));
    } catch { setUploadError(g.listRefreshFailed); } finally { setIsSyncing(false); }
  };

  // Filter files by folder location AND B2B Project security permissions
  // Users or clients only see files matching their project.
  const allFolderFiles = files.filter(f => {
    // Exact folder match based on storageLocation
    const isSameFolder = f.folderName.trim().toLowerCase() === storageLocation.trim().toLowerCase() ||
                         f.stepId.trim().toLowerCase() === stepId.trim().toLowerCase();
    return isSameFolder;
  });

  // Client Security Filtering: B2B Clients must only see documents tied to their certified Project ID
  const clientSecuredFiles = allFolderFiles.filter(f => {
    if (clientMode) {
      // Must exactly match the client's current logged-in project ID
      return f.projectId === currentProjectId;
    }
    return true; // Sourcing Agent / Desk mode sees all project contexts for administrative review
  });

  // Apply search query if defined
  const displayedFiles = clientSecuredFiles.filter(f =>
    f.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.fileType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // File Upload Handlers (Simulate secure upload directly to Google Drive folder API endpoint)
  const handleAddFile = (..._unused: unknown[]) => {
    setUploadError(g.realFileOnly);
    fileInputRef.current?.click();
  };

  // Drag and Drop simulation/real upload
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (authState.accessToken) {
        handlePhysicalFileUpload(droppedFile);
      } else {
        const detectedType: DriveFile["fileType"] = droppedFile.name.endsWith(".xls") || droppedFile.name.endsWith(".xlsx")
          ? "RFQ Sheet"
          : droppedFile.name.endsWith(".png") || droppedFile.name.endsWith(".jpg") || droppedFile.name.endsWith(".jpeg")
            ? "Photoshoot Proof"
            : "PDF";
        handleAddFile(droppedFile.name, detectedType);
      }
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    try {
      const docId = files.find(file=>file.fileName===fileName)?.documentId || `${currentProjectId}_${stepId}_${fileName.replace(/\s+/g, "_")}`;
      await deleteDoc(doc(db, "driveFiles", docId));
    } catch (e) {
      console.error("Failed to delete file from Firestore:", e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handlePhysicalFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm mt-3 animate-fadeIn">
      {/* Hidden native input for physical folder mapping uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Dynamic API Bar */}
      <div className="bg-slate-900 px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between text-white border-b border-slate-800 text-xs gap-3">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${authState.accessToken ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
          <span className="font-mono text-[11px] font-semibold text-slate-300">
            {authState.accessToken ? g.statusConnected : g.statusOffline}
          </span>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <span className="text-slate-400 text-[10px] hidden sm:inline font-mono">
            {authState.accessToken ? g.connectedAs(authState.email || "") : g.notConnected}
          </span>
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-end">
          {authState.accessToken ? (
            <div className="flex items-center gap-2">
              {authState.picture && (
                <img
                  src={authState.picture}
                  className="h-5 w-5 rounded-full border border-slate-700"
                  alt="user avatar"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="text-[10px] font-mono text-emerald-400 font-semibold max-w-[120px] truncate">
                {authState.email}
              </span>
              <button
                onClick={() => setDriveAuth(null, null, null)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 hover:text-red-400 transition cursor-pointer text-[10px] font-mono"
                title={g.disconnect}
              >
                <Unlink className="h-3 w-3" /> {g.signOut}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-navy hover:bg-navy-light text-white transition cursor-pointer text-[10px] font-bold shadow-md shadow-navy/20"
            >
              <Link2 className="h-3.5 w-3.5 animate-bounce" />
              {g.connect}
            </button>
          )}

          <span className="text-slate-700 hidden sm:inline">|</span>

          <button
            onClick={handleSyncDrive}
            id="btn-sync-folder"
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 hover:text-white transition cursor-pointer text-[10px] font-semibold text-slate-300"
            disabled={isSyncing}
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin text-teal-400" : ""}`} />
            {isSyncing ? g.syncing : g.sync}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* Storage Title Info */}
        <div className="flex justify-between items-start gap-4 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-2.5">
            <div className="p-2 bg-navy/10 text-navy rounded-lg shrink-0">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">
                {g.storagePath}
              </div>
              <h4 className="text-sm font-bold text-slate-800 font-display flex items-center gap-1.5 mt-0.5">
                {storageLocation || g.defaultStorage}
              </h4>
            </div>
          </div>

          <div className="text-right">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${authState.accessToken ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-navy/10 border border-navy/20 text-navy"}`}>
              <ShieldCheck className="h-3 w-3" />
              {authState.accessToken
                ? g.driveOpen
                : clientMode ? g.clientSandbox : g.offlineSandbox}
            </span>
          </div>
        </div>

        {/* Security / Non-compliance Banner */}
        {clientMode && (
          <div className="mb-4 bg-teal-50/70 border border-teal-100 rounded-xl p-3 text-xs text-teal-800 flex gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">{g.clientViewTitle}</span>
              {g.clientViewText} <strong>{currentProjectId}</strong>{g.clientViewSuffix}
            </div>
          </div>
        )}

        {/* Sync Instruction Banner */}
        {!authState.accessToken && !clientMode && (
          <div className="mb-4 bg-amber-50/70 border border-amber-100 rounded-xl p-3.5 text-xs text-amber-800 flex gap-2">
            <ShieldAlert className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">{g.driveRequiredTitle}</span>
              {g.driveRequiredText}

            </div>
          </div>
        )}

        {/* Search Bar / Filters */}
        <div className="mb-4">
          <input
            type="text"
            placeholder={g.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-navy"
          />
        </div>

        {/* Files Grid and Table */}
        <div className="space-y-2">
          {displayedFiles.length > 0 ? (
            <div className="bg-white border border-slate-150 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {displayedFiles.map(file => (
                <div
                  key={file.fileName}
                  className="flex items-center justify-between p-3.5 hover:bg-slate-50/50 transition text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 mr-4">
                    <span className={`p-2 rounded-lg ${
                      file.fileType === "PDF" ? "bg-red-50 text-red-600" :
                      file.fileType === "RFQ Sheet" ? "bg-emerald-50 text-emerald-600" :
                      file.fileType === "Photoshoot Proof" ? "bg-purple-50 text-purple-600" :
                      file.fileType === "Certificate" ? "bg-navy/10 text-navy" :
                      "bg-slate-50 text-slate-600"
                    }`}>
                      <FileText className="h-4.5 w-4.5 shrink-0" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate" title={file.fileName}>
                        {file.fileName}
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span className="text-navy font-bold uppercase text-[9px] bg-navy/10 px-1 rounded">
                          {file.fileId ? g.cloudReal : g.sandbox}
                        </span>
                        <span>•</span>
                        <span>{g.type(file.fileType)}</span>
                        <span>•</span>
                        <span>{g.size(file.fileSize)}</span>
                        <span>•</span>
                        <span>{g.project(file.projectId)}</span>
                        <span>•</span>
                        <span>{g.added(file.dateAdded)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        if (safeHttps(file.downloadUrl)) {
                          window.open(file.downloadUrl, "_blank", "noopener,noreferrer");
                        } else {
                          alert(g.sampleDownload(file.fileName));
                        }
                      }}
                      className="inline-flex items-center gap-1 py-1.5 px-3 rounded-lg bg-slate-150 border border-slate-200 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition font-bold text-[11px] cursor-pointer"
                    >
                      <Download className="h-3 w-3" />
                      {file.fileId ? g.openInDrive : g.download}
                    </button>

                    {/* Deletion parameters for Admin Sourcing workspace */}
                    {!clientMode && (
                      <button
                        onClick={() => handleDeleteFile(file.fileName)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer"
                        title={g.deleteRemote}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-150 border-dashed rounded-xl p-8 text-center">
              <Database className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <div className="text-slate-500 text-xs font-semibold">{g.noMatch}</div>
              <p className="text-slate-400 text-[11px] mt-1 max-w-sm mx-auto">
                {g.noFiles} {clientMode ? g.noFilesClient : g.noFilesAdmin}
              </p>
            </div>
          )}
        </div>

        {/* Administrative Upload Center for the Sourcing Advisor */}
        {!clientMode && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono mb-2.5 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-navy" />
              {g.uploadConsole}
            </h5>

            {/* Simulated / Real Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center transition cursor-pointer mb-3 ${
                dragActive ? "border-navy bg-navy/5" : "border-slate-300 hover:border-navy hover:bg-slate-50 bg-white"
              }`}
              title={g.dropTitle}
            >
              <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <div className="text-xs text-slate-600">
                <span className="font-bold text-navy text-sm">{g.dropStrong}</span>{g.dropRest}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {g.dropTypes}
              </p>
              {authState.accessToken && (
                <div className="mt-2 text-[9px] text-emerald-600 font-mono font-bold tracking-tight bg-emerald-50 inline-block px-2 py-0.5 rounded border border-emerald-100 uppercase">
                  {g.connectedToCloud}
                </div>
              )}
            </div>

            <button type="button" disabled={isUploading} onClick={() => authState.accessToken ? fileInputRef.current?.click() : void handleConnectGoogle()} className="rounded-lg bg-navy px-4 py-2 text-sm text-white">{isUploading ? g.uploading : authState.accessToken ? g.uploadReal : g.connectToUpload}</button>

            {/* Real-time automated instruction */}
            <div className="bg-slate-100 border rounded-lg p-2.5 mt-2.5 text-[10px] text-slate-500 font-mono leading-relaxed flex items-start gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                {g.uploadNote}

              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
