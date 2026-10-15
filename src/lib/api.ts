import { auth } from "./firebase";

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  if (!auth.currentUser) throw new Error("Oturumunuz sona erdi. Yeniden giriş yapın.");
  const headers = new Headers(init.headers);
  headers.set("X-Firebase-Token", await auth.currentUser.getIdToken());
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}
