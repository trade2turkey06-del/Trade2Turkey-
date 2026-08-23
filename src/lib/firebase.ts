import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7");
export const auth = getAuth(app);
