import React, { useState } from "react";
import { UserTenant } from "../data/usersData";
import { Lock, Mail, ChevronRight, Eye, EyeOff, Loader2 } from "lucide-react";
import BrandLogo from "./BrandLogo";
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both your email and password.");
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
        throw new Error("Bu hesap için proje erişimi tanımlı değil. Yöneticiyle iletişim kurun.");
      }
      const userProfile = { ...userDoc.data(), id: userCredential.user.uid, uid: userCredential.user.uid } as UserTenant;
      if (["suspended", "Askıya Alındı"].includes(userProfile.status || "")) {
        await signOut(auth);
        throw new Error("Bu hesap askıya alınmış. Yöneticiyle iletişim kurun.");
      }
      setLoading(false);
      onLoginSuccess(userProfile);
      return;
    } catch (signInError: any) {
      console.error("Firebase Auth sign-in failed:", signInError);
      setLoading(false);
      
      let friendlyMessage = "Authentication failed. Please check your credentials.";
      if (
        signInError.code === "auth/invalid-credential" || 
        signInError.code === "auth/wrong-password" || 
        signInError.code === "auth/user-not-found"
      ) {
        friendlyMessage = "Invalid email or password. Please try again.";
      } else if (signInError.code === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid email address.";
      } else if (signInError.message) {
        friendlyMessage = signInError.message;
      }
      
      setErrorMessage(friendlyMessage);
    }
  };

  return (
    <div id="login-layout-wrapper" className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 selection:bg-navy selection:text-white relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-navy/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-navy/15 blur-[130px] pointer-events-none" />

      <div id="login-card-container" className="relative w-full max-w-lg bg-neutral-900/80 backdrop-blur-xl rounded-3xl border border-neutral-800 p-8 shadow-2xl space-y-8">
        <div className="text-center space-y-3 pb-2 select-none">
          <BrandLogo size="lg" layout="full" theme="dark" />
          <p className="text-xs italic text-neutral-400 max-w-sm mx-auto font-sans leading-relaxed">
            "Where data meets production reality."
          </p>
        </div>

        {errorMessage && (
          <div id="login-alert-pane" className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3.5 rounded-xl font-medium leading-relaxed font-mono">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1.5 font-sans">
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Business email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                id="login-email-input"
                type="email"
                required
                placeholder="client@trade2turkey.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30 transition font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5 font-sans">
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Secure access password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                id="login-password-input"
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30 transition font-mono"
              />
              <button
                type="button"
                id="toggle-password-visibility"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-550 hover:text-neutral-300 cursor-pointer p-1 rounded"
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
                <Loader2 className="h-4 w-4 animate-spin text-white" /> Loading secure workspace...
              </>
            ) : (
              <>
                Verify corporate identity <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
          <button type="button" className="mt-3 text-sm text-slate-300 underline" disabled={loading} onClick={async () => {
            if (!email.trim()) { setErrorMessage("Şifre sıfırlamak için e-posta adresinizi girin."); return; }
            setLoading(true);
            try { await sendPasswordResetEmail(auth, email.trim().toLowerCase()); setErrorMessage("Hesap mevcutsa şifre belirleme bağlantısı gönderildi. E-posta ve spam klasörünüzü kontrol edin."); }
            catch { setErrorMessage("Şifre e-postası gönderilemedi. Bir süre sonra tekrar deneyin."); }
            finally { setLoading(false); }
          }}>Şifremi unuttum / Şifre belirle</button>
        </form>
      </div>
    </div>
  );
}
