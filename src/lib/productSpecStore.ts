import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { DEFAULT_THRESHOLDS, type MarketThresholds, type ProductSpec, type VaultNutrition, type VaultPackaging } from "../domain/productSpec";

export interface VaultManufacturer { id: string; name: string; vaultDetails?: { nutritionalValues?: VaultNutrition; productClaims?: string[]; storageShelfLife?: { frozenProducts?: string; ambientProducts?: string } } }
const specsCollection = (projectId: string) => collection(db, "projects", projectId, "productSpecs");
export const specRef = (projectId: string, id: string) => doc(db, "projects", projectId, "productSpecs", id);

// Belge Kasası'ndaki üreticiler (projects/{p}/manufacturers); yalnızca okunur.
export function useManufacturers(projectId: string, enabled = true) {
  const [manufacturers, setManufacturers] = useState<VaultManufacturer[]>([]);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(collection(db, "projects", projectId, "manufacturers"), snapshot => setManufacturers(snapshot.docs.map(item => ({ ...(item.data() as Omit<VaultManufacturer, "id">), id: item.id })).sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr"))), () => setManufacturers([]));
  }, [projectId, enabled]);
  return manufacturers;
}
// Projenin paketleme konfigürasyonu (projects/{p}.packaging_config); yalnızca okunur.
export function useProjectPackaging(projectId: string, enabled = true) {
  const [config, setConfig] = useState<VaultPackaging | undefined>();
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(doc(db, "projects", projectId), snapshot => setConfig(snapshot.data()?.packaging_config), () => setConfig(undefined));
  }, [projectId, enabled]);
  return config;
}
export function useProductSpecs(projectId: string, enabled = true) {
  const [state, setState] = useState<{ specs: ProductSpec[]; loading: boolean; error: boolean }>({ specs: [], loading: true, error: false });
  useEffect(() => {
    if (!enabled) return;
    setState({ specs: [], loading: true, error: false });
    return onSnapshot(specsCollection(projectId), snapshot => setState({ specs: snapshot.docs.map(item => item.data() as ProductSpec), loading: false, error: false }), () => setState({ specs: [], loading: false, error: true }));
  }, [projectId, enabled]);
  return state;
}
// Kayıtlı pazar ayarları; kaydı olmayan varsayılan pazarlar örnek değerlerle eklenir (stored=false).
export function useClaimThresholds(enabled = true) {
  const [stored, setStored] = useState<MarketThresholds[]>([]);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(collection(db, "claimThresholds"), snapshot => setStored(snapshot.docs.map(item => ({ ...(item.data() as MarketThresholds), id: item.id }))), () => setStored([]));
  }, [enabled]);
  const markets = [...stored.map(item => ({ ...item, stored: true })), ...DEFAULT_THRESHOLDS.filter(item => !stored.some(other => other.id === item.id)).map(item => ({ ...item, stored: false }))];
  return markets.sort((a, b) => a.id.localeCompare(b.id));
}

const strip = (spec: ProductSpec) => { const { createdAt: _c, updatedAt: _u, approvedAt: _a, ...rest } = spec; return rest; };
export async function createSpecDoc(spec: ProductSpec) {
  await setDoc(specRef(spec.projectId, spec.id), { ...strip(spec), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
// Kaydederken başka oturumdaki değişiklik ezilmez (updatedAt karşılaştırması); approve=true versiyonu kilitler.
export async function saveSpecDoc(spec: ProductSpec, approve = false) {
  const uid = auth.currentUser?.uid; if (!uid) throw new Error("auth");
  await runTransaction(db, async tx => {
    const ref = specRef(spec.projectId, spec.id), current = (await tx.get(ref)).data() as ProductSpec | undefined;
    if (!current || (current.updatedAt?.seconds ?? 0) !== (spec.updatedAt?.seconds ?? 0) || (current.updatedAt?.nanoseconds ?? 0) !== (spec.updatedAt?.nanoseconds ?? 0)) throw new Error("conflict");
    tx.set(ref, { ...strip(spec), createdAt: current.createdAt ?? null, updatedAt: serverTimestamp(), ...(approve ? { status: "approved", approvedAt: serverTimestamp(), approvedBy: uid } : {}) });
  });
}
export async function saveThresholds(markets: MarketThresholds) {
  const { updatedAt: _u, stored: _s, ...rest } = markets as MarketThresholds & { stored?: boolean };
  await setDoc(doc(db, "claimThresholds", markets.id), { ...rest, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? "" });
}
