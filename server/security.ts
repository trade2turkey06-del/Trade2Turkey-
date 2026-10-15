import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { Request, Response, NextFunction } from "express";
import { trustedAdministrator } from "../src/domain/access";

const projectId = "planar-folio-h6m9v";
const databaseId = "ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7";
if (!getApps().length) initializeApp({ projectId });
export type Profile = { role: string; projectId: string; assignedProjects: string[]; status: string };
export function hasProjectAccess(profile: Profile, id: string) {
  return !["suspended", "Askıya Alındı"].includes(profile.status) && (profile.role === "admin" || profile.role === "owner" || profile.projectId === id || profile.assignedProjects.includes(id));
}
export function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, { count: number; until: number }>();
  return (key: string, now = Date.now()) => {
    if (buckets.size > 10000) for (const [id, item] of buckets) if (item.until <= now) buckets.delete(id);
    const bucket = buckets.get(key);
    if (!bucket || bucket.until <= now) { buckets.set(key, { count: 1, until: now + windowMs }); return true; }
    if (bucket.count >= limit) return false;
    bucket.count++; return true;
  };
}
const allowed = createRateLimiter(60, 60000);
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = req.get("X-Firebase-Token");
  if (!token || token.length > 8192) { res.status(401).json({ error: "Geçerli Firebase oturumu gerekli." }); return; }
  try {
    const identity = await getAuth().verifyIdToken(token);
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${encodeURIComponent(identity.uid)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) { res.status(403).json({ error: "Kullanıcı profili doğrulanamadı." }); return; }
    const data = await response.json(); const fields = data.fields || {};
    const profile: Profile = { role: fields.role?.stringValue || "", projectId: fields.projectId?.stringValue || "", assignedProjects: (fields.assignedProjects?.arrayValue?.values || []).map((item: any) => item.stringValue), status: fields.status?.stringValue || "active" };
    if (["admin","owner"].includes(profile.role) && !trustedAdministrator(identity.uid, identity)) { res.status(403).json({error:"Yönetici yetkisi doğrulanamadı."});return; }
    if (!profile.role || ["suspended", "Askıya Alındı"].includes(profile.status)) { res.status(403).json({ error: "Hesap erişimi kapalı." }); return; }
    if (!allowed(identity.uid)) { res.status(429).json({ error: "İstek sınırına ulaşıldı. Bir dakika sonra deneyin." }); return; }
    res.locals.uid = identity.uid; res.locals.profile = profile; next();
  } catch { res.status(401).json({ error: "Oturum doğrulanamadı. Yeniden giriş yapın." }); }
}
