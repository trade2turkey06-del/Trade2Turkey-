import { getLang, getMessages } from "../i18n";
import { auth } from "./firebase";

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  if (!auth.currentUser) throw new Error(getMessages().api.sessionExpired);
  const headers = new Headers(init.headers);
  headers.set("X-App-Language", getLang());
  headers.set("X-Firebase-Token", await auth.currentUser.getIdToken());
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}
