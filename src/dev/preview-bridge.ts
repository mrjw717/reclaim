// Development-only Tauri bridge stub for the browser preview harness.
// Data is fictional and mirrors src/App.test.tsx fixtures. This module is
// imported exclusively by preview.tsx, which is only reachable through
// preview.html during `vite dev`; the production build never includes it.
import { DEFAULT_BRAND_COLOR } from "../theme-palette";

type CommandHandler = (args: Record<string, unknown>) => unknown;

const category = { id: "other", name: "Other / Uncategorized", description: "", icon: "Package", active: true, sortOrder: 0, retentionDays: null };
const drinkware = { id: "drinkware", name: "Drinkware", description: "Bottles and mugs", icon: "Package", active: true, sortOrder: 1, retentionDays: null };
const organization = { id: "org-1", name: "Northside Center", organizationType: "Community center", phone: "", email: "", street: "", city: "", region: "", postalCode: "", country: "US", operatingHours: "", legacyOperatingHours: null, locale: "en-US", dateFormat: "MMM d, yyyy", retentionDays: 30, requireVerification: true, allowAnonymousFinders: true, theme: "system" as const, primaryColor: DEFAULT_BRAND_COLOR, logoDataUrl: null, staffName: "Jordan Lee" };
const storage = { id: "loc-1", name: "Front Desk", description: "", parentId: null, parentName: null, organizationLocationId: null, organizationLocationName: null, secure: false, active: true, sortOrder: 0 };
const secureStorage = { ...storage, id: "loc-secure", name: "Secure cabinet", secure: true };
const longStorage = { ...storage, id: "loc-long", name: "Auditorium back-of-house equipment cupboard beside the loading corridor", description: "Longest plausible label", secure: false, active: true, sortOrder: 2 };

const items = [
  { id: "item-1", reference: "RCM-2611-ABC12345", name: "Blue insulated water bottle", categoryId: "other", categoryName: "Other / Uncategorized", description: "Blue stainless-steel bottle with a small star sticker on the base.", color: "Blue", brand: "HydroPeak", foundAt: "2026-11-02T09:30", foundLocation: "East Gymnasium", storageLocationId: "loc-1", storageLocation: "Front Desk", storageSecure: false, finderName: "Taylor Reed", finderContact: "taylor@example.test", staffNotes: "", status: "in_custody", retentionDays: null, returnedAt: null, disposedAt: null, createdAt: "2026-11-02T09:31:00" },
  { id: "item-2", reference: "RCM-2611-DEF67890", name: "Reading glasses in a black hard case", categoryId: "other", categoryName: "Other / Uncategorized", description: "", color: "", brand: "", foundAt: "2026-11-03T14:05", foundLocation: "Library second floor", storageLocationId: "loc-secure", storageLocation: "Secure cabinet", storageSecure: true, finderName: "", finderContact: "", staffNotes: "", status: "in_custody", retentionDays: null, returnedAt: null, disposedAt: null, createdAt: "2026-11-03T14:06:00" },
];
const reports = [
  { id: "lost-1", reference: "RCL-2611-111111", name: "Blue stainless-steel water bottle", categoryId: "drinkware", categoryName: "Drinkware", description: "Blue bottle with a small star sticker on the base.", color: "Blue", brand: "HydroPeak", lostAt: "2026-11-01T18:00", lastLocation: "East Gymnasium", claimantName: "Taylor Reed", contact: "taylor@example.test", notes: "", status: "open", createdAt: "2026-11-01T18:05:00" },
];
const emptyStats = { held: 2, openReports: 1, foundToday: 0, returnedPeriod: 0, matchesToReview: 0, retentionReview: 1, disposedPeriod: 0 };

const handlers: Record<string, CommandHandler> = {
  bootstrap: () => ({ organization, categories: [category, drinkware], storageLocations: [storage, secureStorage, longStorage], stats: emptyStats }),
  list_found_items: () => ({ items, total: items.length, page: 1, pageSize: 10 }),
  list_lost_reports: () => reports,
  retention_queue: () => [{ item: items[1], reviewDate: "2026-12-03", daysRemaining: 26, eligible: false }],
  item_activity: () => [{ id: "evt-1", recordType: "found_item", recordId: "item-1", eventType: "item_registered", happenedAt: "2026-11-02T09:31:00", staffName: "Jordan Lee", details: "" }],
  item_photos: () => [],
  list_organization_locations: () => [{ id: "site-1", name: "Main site", street: "10 Main Street", city: "Springfield", region: "MA", postalCode: "01101", country: "United States", active: true }],
  dashboard_stats: () => emptyStats,
  matching_candidates: () => [{ foundItem: items[0], score: 82, explanation: ["Category matches", "Color matches", "Location nearby"], reviewStatus: "suggested", competingClaims: [] }],
  list_categories: () => [category, drinkware],
};

// `preview.html?setup=1` renders the first-run onboarding wizard by withholding
// the fixture organization, letting visual/accessibility sweeps exercise the
// setup screens in a plain browser. Development only; no native behavior changes.
handlers.bootstrap = () => ({
  organization: new URLSearchParams(window.location.search).has("setup") ? null : organization,
  categories: [category, drinkware],
  storageLocations: [storage, secureStorage, longStorage],
  stats: emptyStats,
});

export function installPreviewBridge(): void {
  const internals = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ as Record<string, unknown> | undefined;
  if (internals) return; // Real Tauri backend present; leave it alone.
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
    invoke: async (command: string, args: Record<string, unknown> = {}, ) => {
      const handler = handlers[command];
      if (!handler) throw new Error(`Preview bridge has no fixture for command "${command}".`);
      await new Promise((resolve) => setTimeout(resolve, 40)); // Simulate async boundary.
      return handler(args);
    },
    transformCallback: (callback: unknown) => callback,
    metadata: { currentWebview: { windowLabel: "main" }, currentWindow: { label: "main" } },
    plugins: {},
  };
}
