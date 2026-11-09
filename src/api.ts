import { invoke } from "@tauri-apps/api/core";

export type Category = {
  id: string;
  name: string;
  description: string;
  icon: string;
  active: boolean;
  sortOrder: number;
  retentionDays: number | null;
};
export type StorageLocation = {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  parentName: string | null;
  organizationLocationId: string | null;
  organizationLocationName: string | null;
  secure: boolean;
  active: boolean;
  sortOrder: number;
};
export type OrganizationLocation = {
  id: string;
  name: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  active: boolean;
};
export type Organization = {
  id: string;
  name: string;
  organizationType: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  operatingHours: string;
  legacyOperatingHours: string | null;
  locale: string;
  dateFormat: string;
  retentionDays: number;
  requireVerification: boolean;
  allowAnonymousFinders: boolean;
  theme: "light" | "dark" | "system";
  primaryColor: string;
  logoDataUrl: string | null;
  staffName: string;
};
export type SetupInput = Omit<Organization, "id" | "legacyOperatingHours" | "staffName"> & {
  locationName: string;
};
export type FoundItem = {
  id: string;
  reference: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  color: string;
  brand: string;
  foundAt: string;
  foundLocation: string;
  storageLocationId: string;
  storageLocation: string;
  storageSecure: boolean;
  finderName: string;
  finderContact: string;
  staffNotes: string;
  status: "in_custody" | "returned" | "disposed";
  retentionDays: number | null;
  returnedAt: string | null;
  disposedAt: string | null;
  createdAt: string;
};
export type LostReport = {
  id: string;
  reference: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  color: string;
  brand: string;
  lostAt: string;
  lastLocation: string;
  claimantName: string;
  contact: string;
  notes: string;
  status: "open" | "resolved" | "closed";
  createdAt: string;
};
export type LostReportsPage = { reports: LostReport[]; total: number };
export type InventoryPage = { items: FoundItem[]; total: number; page: number; pageSize: number };
export type CompetingClaim = {
  reportId: string;
  reference: string;
  claimantName: string;
  itemName: string;
  status: string;
  score: number;
};
export type MatchCandidate = {
  foundItem: FoundItem;
  score: number;
  explanation: string[];
  reviewStatus: string;
  competingClaims: CompetingClaim[];
};
export type ConfirmedClaim = {
  lostReportId: string;
  reference: string;
  claimantName: string;
};
export type ReturnInput = {
  foundItemId: string;
  lostReportId: string | null;
  recipientName: string;
  verificationMethod: string;
  verificationNote: string;
  staffNote: string;
};
export type DashboardStats = {
  held: number;
  openReports: number;
  foundToday: number;
  returnedPeriod: number;
  matchesToReview: number;
  retentionReview: number;
  disposedPeriod: number;
};
/** The native query returns at most this many reports; the UI says so when the cap binds. */
export const LOST_REPORTS_CAP = 250;
export type RetentionRecord = {
  item: FoundItem;
  reviewDate: string;
  daysRemaining: number;
  eligible: boolean;
};
export type Bootstrap = {
  organization: Organization | null;
  categories: Category[];
  storageLocations: StorageLocation[];
  stats: DashboardStats;
};

export type FoundInput = Pick<
  FoundItem,
  | "name"
  | "categoryId"
  | "description"
  | "color"
  | "brand"
  | "foundAt"
  | "foundLocation"
  | "storageLocationId"
  | "finderName"
  | "finderContact"
  | "staffNotes"
>;
export type LostInput = Pick<
  LostReport,
  | "name"
  | "categoryId"
  | "description"
  | "color"
  | "brand"
  | "lostAt"
  | "lastLocation"
  | "claimantName"
  | "contact"
  | "notes"
>;

