import React from "react";
import { Globe, Shield, FileText, Menu, X, Clock, LogOut, Compass, FolderOpen, Layers } from "lucide-react";
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

  ];

  if (currentUser?.role === "admin") {
    navItems.push({ id: "client-discovery", label: "Müşteri Keşfi", icon: Compass });
    navItems.unshift({ id: "overview", label: "Aksiyon Merkezi", icon: Shield });
    navItems.push({ id: "sectors", label: "Sectors", icon: Layers });
    navItems.push({ id: "report", label: "Raporlar", icon: FileText });
    navItems.push({ id: "market-insights", label: "Pazar Araştırması Yönetimi", icon: Shield });
  }


  const navigate = (id: string) => {
    setCurrentTab(id);
    setClientMode(id === "client-discovery");
    setMobileMenuOpen(false);
  };

  return (
    <header className="workspace-header sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" layout="icon" theme="light" />
          <div><h1 className="font-display text-lg font-bold tracking-tight text-navy">Trade<span className="text-teal-500">2</span>Turkey</h1><p className="text-[10px] font-medium tracking-[.16em] text-slate-500 uppercase">Sourcing & operations</p></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 sm:block">{currentUser?.role === "admin" ? "Yönetici çalışma alanı" : "Müşteri çalışma alanı"}</span>
          {currentUser && <div className="hidden items-center gap-3 border-l border-slate-200 pl-4 md:flex"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">{currentUser.companyName?.slice(0, 2).toUpperCase()}</div><div><div id="user-display-name" className="text-sm font-semibold text-slate-800">{currentUser.companyName}</div><div id="user-display-email" className="text-xs text-slate-500">{currentUser.email}</div></div></div>}
          <button id="header-logout-btn" onClick={onLogout} title="Çıkış yap" aria-label="Çıkış yap" className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" /></button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Gezinme menüsü" aria-expanded={mobileMenuOpen} aria-controls="workspace-navigation" className="rounded-xl p-2 text-slate-600 lg:hidden">{mobileMenuOpen ? <X /> : <Menu />}</button>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <nav id="workspace-navigation" aria-label="Ana gezinme" className={`${mobileMenuOpen ? "flex" : "hidden"} flex-col gap-1 py-2 lg:flex lg:flex-row lg:overflow-x-auto`}>
            {navItems.map(({ id, label, icon: Icon }) => <button key={id} id={`nav-${id}`} onClick={() => navigate(id)} aria-current={currentTab === id ? "page" : undefined} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-3 text-xs font-semibold transition ${currentTab === id ? "bg-navy text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-navy"}`}><Icon className="h-4 w-4" />{label}</button>)}
          </nav>
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50/80">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-3 px-4 py-2.5 sm:px-8">
          <FolderOpen className="h-4 w-4 text-teal-600" /><label htmlFor="active-project" className="text-xs font-medium text-slate-500">Aktif proje</label>
          <select id="active-project" value={activeProjectId} onChange={e => setActiveProjectId(e.target.value)} className="min-w-0 max-w-full flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-navy sm:max-w-80">{!projects.length && <option value="">Proje bulunamadı</option>}{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          {onOpenNewProjectModal && <button onClick={onOpenNewProjectModal} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800">+ Yeni proje</button>}
          <span className="ml-auto hidden items-center gap-1.5 text-xs text-slate-500 sm:flex"><Clock className="h-3.5 w-3.5" /> İstanbul · GMT+3</span>
        </div>
      </div>
    </header>
  );
});

export default Navbar;
