import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true";
const app = initializeApp(useEmulators ? { ...firebaseConfig, projectId: "demo-t2t-security", apiKey: "demo-key", authDomain: "demo-t2t-security.firebaseapp.com" } : firebaseConfig);
export const db = getFirestore(app, useEmulators ? "(default)" : "ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7");
export const auth = getAuth(app);
if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9098", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8085);
}
