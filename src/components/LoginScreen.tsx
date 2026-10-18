import React, { useState } from "react";
import { UserTenant } from "../data/usersData";
import { Lock, Mail, ChevronRight, Eye, EyeOff, Loader2, ShieldCheck, Globe2, PackageCheck } from "lucide-react";
import BrandLogo from "./BrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import { useI18n } from "../i18n";
import { auth, db } from "../lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

interface LoginScreenProps {
  initialError?: string;
  onLoginSuccess: (user: UserTenant) => void;
}

export default function LoginScreen({ onLoginSuccess, initialError }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError || null);
  const { t } = useI18n();
  const l = t.login;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage(l.errors.missing);
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const lowerEmail = email.trim().toLowerCase();

    try {
      // 1. Attempt to sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, lowerEmail, password);
      
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error(l.errors.noAccess);
      }
      const userProfile = { ...userDoc.data(), id: userCredential.user.uid, uid: userCredential.user.uid } as UserTenant;
      if (["suspended", "Askıya Alındı"].includes(userProfile.status || "")) {
        await signOut(auth);
        throw new Error(l.errors.suspended);
      }
      setLoading(false);
      onLoginSuccess(userProfile);
      return;
    } catch (signInError: any) {
      console.error("Firebase Auth sign-in failed:", signInError);
      setLoading(false);
      
      let friendlyMessage = l.errors.generic;
      if (
        signInError.code === "auth/invalid-credential" || 
        signInError.code === "auth/wrong-password" || 
        signInError.code === "auth/user-not-found"
      ) {
        friendlyMessage = l.errors.invalidCredentials;
      } else if (signInError.code === "auth/invalid-email") {
        friendlyMessage = l.errors.invalidEmail;
      } else if (signInError.message) {
        friendlyMessage = signInError.message;
      }
      
      setErrorMessage(friendlyMessage);
    }
  };

  return (
    <div id="login-layout-wrapper" className="login-page min-h-screen grid lg:grid-cols-2 bg-white selection:bg-teal-200 relative">
      <aside className="login-story relative hidden flex-col justify-between overflow-hidden bg-navy p-12 text-white lg:flex xl:p-16">
        <div className="relative z-10"><BrandLogo size="lg" layout="full" theme="dark" /></div>
        <div className="relative z-10 max-w-lg py-16">
          <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-teal-300"><span className="h-1.5 w-1.5 rounded-full bg-teal-300" /> {l.storyEyebrow}</p>
          <h1 className="font-display text-5xl font-semibold leading-[1.13] tracking-tight xl:text-6xl">{l.storyTitle1}<br /><span className="text-teal-300">{l.storyTitle2}</span></h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-slate-300">{l.storyText}</p>
          <div className="mt-10 space-y-4">{([{ icon: Globe2, text: l.storyPoints[0] }, { icon: PackageCheck, text: l.storyPoints[1] }, { icon: ShieldCheck, text: l.storyPoints[2] }]).map(({ icon: Icon, text }) => <div key={text} className="flex items-center gap-3 text-sm text-slate-200"><Icon className="h-5 w-5 text-teal-300" />{text}</div>)}</div>
        </div>
        <p className="relative z-10 text-xs text-slate-400">{l.storyFooter}</p>
      </aside>
      <div className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-12">
      <div id="login-card-container" className="relative w-full max-w-md space-y-8">
        <div className="space-y-3">
          <div className="flex justify-end"><LanguageSwitcher /></div>
          <div className="mb-10 lg:hidden"><BrandLogo size="md" layout="full" theme="light" /></div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-teal-700">{l.eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold tracking-tight text-navy">{l.title}</h2>
          <p className="text-sm leading-6 text-slate-500">{l.subtitle}</p>
        </div>

        {errorMessage && (
          <div id="login-alert-pane" role="status" aria-live="polite" className="bg-red-500/10 border border-red-500/20 text-red-700 text-xs p-3.5 rounded-xl font-medium leading-relaxed font-sans">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1.5 font-sans">
            <label htmlFor="login-email-input" className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-sans">{l.email}</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="login-email-input"
                type="email"
                autoComplete="username"
                required
                placeholder="client@trade2turkey.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30 transition font-sans"
              />
            </div>
          </div>

          <div className="space-y-1.5 font-sans">
            <label htmlFor="login-password-input" className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-sans">{l.password}</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="login-password-input"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30 transition font-sans"
              />
              <button
                type="button"
                id="toggle-password-visibility"
                aria-label={showPassword ? l.hidePassword : l.showPassword}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-navy cursor-pointer p-1 rounded"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="login-submit-btn"
            disabled={loading}
            className="w-full mt-2 bg-navy hover:bg-navy-light text-white text-xs font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-navy/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" /> {l.loading}
              </>
            ) : (
              <>
                {l.submit} <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
          <button type="button" className="mt-3 text-sm text-teal-700 hover:text-teal-900" disabled={loading} onClick={async () => {
            if (!email.trim()) { setErrorMessage(l.errors.resetNeedsEmail); return; }
            setLoading(true);
            try { await sendPasswordResetEmail(auth, email.trim().toLowerCase()); setErrorMessage(l.errors.resetSent); }
            catch { setErrorMessage(l.errors.resetFailed); }
            finally { setLoading(false); }
          }}>{l.forgot}</button>
        </form>
        <p className="flex items-center justify-center gap-2 border-t border-slate-100 pt-6 text-xs text-slate-500"><Lock className="h-3.5 w-3.5" /> {l.footer}</p>
      </div>
      </div>
    </div>
  );
}
