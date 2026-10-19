// Project names are bilingual: `name` is the Turkish name (required), `nameEn` the optional English name.
// Every screen shows a project through projectDisplayName so both languages behave the same everywhere.
import { useI18n, type Lang } from "../i18n";
import { PROJECT_NAMES } from "../data/driveData";

export interface ProjectNames { name?: string; nameEn?: string }

// EN: nameEn, falling back to the Turkish name; TR: the Turkish name. `fallback` when the project has no name at all.
export function projectDisplayName(project: ProjectNames | null | undefined, lang: Lang, fallback = "") {
  const turkish = project?.name?.trim() || "";
  return (lang === "en" ? project?.nameEn?.trim() || turkish : turkish) || fallback;
}
// Upper-casing (CSS `uppercase` or toLocaleUpperCase) follows the interface language, so EN never shows the Turkish "İ".
export const nameLocale = (lang: Lang) => lang === "en" ? "en-US" : "tr-TR";

// Name registry for components that only know a project id (vault, Drive folder, discovery, freelancer views).
// Kept on window and in localStorage; older sessions stored plain strings (the Turkish name), which still read correctly.
const STORAGE_KEY = "t2t_project_names";
type Registry = Record<string, ProjectNames>;
const normalise = (value: unknown): Registry => Object.fromEntries(Object.entries(value && typeof value === "object" ? value as Record<string, unknown> : {}).map(([id, entry]) => [id, typeof entry === "string" ? { name: entry } : (entry ?? {}) as ProjectNames]));
export function rememberProjectNames(projects: ({ id: string } & ProjectNames)[]) {
  const registry: Registry = Object.fromEntries(projects.map(project => [project.id, { name: project.name ?? "", ...(project.nameEn ? { nameEn: project.nameEn } : {}) }]));
  if (typeof window !== "undefined") (window as any).PROJECT_NAMES = registry;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(registry)); } catch { /* private mode: the window copy is enough */ }
}
function registry(): Registry {
  const live = typeof window !== "undefined" ? (window as any).PROJECT_NAMES : undefined;
  if (live) return normalise(live);
  try { return normalise(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")); } catch { return {}; }
}
export const projectNameById = (projectId: string, lang: Lang) => projectDisplayName(registry()[projectId] ?? PROJECT_NAMES[projectId], lang, projectId);
// (projectId) => display name in the current language; re-renders with the language switch.
export function useProjectName() {
  const { lang } = useI18n();
  return (projectId: string) => projectNameById(projectId, lang);
}
