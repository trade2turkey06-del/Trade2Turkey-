import { message as msg } from "../i18n";
import { initializeApp, deleteApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, getAuth, sendPasswordResetEmail, signOut } from "firebase/auth";
import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import config from "../../firebase-applet-config.json";
import { auth, db } from "./firebase";

export async function inviteUser(input: { email: string; companyName: string; projectId: string; role: "client" | "freelancer" }) {
  if (!auth.currentUser) throw new Error(msg("actionCenter", "signInFirst"));
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !input.companyName.trim() || !input.projectId) throw new Error(msg("actionCenter", "enterAValidEmailAndNameAndSelectA"));
  const existing = await getDocs(query(collection(db, "users"), where("email", "==", email)));
  if (existing.docs.some(item => item.data().uid === item.id && !item.data().legacyAccount)) throw new Error(msg("actionCenter", "thisEmailIsAlreadyRegisteredAssignProjectsThroughThe"));
  const secondary = initializeApp(config, `invite-${crypto.randomUUID()}`);
  const secondaryAuth = getAuth(secondary);
  try {
    // A secondary Auth instance prevents replacing the administrator's session.
    const password = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join("");
    const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    try {
      await setDoc(doc(db, "users", user.uid), {
        id: user.uid, uid: user.uid, email, companyName: input.companyName.trim(),
        displayName: input.companyName.trim(), name: input.companyName.trim(), role: input.role,
        projectId: input.projectId, assignedProjects: [input.projectId], driveFolderName: input.projectId,
        status: "active", onboardingCompleted: false, createdAt: new Date().toISOString(),
      });
    } catch (error) {
      await deleteUser(user).catch(() => {});
      throw error;
    }
    try {
      await sendPasswordResetEmail(secondaryAuth, email);
      return msg("actionCenter", "accountAndProjectAccessCreatedAPasswordSetupEmail");
    } catch {
      return msg("actionCenter", "accountAndProjectAccessCreatedButThePasswordEmail");
    }
  } catch (error: any) {
    if (error.code === "auth/email-already-in-use") throw new Error(msg("actionCenter", "thisEmailAlreadyExistsInAuthenticationAnAdministratorMust"));
    throw error;
  } finally { await signOut(secondaryAuth).catch(() => {}); await deleteApp(secondary); }
}