export const api = {
  bootstrap: () => invoke<Bootstrap>("bootstrap"),
  completeSetup: (input: SetupInput) => invoke<Organization>("complete_setup", { input }),
  listCategories: (includeArchived = false) =>
    invoke<Category[]>("list_categories", { includeArchived }),
  saveCategory: (input: {
    id?: string;
    name: string;
    description: string;
    icon: string;
    retentionDays: number | null;
  }) => invoke<Category>("save_category", { input }),
  setCategoryActive: (id: string, active: boolean) =>
    invoke<void>("set_category_active", { id, active }),
  reorderCategories: (ids: string[]) => invoke<void>("reorder_categories", { ids }),
  saveStorageLocation: (input: {
    id?: string;
    name: string;
    description: string;
    parentId: string | null;
    secure: boolean;
    organizationLocationId?: string | null;
  }) => invoke<StorageLocation>("save_storage_location", { input }),
  setStorageActive: (id: string, active: boolean) =>
    invoke<void>("set_storage_active", { id, active }),
  listOrganizationLocations: (includeInactive = true) =>
    invoke<OrganizationLocation[]>("list_organization_locations", { includeInactive }),
  saveOrganizationLocation: (input: Omit<OrganizationLocation, "active">) =>
    invoke<OrganizationLocation>("save_organization_location", { input }),
  setOrganizationLocationActive: (id: string, active: boolean) =>
    invoke<void>("set_organization_location_active", { id, active }),
  deleteStorageLocation: (id: string) => invoke<void>("delete_storage_location", { id }),
  listFound: (
    query: string,
    categoryId: string | null,
    storageLocationId: string | null,
    status: string,
    page = 1,
    pageSize = 30,
    dateFrom = "",
    dateTo = "",
  ) =>
    invoke<InventoryPage>("list_found_items", {
      query,
      categoryId,
      storageLocationId,
      status,
      dateFrom,
      dateTo,
      page,
      pageSize,
    }),
  createFound: (input: FoundInput) => invoke<FoundItem>("create_found_item", { input }),
  importPhoto: (itemId: string, photoDataUrl: string) =>
    invoke<{
      id: string;
      relativePath: string;
      thumbnailPath: string | null;
      mimeType: string;
      byteSize: number;
    }>("import_item_photo", { itemId, photoDataUrl }),
  itemPhotos: (itemId: string) =>
    invoke<{ id: string; dataUrl: string }[]>("item_photos", { itemId }),
  itemPhotoPreviews: (itemIds: string[]) =>
    invoke<{ itemId: string; dataUrl: string | null }[]>("item_photo_previews", { itemIds }),
  removePhoto: (photoId: string) => invoke<void>("remove_item_photo", { photoId }),
  updateFound: (id: string, input: FoundInput) =>
    invoke<FoundItem>("update_found_item", { id, input }),
  moveFound: (id: string, storageLocationId: string) =>
    invoke<void>("move_found_item", { id, storageLocationId }),
  returnFound: (input: ReturnInput) => invoke<void>("return_found_item", { input }),
  disposeFound: (id: string, method: string) => invoke<void>("dispose_found_item", { id, method }),
  createLost: (input: LostInput) => invoke<LostReport>("create_lost_report", { input }),
  updateLost: (id: string, input: LostInput) =>
    invoke<LostReport>("update_lost_report", { id, input }),
  setLostStatus: (id: string, status: "open" | "closed") =>
    invoke<void>("set_lost_report_status", { id, status }),
  listLost: (query: string, status: string) =>
    invoke<LostReportsPage>("list_lost_reports", { query, status }),
  matchingCandidates: (lostReportId: string) =>
    invoke<MatchCandidate[]>("matching_candidates", { lostReportId }),
  reviewMatch: (lostReportId: string, foundItemId: string, status: string) =>
    invoke<void>("review_match", { lostReportId, foundItemId, status }),
  adjudicateMatch: (lostReportId: string, foundItemId: string) =>
    invoke<void>("adjudicate_match", { lostReportId, foundItemId }),
  confirmedClaim: (foundItemId: string) =>
    invoke<ConfirmedClaim | null>("confirmed_claim", { foundItemId }),
  itemActivity: (recordType: string, recordId: string) =>
    invoke<
      {
        id: string;
        recordType: string;
        recordId: string;
        eventType: string;
        happenedAt: string;
        staffName: string;
        details: string;
      }[]
    >("item_activity", { recordType, recordId }),
  dashboardStats: () => invoke<DashboardStats>("dashboard_stats"),
  retentionQueue: () => invoke<RetentionRecord[]>("retention_queue"),
  updateOrganization: (organization: Organization) =>
    invoke<Organization>("update_organization", { organization }),
  exportBackup: () =>
    invoke<{
      formatVersion: number;
      schemaVersion: number;
      createdAt: string;
      files: { path: string; sha256: string; size: number }[];
    } | null>("export_backup"),
  restoreBackup: () => invoke<boolean>("restore_backup"),
};

export const emptyStats: DashboardStats = {
  held: 0,
  openReports: 0,
  foundToday: 0,
  returnedPeriod: 0,
  matchesToReview: 0,
  retentionReview: 0,
  disposedPeriod: 0,
};
