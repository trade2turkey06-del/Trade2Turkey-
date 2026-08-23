import React from "react";
import { Globe, Shield, User, FileText, Menu, X, Clock, LogOut, RefreshCw, Compass } from "lucide-react";
import { UserTenant } from "../data/usersData";
import BrandLogo from "./BrandLogo";

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  clientMode: boolean;
  setClientMode: (mode: boolean) => void;
  currentUser: UserTenant | null;
  onLogout: () => void;
  activeProjectId: string;
  setActiveProjectId: (projectId: string) => void;
  projects: any[];
  onOpenNewProjectModal?: () => void;
}

const Navbar = React.memo(function Navbar({
  currentTab,
  setCurrentTab,
  clientMode,
  setClientMode,
  currentUser,
  onLogout,
  activeProjectId,
  setActiveProjectId,
  projects,
  onOpenNewProjectModal
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // If client, restrict tabs or adjust labels if needed.
  // Standard navigation links
  const navItems = [
    { id: "sourcing", label: "Tedarik", icon: Globe },
    { id: "logistics", label: "Üretim & Lojistik", icon: FileText },
    { id: "client-discovery", label: "Müşteri Keşfi (Freelance Ağ)", icon: Compass },
  ];

  if (currentUser?.role === "admin") {
    navItems.push({ id: "market-insights", label: "Pazar Araştırması Yönetimi", icon: Shield });
  }


  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo and Brand from Brand Book */}
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" layout="icon" theme="light" />
          <div>
            <h1 className="text-sm font-black tracking-tight text-slate-900 font-display flex items-center gap-1.5 leading-none">
              <span>Trade</span>
              <span className="text-teal-500 font-bold">2</span>
              <span>Turkey</span>
              {currentUser?.role === "admin" ? (
                <span className="text-[9px] bg-slate-900 text-slate-100 font-extrabold px-1.5 py-0.5 rounded font-mono tracking-wider uppercase border border-slate-800">
                  YÖNETİCİ
                </span>
              ) : (
                <span className="text-[9px] bg-navy/10 text-navy font-extrabold px-1.5 py-0.5 rounded font-mono tracking-wider uppercase border border-navy/10">
                  MÜŞTERİ
                </span>
              )}
            </h1>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest font-mono">
              B2B Bulut İzolasyonu
            </p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  setCurrentTab(item.id);
                  setClientMode(item.id === "client-discovery");
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-navy text-white font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Global Controls, Switcher & User Profile */}
        <div className="hidden md:flex items-center gap-3">
          
          {/* Owner/Admin Global Project Controller */}
          {currentUser?.role === "admin" && (
            <div className="flex items-center gap-1 text-xs bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 font-mono pl-1">GÖSTERİM:</span>
              <select
                value={activeProjectId}
                onChange={(e) => setActiveProjectId(e.target.value)}
                className="bg-white px-2 py-1 rounded border border-slate-200 text-slate-800 font-bold font-mono focus:outline-none cursor-pointer text-xs mr-1"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {onOpenNewProjectModal && (
                <button
                  onClick={onOpenNewProjectModal}
                  className="px-2 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-[10px] font-black uppercase font-mono tracking-wider cursor-pointer"
                  title="Yeni Proje Oluştur"
                >
                  + Yeni Proje
                </button>
              )}
            </div>
          )}

          {/* Timezone compliance tracker */}
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 border border-slate-100 text-slate-500 text-[10px] font-mono">
            <Clock className="h-3.5 w-3.5 text-slate-450" />
            <span>Operasyonel GMT+3</span>
          </div>

          {/* Corporate Profile indicator */}
          {currentUser && (
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="text-right">
                <div id="user-display-name" className="text-xs font-bold text-slate-800 leading-none">
                  {currentUser.companyName}
                </div>
                <div id="user-display-email" className="text-[9px] text-slate-400 font-mono mt-0.5 leading-none">
                  {currentUser.email}
                </div>
              </div>
              
              {/* Logout Button */}
              <button
                id="header-logout-btn"
                onClick={onLogout}
                title="Sistemden Çıkış Yap"
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-600 transition cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Mobile Menu Trigger & Action buttons */}
        <div className="flex lg:hidden items-center gap-2">
          {currentUser && (
            <button
              onClick={onLogout}
              className="p-1 px-2.5 rounded bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 text-[10px] font-bold flex items-center gap-1 transition"
            >
              <LogOut className="h-3 w-3" /> Çıkış Yap
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer layout */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 px-4 py-4 flex flex-col gap-3.5 shadow-inner">
          
          {currentUser?.role === "admin" && (
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500">Çalışma Alanı Bağlamı:</span>
              <select
                value={activeProjectId}
                onChange={(e) => setActiveProjectId(e.target.value)}
                className="bg-white p-1 rounded font-bold font-mono text-slate-800 focus:outline-none border border-slate-200"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`mob-nav-${item.id}`}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setClientMode(item.id === "client-discovery");
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${
                    isActive
                      ? "bg-navy text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {currentUser && (
            <div className="pt-3 border-t border-slate-100 text-center text-[10px] text-slate-400 font-semibold font-mono uppercase">
              Giriş yapıldı: {currentUser.companyName} ({currentUser.role})
            </div>
          )}
        </div>
      )}
    </header>
  );
});

export default Navbar;
