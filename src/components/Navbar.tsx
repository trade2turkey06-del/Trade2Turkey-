import React from "react";
import { Globe, Shield, FileText, Menu, X, Clock, LogOut, Compass, FolderOpen, LayoutDashboard, ChartNoAxesCombined, Truck, Plus, ChevronRight, Layers } from "lucide-react";
import { UserTenant } from "../data/usersData";
import BrandLogo from "./BrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import { useI18n } from "../i18n";

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
  const { t } = useI18n();
  const n = t.shell.nav;

  // If client, restrict tabs or adjust labels if needed.
  // Standard navigation links
  const navItems = [
    { id: "sourcing", label: n.sourcing, icon: Globe },
    { id: "logistics", label: n.logistics, icon: Truck },

  ];

  if (currentUser?.role === "admin") {
    navItems.push({ id: "client-discovery", label: n["client-discovery"], icon: Compass });
    navItems.unshift({ id: "overview", label: n.overview, icon: LayoutDashboard });
    navItems.push({ id: "sectors", label: n.sectors, icon: Layers });
    navItems.push({ id: "market-insights", label: n["market-insights"], icon: ChartNoAxesCombined });
  }


  const navigate = (id: string) => {
    setCurrentTab(id);
    setClientMode(id === "client-discovery");
    setMobileMenuOpen(false);
  };

  const activeLabel = navItems.find(item => item.id === currentTab)?.label || t.shell.workspace;
  return <>
    <a href="#workspace-content" className="skip-link">{t.shell.skipToContent}</a>
    <aside className={`workspace-sidebar ${mobileMenuOpen ? "is-open" : ""}`} aria-label={t.shell.sidebarLabel}>
      <div className="sidebar-brand"><BrandLogo size="sm" layout="icon" theme="light" /><div><h1 className="font-display text-lg font-bold tracking-tight text-navy">Trade<span className="text-teal-500">2</span>Turkey</h1><p className="text-[9px] tracking-[.17em] text-slate-500">DIGITAL SOURCING</p></div><button className="ml-auto p-2 lg:hidden" onClick={() => setMobileMenuOpen(false)} aria-label={t.shell.closeMenu}><X className="h-5 w-5" /></button></div>
      <div className="sidebar-project"><label htmlFor="active-project" className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">{t.shell.workspaceLabel}</label><div className="flex items-center gap-2"><FolderOpen className="h-4 w-4 shrink-0 text-teal-700" /><select id="active-project" value={activeProjectId} onChange={e => setActiveProjectId(e.target.value)} className="w-full min-w-0 bg-transparent text-xs font-semibold text-navy">{!projects.length && <option value="">{t.shell.noProject}</option>}{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
      <p className="px-6 pb-3 pt-6 text-[10px] font-semibold uppercase tracking-[.15em] text-slate-400">{t.shell.projectManagement}</p>
      <nav id="workspace-navigation" aria-label={t.shell.mainNavigation} className="space-y-1 px-3">{navItems.map(({ id, label, icon: Icon }) => <button key={id} id={`nav-${id}`} onClick={() => navigate(id)} aria-current={currentTab === id ? "page" : undefined} className={`sidebar-nav ${currentTab === id ? "is-active" : ""}`}><Icon className="h-[18px] w-[18px] shrink-0" /><span>{label}</span>{currentTab === id && <ChevronRight className="ml-auto h-4 w-4" />}</button>)}</nav>
      <div className="mt-auto px-4 pb-5 pt-8">{onOpenNewProjectModal && <button onClick={() => { onOpenNewProjectModal(); setMobileMenuOpen(false); }} className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-xs font-semibold text-white hover:bg-navy-light"><Plus className="h-4 w-4" /> {t.shell.newProject}</button>}<div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4"><p className="flex items-center gap-2 text-xs font-semibold text-teal-800"><Shield className="h-4 w-4" /> {t.shell.privateAccessTitle}</p><p className="mt-2 text-[11px] leading-5 text-slate-500">{t.shell.privateAccessText}</p></div><div className="mt-5 flex items-center gap-2 px-1 text-[10px] text-slate-400"><Clock className="h-3 w-3" /> {t.shell.timezone}<span className="ml-auto">T2T / Workspace</span></div></div>
    </aside>
    {mobileMenuOpen && <button className="sidebar-backdrop" aria-label={t.shell.closeMenu} onClick={() => setMobileMenuOpen(false)} />}
    <header className="workspace-header"><div className="flex min-w-0 items-center gap-3"><button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={t.shell.openMenu} aria-expanded={mobileMenuOpen} aria-controls="workspace-navigation" className="rounded-lg p-2 text-slate-600 lg:hidden"><Menu className="h-5 w-5" /></button><span className="hidden text-xs text-slate-400 sm:inline">{t.shell.workspace}</span><ChevronRight className="hidden h-3 w-3 text-slate-300 sm:block" /><span className="truncate text-xs font-semibold text-navy">{activeLabel}</span></div><div className="flex items-center gap-3"><LanguageSwitcher /><span className="hidden rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-medium text-slate-500 sm:block">{currentUser?.role === "admin" ? t.shell.roleAdmin : t.shell.roleClient}</span>{currentUser && <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy/10 text-[11px] font-bold text-navy">{currentUser.companyName?.slice(0, 2).toUpperCase()}</div><div className="hidden md:block"><div id="user-display-name" className="text-xs font-semibold text-navy">{currentUser.companyName}</div><div id="user-display-email" className="mt-0.5 text-[10px] text-slate-400">{currentUser.email}</div></div></div>}<button id="header-logout-btn" onClick={onLogout} title={t.shell.logout} aria-label={t.shell.logout} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" /></button></div></header>
  </>;
});

export default Navbar;
