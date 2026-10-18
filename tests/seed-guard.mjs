// Seed betikleri yalnızca yerel emülatöre yazar. Emülatör ortam değişkenleri yoksa, yerel olmayan bir adrese işaret
// ediyorsa veya proje kimliği "demo-" ile başlamıyorsa hiçbir şey yazmadan durur; canlı veritabanına yazılamaz.
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const fail = message => { console.error(`Seed durduruldu: ${message}`); process.exit(1); };
function localEndpoint(name) {
  const value = process.env[name];
  if (!value) fail(`${name} ayarlı değil. Betiği "firebase emulators:exec" içinde çalıştırın veya emülatör adresini dışa aktarın (ör. export ${name}=127.0.0.1:${name.startsWith("FIRESTORE") ? 8085 : 9098}).`);
  const match = /^(\[[^\]]+\]|[^:]+):(\d+)$/.exec(value);
  if (!match || !LOCAL_HOSTS.has(match[1])) fail(`${name}=${value} yerel bir emülatör adresi değil.`);
  return { host: match[1].replace(/^\[|\]$/g, ""), port: Number(match[2]), value };
}
export function emulatorTarget() {
  const firestore = localEndpoint("FIRESTORE_EMULATOR_HOST"), auth = localEndpoint("FIREBASE_AUTH_EMULATOR_HOST");
  const projectId = process.env.GCLOUD_PROJECT || "demo-t2t-security";
  if (!projectId.startsWith("demo-")) fail(`Proje kimliği "${projectId}" "demo-" ile başlamıyor; yalnızca demo emülatör projelerine yazılır.`);
  return { projectId, firestore, auth };
}
