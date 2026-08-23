import React, { useState } from "react";
import { UserTenant, PRESET_CREDENTIALS, INITIAL_TENANTS } from "../data/usersData";
import { ShieldCheck, Lock, Mail, ChevronRight, Eye, EyeOff, Loader2 } from "lucide-react";
import BrandLogo from "./BrandLogo";
import { auth, db } from "../lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, query, where } from "firebase/firestore";

interface LoginScreenProps {
  onLoginSuccess: (user: UserTenant) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpName, setSignUpName] = useState("");

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpName.trim() || !email.trim() || !password) {
      setErrorMessage("Lütfen tüm alanları doldurun.");
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const lowerEmail = email.trim().toLowerCase();

    try {
      // 1. Check if the email exists in the users collection with pending_auth status
      const userInviteQuery = query(collection(db, "users"), where("email", "==", lowerEmail));
      const userInviteSnap = await getDocs(userInviteQuery);

      if (userInviteSnap.empty) {
        setErrorMessage("Bu e-posta adresi davet edilmemiş. Lütfen yöneticinizden davet isteyin.");
        setLoading(false);
        return;
      }

      const inviteDoc = userInviteSnap.docs[0];
      const inviteData = inviteDoc.data() as UserTenant;
      if (inviteData.status !== "pending_auth") {
        setErrorMessage("Bu e-posta adresi zaten kayıtlı veya aktif durumda.");
        setLoading(false);
        return;
      }

      // 2. Register in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, lowerEmail, password);
      await updateProfile(userCredential.user, { displayName: signUpName.trim() });

      // 3. Update/Merge the user's invite document in users collection
      const updatedProfile: Partial<UserTenant> = {
        uid: userCredential.user.uid,
        id: userCredential.user.uid,
        name: signUpName.trim(),
        displayName: signUpName.trim(),
        onboardingCompleted: false,
        status: "pending_auth" // stays pending_auth until they fill in onboarding form
      };
      await setDoc(inviteDoc.ref, updatedProfile, { merge: true });

      const finalProfile: UserTenant = {
        ...inviteData,
        ...updatedProfile
      } as UserTenant;

      setLoading(false);
      onLoginSuccess(finalProfile);
    } catch (signUpError: any) {
      console.error("Freelancer Sign-up failed:", signUpError);
      setLoading(false);
      let msg = "Kayıt işlemi başarısız oldu. Lütfen tekrar deneyin.";
      if (signUpError.code === "auth/email-already-in-use") {
        msg = "Bu e-posta adresi zaten kullanımda.";
      } else if (signUpError.code === "auth/weak-password") {
        msg = "Şifre en az 6 karakter olmalıdır.";
      } else if (signUpError.message) {
        msg = signUpError.message;
      }
      setErrorMessage(msg);
    }
  };


  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Lütfen hem e-posta hem de şifre girin.");
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const lowerEmail = email.trim().toLowerCase();

    try {
      // 1. Attempt to sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, lowerEmail, password);
      
      // Get role from custom claims if present
      const idTokenResult = await userCredential.user.getIdTokenResult();
      const roleFromClaim = idTokenResult.claims.role as string | undefined;
      
      // 2. Fetch profile from Firestore by email query
      const usersQuery = query(collection(db, "users"), where("email", "==", lowerEmail));
      const usersSnap = await getDocs(usersQuery);
      
      let userProfile: UserTenant;
      
      if (!usersSnap.empty) {
        const userDoc = usersSnap.docs[0];
        userProfile = userDoc.data() as UserTenant;
        
        // Sync UID to the user document
        const updates: Partial<UserTenant> = {
          uid: userCredential.user.uid,
          id: userCredential.user.uid
        };
        if (roleFromClaim && roleFromClaim !== userProfile.role) {
          updates.role = roleFromClaim as any;
        }
        await setDoc(userDoc.ref, updates, { merge: true });
        userProfile = { ...userProfile, ...updates };
      } else {
        // Fallback: If authenticated but profile doc missing in Firestore, create it
        const presetCred = PRESET_CREDENTIALS[lowerEmail];
        let tenant = INITIAL_TENANTS.find(t => t.id === presetCred?.id);
        
        if (!tenant) {
          const prefix = lowerEmail.split("@")[0];
          tenant = {
            id: userCredential.user.uid,
            email: lowerEmail,
            companyName: prefix.charAt(0).toUpperCase() + prefix.slice(1) + " Corp",
            role: (roleFromClaim as any) || "client",
            projectId: "PROJE-UNLU MAMÜLLER",
            driveFolderName: `PROJE-UNLU MAMÜLLER (${prefix})`
          };
        } else {
          tenant.id = userCredential.user.uid;
          if (roleFromClaim) {
            tenant.role = roleFromClaim as any;
          }
        }
        
        const userDocRef = doc(db, "users", userCredential.user.uid);
        await setDoc(userDocRef, tenant);
        userProfile = tenant;
      }
      
      setLoading(false);
      onLoginSuccess(userProfile);
      return;
    } catch (signInError: any) {
      console.error("Firebase Auth sign-in failed:", signInError);
      setLoading(false);
      
      let friendlyMessage = "Kimlik doğrulama başarısız oldu. Lütfen bilgilerinizi kontrol edin.";
      if (
        signInError.code === "auth/invalid-credential" || 
        signInError.code === "auth/wrong-password" || 
        signInError.code === "auth/user-not-found"
      ) {
        friendlyMessage = "Geçersiz e-posta veya şifre. Lütfen tekrar deneyin.";
      } else if (signInError.code === "auth/invalid-email") {
        friendlyMessage = "Lütfen geçerli bir e-posta adresi girin.";
      } else if (signInError.message) {
        friendlyMessage = signInError.message;
      }
      
      setErrorMessage(friendlyMessage);
    }
  };

  return (
    <div id="login-layout-wrapper" className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 selection:bg-navy selection:text-white relative overflow-hidden">
      {/* Background radial soft light blobs of Navy Ink */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-navy/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-navy/15 blur-[130px] pointer-events-none" />

      <div id="login-card-container" className="relative w-full max-w-lg bg-neutral-900/80 backdrop-blur-xl rounded-3xl border border-neutral-800 p-8 shadow-2xl space-y-8">
        
        {/* Brand Logotype & Vector Custom Globe */}
        <div className="text-center space-y-3 pb-2 select-none">
          <BrandLogo size="lg" layout="full" theme="dark" />
          <p className="text-xs italic text-neutral-400 max-w-sm mx-auto font-sans leading-relaxed">
            "Verinin üretim gerçeğiyle buluştuğu yer."
          </p>
        </div>

        <div className="flex border-b border-neutral-800">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setErrorMessage(null);
            }}
            className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition ${
              !isSignUp ? "border-navy text-white font-bold" : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Giriş Yap
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setErrorMessage(null);
            }}
            className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition ${
              isSignUp ? "border-navy text-white font-bold" : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Kayıt Ol (Freelancer)
          </button>
        </div>

        {errorMessage && (
          <div id="login-alert-pane" className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3.5 rounded-xl font-medium leading-relaxed font-mono">
            {errorMessage}
          </div>
        )}

        <form onSubmit={isSignUp ? handleSignUpSubmit : handleLoginSubmit} className="space-y-4">
          
          {isSignUp && (
            <div className="space-y-1.5 font-sans animate-fadeIn">
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Ad Soyad *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-xs select-none">✎</span>
                <input
                  type="text"
                  required
                  placeholder="Test Satıcı"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30 transition font-sans"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5 font-sans">
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Kurumsal E-posta Adresi</label>
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
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Güvenli Erişim Şifresi</label>
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
                <Loader2 className="h-4 w-4 animate-spin text-white" /> {isSignUp ? "Hesap Oluşturuluyor..." : "Güvenli Çalışma Alanı Yükleniyor..."}
              </>
            ) : (
              <>
                {isSignUp ? "Kaydı Tamamla" : "Kurumsal Kimliği Doğrula"} <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>



      </div>
    </div>
  );
}
