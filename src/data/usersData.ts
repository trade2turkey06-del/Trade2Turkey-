export interface UserTenant {
  id: string; // e.g., "client_sofastyle"
  email: string; // e.g., "sofastyle@trade2turkey.com"
  companyName: string;
  role: "client" | "admin" | "freelancer";
  projectId: string; // "PROJE-UNLU MAMÜLLER"
  driveFolderId?: string; // custom Drive folder ID if provided
  driveFolderName: string; // friendly custom Drive folder name mapped
  name?: string;
  displayName?: string;
  onboardingCompleted?: boolean;
  contactPerson?: string;
  title?: string;
  secondaryEmail?: string;
  workPhone?: string;
  cellPhone?: string;
  website?: string;
  assignedProjects?: string[];
  uid?: string;
  status?: string;
}

// Default initial tenant list
export const INITIAL_TENANTS: UserTenant[] = [
  {
    id: "client_sofastyle",
    email: "sofastyle@trade2turkey.com",
    companyName: "SofaStyle Mobilya",
    role: "client",
    projectId: "PROJE-UNLU MAMÜLLER",
    driveFolderName: "PROJE-UNLU MAMÜLLER (Unlu Mamüller Projesi)"
  },
  {
    id: "owner_admin",
    email: "trade2turkey06@gmail.com",
    companyName: "Trade2Turkey Yönetici Paneli",
    role: "admin",
    projectId: "PROJE-UNLU MAMÜLLER", // can toggle between both as owner
    driveFolderName: "Genel Depo Kökü"
  },
  {
    id: "admin_role_user",
    email: "admin@trade2turkey.com",
    companyName: "Trade2Turkey Kurumsal Yönetici",
    role: "admin",
    projectId: "PROJE-UNLU MAMÜLLER",
    driveFolderName: "Genel Depo Kökü"
  },
  {
    id: "freelancer_scouter",
    email: "freelancer@trade2turkey.com",
    companyName: "Wahkr",
    role: "freelancer",
    projectId: "PROJE-UNLU MAMÜLLER",
    driveFolderName: "Freelance Klasörü",
    name: "Zulqarnain Deen",
    displayName: "Zulqarnain Deen"
  }
];

// Offline fallback credential map for demonstration / rapid setup
export const PRESET_CREDENTIALS: Record<string, { password: string; id: string }> = {
  "sofastyle@trade2turkey.com": { password: "sofastyle2026", id: "client_sofastyle" },
  "trade2turkey06@gmail.com": { password: "admin2026", id: "owner_admin" },
  "admin@trade2turkey.com": { password: "admin2026", id: "admin_role_user" },
  "freelancer@trade2turkey.com": { password: "freelancer2026", id: "freelancer_scouter" }
};
