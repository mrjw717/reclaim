import { DEFAULT_BRAND_COLOR } from "./theme-palette";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error type error without @types/node package
import { readFileSync } from "node:fs";
// @ts-expect-error type error without @types/node package
import { resolve } from "node:path";
import App, { resolveGalleryMotion, timeGreeting } from "./App";
import packageJson from "../package.json";

// @ts-expect-error type error without @types/node package
const appCss = readFileSync(resolve(process.cwd(), "src/App.css"), "utf8");

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
const { confirmMock } = vi.hoisted(() => ({ confirmMock: vi.fn(async () => true) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: confirmMock,
  message: vi.fn(async () => undefined),
  open: vi.fn(),
  save: vi.fn(),
}));

const category = {
  id: "other",
  name: "Other / Uncategorized",
  description: "",
  icon: "Package",
  active: true,
  sortOrder: 0,
  retentionDays: null,
};
const foundItem = (id: string, name: string) => ({
  id,
  reference: id.toUpperCase(),
  name,
  categoryId: "other",
  categoryName: "Other",
  description: "",
  color: "",
  brand: "",
  foundAt: "2026-11-02T09:00",
  foundLocation: "Front desk",
  storageLocationId: "loc-1",
  storageLocation: "Front Desk",
  storageSecure: false,
  finderName: "",
  finderContact: "",
  staffNotes: "",
  status: "in_custody",
  retentionDays: null,
  returnedAt: null,
  disposedAt: null,
  createdAt: "2026-11-02T09:00",
});
const organization = {
  id: "org-1",
  name: "Northside Center",
  organizationType: "Community center",
  phone: "",
  email: "",
  street: "",
  city: "",
  region: "",
  postalCode: "",
  country: "US",
  operatingHours: "",
  locale: "en-US",
  dateFormat: "MMM d, yyyy",
  retentionDays: 30,
  requireVerification: true,
  allowAnonymousFinders: true,
  theme: "system" as const,
  primaryColor: DEFAULT_BRAND_COLOR,
  logoDataUrl: null,
};
const storage = {
  id: "loc-1",
  name: "Front Desk",
  description: "",
  parentId: null,
  parentName: null,
  organizationLocationId: null,
  organizationLocationName: null,
  secure: false,
  active: true,
  sortOrder: 0,
};
const secureStorage = { ...storage, id: "loc-secure", name: "Secure cabinet", secure: true };

describe("Reclaim application journeys", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });
  let initialized: boolean;
  let organizationSiteActive: boolean;
  let currentTheme: "light" | "dark" | "system";
  beforeEach(() => {
    initialized = false;
    organizationSiteActive = true;
    currentTheme = "system";
    window.localStorage.clear();
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "bootstrap")
        return {
          organization: initialized ? { ...organization, theme: currentTheme } : null,
          categories: [category],
          storageLocations: initialized ? [storage, secureStorage] : [],
          stats: {
            held: 0,
            openReports: 0,
            foundToday: 0,
            returnedPeriod: 0,
            matchesToReview: 0,
            retentionReview: 0,
            disposedPeriod: 0,
          },
        };
      if (command === "complete_setup") {
        initialized = true;
        return organization;
      }
      if (command === "update_organization") {
        currentTheme = (args.organization as typeof organization).theme;
        return { ...organization, theme: currentTheme };
      }
      if (command === "list_found_items") return { items: [], total: 0, page: 1, pageSize: 50 };
      if (command === "item_photo_previews") return [];
      if (command === "list_lost_reports") return { reports: [], total: 0 };
      if (command === "list_organization_locations")
        return [
          {
            id: "site-1",
            name: "Main site",
            street: "10 Main Street",
            city: "Springfield",
            region: "MA",
            postalCode: "01101",
            country: "United States",
            active: organizationSiteActive,
          },
          {
            id: "site-2",
            name: "North Annex",
            street: "5 River Road",
            city: "Springfield",
            region: "MA",
            postalCode: "01102",
            country: "United States",
            active: true,
          },
        ];
      if (command === "set_organization_location_active") {
        organizationSiteActive = args.active as boolean;
        return undefined;
      }
      if (command === "create_found_item")
        return {
          id: "found-1",
          reference: "RCM-2611-ABC12345",
          ...(args.input as Record<string, unknown>),
          categoryName: category.name,
          storageLocation: storage.name,
          storageSecure: false,
          status: "in_custody",
          retentionDays: null,
          returnedAt: null,
          disposedAt: null,
          createdAt: new Date().toISOString(),
        };
      return undefined;
    });
  });

  it("requires organization and location identity before continuing setup", async () => {
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Who are we setting up?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("e.g. Northside Community Center"), {
      target: { value: "Northside Center" },
    });
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
    fireEvent.click(
      screen.getAllByRole("button", { name: /continue/i })[
        screen.getAllByRole("button", { name: /continue/i }).length - 1
      ],
    );
    expect(
      await screen.findByRole("heading", { name: "Set up your first location" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("returns to the top of the dashboard after completing setup", async () => {
    render(<App />);
    fireEvent.change(await screen.findByPlaceholderText("e.g. Northside Community Center"), {
      target: { value: "Northside Center" },
    });
    for (let step = 0; step < 5; step += 1) {
      const continueButtons = screen.getAllByRole("button", { name: /continue/i });
      fireEvent.click(continueButtons[continueButtons.length - 1]);
    }
    expect(
      await screen.findByRole("heading", { name: "Review your workspace" }),
    ).toBeInTheDocument();
    document.documentElement.scrollTop = 400;
    document.body.scrollTop = 400;

    fireEvent.click(screen.getByRole("button", { name: "Open my workspace" }));

    expect(
      await screen.findByRole("heading", { name: /Good (?:morning|afternoon|evening), Northside/ }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.documentElement.scrollTop).toBe(0);
      expect(document.body.scrollTop).toBe(0);
    });
  });

  it("opens the dashboard after initialization and presents live operational metrics", async () => {
    initialized = true;
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: /Good (?:morning|afternoon|evening), Northside/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Items in custody")).toBeInTheDocument();
    expect(screen.getByText("Latest arrivals")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    // Empty inventory leaves no photo gallery section to fill.
    expect(
      screen.queryByRole("region", { name: "Recently found item photographs" }),
    ).not.toBeInTheDocument();
  });

  it("fills the dashboard gallery with stored photographs and opens the drawer from a card", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "list_found_items")
        return {
          items: [
            foundItem("item-1", "Blue insulated bottle"),
            foundItem("item-2", "Silver keyring"),
          ],
          total: 2,
          page: 1,
          pageSize: 12,
        };
      if (command === "item_photo_previews") {
        expect(args.itemIds).toEqual(["item-1", "item-2"]);
        return [
          { itemId: "item-1", dataUrl: "data:image/jpeg;base64,AAAA" },
          { itemId: "item-2", dataUrl: null },
        ];
      }
      if (command === "item_activity" || command === "item_photos") return [];
      return previous(command, args);
    });
    render(<App />);
    const gallery = await screen.findByRole("region", { name: "Recently found item photographs" });
    const photoCard = within(gallery).getByRole("button", {
      name: "Open details for Blue insulated bottle, Other — In custody",
    });
    await waitFor(() => expect(photoCard.querySelector("img")).not.toBeNull());
    expect(within(photoCard).getByText("In custody")).toBeInTheDocument();
    const placeholderCard = within(gallery).getByRole("button", {
      name: "Open details for Silver keyring, Other — In custody",
    });
    // The placeholder text is CSS-generated (not a DOM text node) so labeled
    // photo cards keep their accessible names aligned with visible labels.
    expect(placeholderCard.querySelector(".item-photo.empty small")).toBeEmptyDOMElement();
    expect(appCss).toContain('.item-photo.empty small::before { content: "No photo"; }');
    fireEvent.click(photoCard);
    expect(
      await screen.findByRole("dialog", { name: "Details for Blue insulated bottle" }),
    ).toBeInTheDocument();
    invokeMock.mockImplementation(previous);
  });

  it("keeps the gallery stationary until cards overflow and hides it for empty inventory", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "list_found_items")
        return {
          items: [foundItem("item-1", "Blue insulated bottle")],
          total: 1,
          page: 1,
          pageSize: 12,
        };
      if (command === "item_photo_previews") return [];
      return previous(command, args);
    });
    render(<App />);
    const gallery = await screen.findByRole("region", { name: "Recently found item photographs" });
    const viewport = gallery.querySelector(".gallery-viewport");
    expect(viewport).not.toBeNull();
    // jsdom cannot reproduce real layout, so widths read as zero and the
    // decision stays "stationary"; the looping decision is unit-tested below.
    expect(viewport!.getAttribute("data-gallery-state")).toBe("stationary");
    expect(gallery.querySelectorAll(".gallery-card").length).toBe(1);
    const card = within(gallery).getByRole("button", {
      name: "Open details for Blue insulated bottle, Other — In custody",
    });
    await waitFor(() => expect(card.querySelector(".item-photo.empty small")).not.toBeNull());
    invokeMock.mockImplementation(previous);
  });

  it("loops the gallery only on overflow and never for reduced motion", () => {
    // jsdom cannot measure layout, so the looping decision stays a pure unit.
    expect(resolveGalleryMotion(700, 800, false)).toBe("stationary");
    expect(resolveGalleryMotion(906, 800, false)).toBe("looping");
    expect(resolveGalleryMotion(1600, 800, false)).toBe("looping");
    expect(resolveGalleryMotion(2000, 800, true)).toBe("stationary");
  });

  it("includes visible sidebar counts in the accessible names of nav links (Label in Name)", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "bootstrap") {
        const base = await previous(command, args);
        return { ...base, stats: { ...base.stats, openReports: 2, retentionReview: 3 } };
      }
      return previous(command, args);
    });
    render(<App />);
    // The count chip is visible text inside the button, so the accessible
    // name must contain it (WCAG 2.5.3); the badge number alone is not enough.
    expect(await screen.findByRole("button", { name: "Lost reports, 2 open" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retention review, 3 due" })).toBeInTheDocument();
    invokeMock.mockImplementation(previous);
  });

  it("switches Found items between list and gallery views while preserving the query, and remembers the choice", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "list_found_items") {
        const query = String(args.query ?? "");
        const matches = [
          foundItem("item-1", "Blue insulated bottle"),
          foundItem("item-2", "Silver keyring"),
        ].filter((item) => !query || item.name.toLowerCase().includes(query.toLowerCase()));
        return { items: matches, total: matches.length, page: 1, pageSize: 10 };
      }
      if (command === "item_photo_previews")
        return (args.itemIds as string[]).map((itemId) => ({
          itemId,
          dataUrl: itemId === "item-1" ? "data:image/jpeg;base64,AAAA" : null,
        }));
      if (command === "item_activity" || command === "item_photos") return [];
      return previous(command, args);
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Found items" }));
    const switcher = await screen.findByRole("radiogroup", { name: "Inventory view" });
    expect(within(switcher).getByRole("radio", { name: "List view" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText("REFERENCE")).toBeInTheDocument();
    // Narrow the query, then switch views: the same filtered fetch serves the gallery.
    fireEvent.change(screen.getByLabelText("Search inventory"), { target: { value: "keyring" } });
    await waitFor(() =>
      expect(invokeMock).toHaveBeenLastCalledWith(
        "list_found_items",
        expect.objectContaining({ query: "keyring" }),
      ),
    );
    fireEvent.click(within(switcher).getByRole("radio", { name: "Gallery view" }));
    expect(within(switcher).getByRole("radio", { name: "Gallery view" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.queryByText("REFERENCE")).not.toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith(
      "list_found_items",
      expect.objectContaining({ query: "keyring" }),
    );
    const gallery = screen.getByRole("region", { name: "Inventory photo gallery" });
    const galleryCard = within(gallery).getByRole("button", {
      name: /^Open details for Silver keyring, Other, .* — In custody$/,
    });
    expect(
      within(gallery).queryByRole("button", {
        name: "Open details for Blue insulated bottle, Other — In custody",
      }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(galleryCard.querySelector(".item-photo.empty small")).not.toBeNull(),
    );
    await waitFor(() =>
      expect(window.localStorage.getItem("reclaim.inventoryView")).toBe("gallery"),
    );
    // The stored preference restores the gallery view on a fresh mount.
    cleanup();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Found items" }));
    const restored = await screen.findByRole("radiogroup", { name: "Inventory view" });
    expect(restored.getAttribute("data-view")).toBe("gallery");
    expect(restored.querySelector('[data-value="gallery"]')).toHaveAttribute("tabindex", "0");
    invokeMock.mockImplementation(previous);
  });

  it("moves the inventory view switcher with arrow keys from a single tab stop", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "list_found_items")
        return {
          items: [foundItem("item-1", "Blue insulated bottle")],
          total: 1,
          page: 1,
          pageSize: 10,
        };
      if (command === "item_activity" || command === "item_photos") return [];
      return previous(command, args);
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Found items" }));
    const switcher = await screen.findByRole("radiogroup", { name: "Inventory view" });
    const listRadio = within(switcher).getByRole("radio", { name: "List view" });
    const galleryRadio = within(switcher).getByRole("radio", { name: "Gallery view" });
    expect(listRadio).toHaveAttribute("tabindex", "0");
    expect(galleryRadio).toHaveAttribute("tabindex", "-1");
    listRadio.focus();
    fireEvent.keyDown(listRadio, { key: "ArrowRight" });
    expect(galleryRadio).toHaveFocus();
    expect(galleryRadio).toHaveAttribute("aria-checked", "true");
    expect(listRadio).toHaveAttribute("aria-checked", "false");
    fireEvent.keyDown(galleryRadio, { key: "ArrowLeft" });
    expect(listRadio).toHaveFocus();
    expect(listRadio).toHaveAttribute("aria-checked", "true");
    invokeMock.mockImplementation(previous);
  });

  it("offers keyboard-operable text sizing on setup and remembers the preference", async () => {
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Who are we setting up?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Text and interface size" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Setup steps" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Step 1: Organization" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    fireEvent.click(screen.getByRole("button", { name: "Increase text and interface size" }));
    await waitFor(() => expect(window.localStorage.getItem("reclaim.interfaceScale")).toBe("1.3"));
    expect(document.querySelector(".setup-shell")).toHaveStyle({ "--reclaim-ui-scale": "1.3" });
  });

  it("provides text sizing in settings appearance and restores the saved size", async () => {
    initialized = true;
    window.localStorage.setItem("reclaim.interfaceScale", "1.3");
    const first = render(<App />);
    expect(
      await screen.findByRole("heading", { name: /Good (?:morning|afternoon|evening), Northside/ }),
    ).toBeInTheDocument();
    expect(document.querySelector(".app-shell")).toHaveStyle({ "--reclaim-ui-scale": "1.3" });
    // The control lives in Settings > Appearance, not the topbar.
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(await screen.findByRole("button", { name: /Appearance/ }));
    expect(
      await screen.findByRole("group", { name: "Text and interface size" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Increase text and interface size" })).toBeDisabled();
    first.unmount();
    render(<App />);
    await screen.findByRole("heading", { name: /Good (?:morning|afternoon|evening), Northside/ });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(await screen.findByRole("button", { name: /Appearance/ }));
    expect(
      await screen.findByRole("button", { name: "Decrease text and interface size" }),
    ).toBeEnabled();
    expect(document.querySelector(".app-shell")).toHaveStyle({ "--reclaim-ui-scale": "1.3" });
  });

  it("supports arrow-key navigation and a single tab stop for appearance radios in settings", async () => {
    initialized = true;
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: /Good (?:morning|afternoon|evening), Northside/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: /Appearance/ }));
    const system = screen.getByRole("radio", { name: /Match device/ });
    const dark = screen.getByRole("radio", { name: /Dark/ });
    expect(system).toHaveAttribute("tabindex", "0");
    expect(dark).toHaveAttribute("tabindex", "-1");
    system.focus();
    fireEvent.keyDown(system, { key: "ArrowLeft" });
    await waitFor(() => expect(dark).toHaveAttribute("aria-checked", "true"));
    expect(document.activeElement).toBe(dark);
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("update_organization", {
        organization: expect.objectContaining({ theme: "dark" }),
      }),
    );
  });

  it("development autofill fills realistic data without submitting the form", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /register found item/i }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
    expect(screen.getByPlaceholderText("e.g. Navy blue water bottle")).toHaveValue(
      "Blue insulated water bottle",
    );
    expect(invokeMock).not.toHaveBeenCalledWith("create_found_item", expect.anything());
  });

  it("autofills the chosen secure-storage scenario without saving it", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /register found item/i }))[0]);
    fireEvent.change(screen.getByRole("combobox", { name: "Autofill scenario" }), {
      target: { value: "secure-storage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
    expect(screen.getByPlaceholderText("e.g. Navy blue water bottle")).toHaveValue(
      "Smartphone in protective case",
    );
    expect(screen.getByRole("combobox", { name: /Storage location/i })).toHaveTextContent(
      "Secure cabinet",
    );
    expect(invokeMock).not.toHaveBeenCalledWith("create_found_item", expect.anything());
  });

  it("keeps the secure-storage scenario blocked when no secure location exists", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "bootstrap")
        return {
          organization,
          categories: [category],
          storageLocations: [storage],
          stats: {
            held: 0,
            openReports: 0,
            foundToday: 0,
            returnedPeriod: 0,
            matchesToReview: 0,
            retentionReview: 0,
            disposedPeriod: 0,
          },
        };
      if (command === "list_found_items") return { items: [], total: 0, page: 1, pageSize: 50 };
      if (command === "item_photo_previews") return [];
      if (command === "list_lost_reports") return { reports: [], total: 0 };
      return previous(command, args);
    });
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /register found item/i }))[0]);
    fireEvent.change(screen.getByRole("combobox", { name: "Autofill scenario" }), {
      target: { value: "secure-storage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
    expect(screen.getByRole("combobox", { name: /Storage location/i })).toHaveTextContent(
      "Choose a storage location",
    );
    expect(screen.getByRole("button", { name: /save found item/i })).toBeDisabled();
    expect(invokeMock).not.toHaveBeenCalledWith("create_found_item", expect.anything());
  });

  it("saves a storage location with its selected organization site", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Storage" }));
    fireEvent.click(screen.getAllByRole("button", { name: /add location/i })[0]);
    fireEvent.change(screen.getByPlaceholderText("e.g. Cabinet · Shelf A"), {
      target: { value: "Pool equipment room" },
    });
    const siteSelect = screen.getByRole("combobox", { name: "Organization site" });
    fireEvent.click(siteSelect);
    fireEvent.click(await screen.findByRole("option", { name: "Main site" }));
    expect(siteSelect).toHaveTextContent("Main site");
    fireEvent.click(screen.getAllByRole("button", { name: "Add location" }).slice(-1)[0]);
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        "save_storage_location",
        expect.objectContaining({
          input: expect.objectContaining({
            name: "Pool equipment room",
            organizationLocationId: "site-1",
          }),
        }),
      ),
    );
  });

  it("styled dropdowns support keyboard selection and escape without changing the value", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Found items" }));
    const trigger = await screen.findByRole("combobox", { name: "Filter by status" });
    // ArrowDown opens with the selected option highlighted; arrows move the highlight; Enter commits.
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const listbox = await screen.findByRole("listbox", { name: "Filter by status" });
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(trigger.getAttribute("aria-activedescendant")).toBe(options[0].id);
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-activedescendant")).toBe(options[1].id);
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger).toHaveTextContent("In custody");
    expect(screen.queryByRole("listbox", { name: "Filter by status" })).not.toBeInTheDocument();
    // Reopening highlights the committed selection; Escape closes without change.
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const reopened = within(
      await screen.findByRole("listbox", { name: "Filter by status" }),
    ).getAllByRole("option");
    expect(reopened[1]).toHaveAttribute("aria-selected", "true");
    expect(trigger.getAttribute("aria-activedescendant")).toBe(reopened[1].id);
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(trigger.getAttribute("aria-activedescendant")).toBe(reopened[1].id);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "Filter by status" })).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("In custody");
  });

  it("creates organization sites with the complete address and edits every address field", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    const heading = await screen.findByRole("heading", { name: "Organization locations" });
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    const siteForm = within(section!);
    fireEvent.change(siteForm.getByLabelText(/^Location name/), {
      target: { value: "East campus" },
    });
    fireEvent.change(siteForm.getByLabelText("Street address"), {
      target: { value: "25 Cedar Road" },
    });
    fireEvent.change(siteForm.getByLabelText("City"), { target: { value: "Amherst" } });
    fireEvent.change(siteForm.getByLabelText("State or region"), { target: { value: "MA" } });
    fireEvent.change(siteForm.getByLabelText("Postal code"), { target: { value: "01002" } });
    fireEvent.change(siteForm.getByLabelText("Country"), { target: { value: "United States" } });
    fireEvent.click(siteForm.getByRole("button", { name: "Add organization location" }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        "save_organization_location",
        expect.objectContaining({
          input: expect.objectContaining({
            name: "East campus",
            street: "25 Cedar Road",
            city: "Amherst",
            region: "MA",
            postalCode: "01002",
            country: "United States",
          }),
        }),
      ),
    );

    fireEvent.click(siteForm.getByRole("button", { name: "Edit site Main site" }));
    expect(siteForm.getByLabelText("Postal code")).toHaveValue("01101");
    fireEvent.change(siteForm.getByLabelText("Country"), { target: { value: "USA" } });
    fireEvent.click(siteForm.getByRole("button", { name: "Save location" }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        "save_organization_location",
        expect.objectContaining({
          input: expect.objectContaining({
            id: "site-1",
            region: "MA",
            postalCode: "01101",
            country: "USA",
          }),
        }),
      ),
    );
    fireEvent.click(siteForm.getByRole("button", { name: "Archive site Main site" }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("set_organization_location_active", {
        id: "site-1",
        active: false,
      }),
    );
    fireEvent.click(siteForm.getByRole("button", { name: "Restore site Main site" }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("set_organization_location_active", {
        id: "site-1",
        active: true,
      }),
    );
  });

  it("restores focus to the opener after a re-render and Escape closes the found-item modal", async () => {
    initialized = true;
    const first = render(<App />);
    const opener = (await screen.findAllByRole("button", { name: /register found item/i }))[0];
    opener.focus();
    fireEvent.click(opener);
    expect(
      await screen.findByRole("dialog", { name: "Register a found item" }),
    ).toBeInTheDocument();
    // A parent re-render passes a fresh inline onClose to ModalFrame; the focus
    // restore snapshot must survive it (regression: prior was re-captured
    // inside the dialog, so Escape left focus on document.body).
    first.rerender(<App />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Register a found item" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it("reports a failed save in the statusbar instead of claiming everything saved", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "create_found_item") throw new Error("database is read-only");
      return previous(command, args);
    });
    render(<App />);
    await screen.findByRole("heading", { name: /Good (?:morning|afternoon|evening)/ });
    expect(screen.getByText(/^All changes saved$/)).toBeInTheDocument();
    // The overview shows the action twice (topbar + quick actions); take one.
    const buttons = screen.getAllByRole("button", { name: /Register found item/i });
    fireEvent.click(buttons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
    fireEvent.click(screen.getByRole("button", { name: "Save found item" }));
    // When the native save fails the status must not claim "All changes saved".
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("database is read-only");
    expect(screen.getByText(/^Last action failed$/)).toBeInTheDocument();
    expect(screen.queryByText(/^All changes saved$/)).not.toBeInTheDocument();
    // Dismissing the error banner (the user's recovery action) restores the
    // truthful saved state; nothing auto-clears the failure behind their back.
    invokeMock.mockImplementation(previous);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
    await waitFor(() => expect(screen.getByText(/^All changes saved$/)).toBeInTheDocument());
  });

  it("only adjudicates a confirmed claim when the native confirm dialog is accepted", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    const lost = {
      id: "lost-9",
      reference: "RCL-9",
      name: "Blue insulated water bottle",
      categoryId: "drinkware",
      categoryName: "Drinkware",
      description: "Blue bottle",
      color: "Blue",
      brand: "",
      lostAt: "2026-11-06T10:00",
      lastLocation: "East Gymnasium",
      claimantName: "Taylor Reed",
      contact: "taylor@example.test",
      notes: "",
      status: "open",
      createdAt: "2026-11-06T10:00",
    };
    const item = {
      id: "item-9",
      reference: "RCM-9",
      name: "Blue insulated water bottle",
      categoryId: "drinkware",
      categoryName: "Drinkware",
      description: "Blue bottle",
      color: "Blue",
      brand: "",
      foundAt: "2026-11-07T09:00",
      foundLocation: "East Gymnasium",
      storageLocationId: "loc-1",
      storageLocation: "Front Desk",
      storageSecure: false,
      finderName: "",
      finderContact: "",
      staffNotes: "",
      status: "in_custody",
      retentionDays: null,
      returnedAt: null,
      disposedAt: null,
      createdAt: "2026-11-07T09:00",
    };
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "list_lost_reports") return { reports: [lost], total: 1 };
      if (command === "matching_candidates")
        return [
          {
            foundItem: item,
            score: 91,
            explanation: ["Category matches"],
            reviewStatus: "suggested",
            competingClaims: [],
          },
        ];
      return previous(command, args);
    });
    render(<App />);
    await screen.findByRole("heading", { name: /Good (?:morning|afternoon|evening)/ });
    fireEvent.click(screen.getByRole("button", { name: "Lost reports" }));
    fireEvent.click(await screen.findByRole("button", { name: "Review matches" }));
    // Declining the native confirmation must not write the adjudication.
    confirmMock.mockResolvedValueOnce(false);
    fireEvent.click(await screen.findByRole("button", { name: /Select this claim/i }));
    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(invokeMock).toHaveBeenCalledWith("matching_candidates", { lostReportId: "lost-9" });
    expect(invokeMock).not.toHaveBeenCalledWith("adjudicate_match", {
      foundItemId: "item-9",
      lostReportId: "lost-9",
    });
    confirmMock.mockResolvedValueOnce(true);
    fireEvent.click(await screen.findByRole("button", { name: /Select this claim/i }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("adjudicate_match", {
        foundItemId: "item-9",
        lostReportId: "lost-9",
      }),
    );
    invokeMock.mockImplementation(previous);
  });

  it("surfaces a native adjudication rejection as an alert and keeps the suggestion selectable", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    const lost = {
      id: "lost-10",
      reference: "RCL-10",
      name: "Blue insulated water bottle",
      categoryId: "drinkware",
      categoryName: "Drinkware",
      description: "Blue bottle",
      color: "Blue",
      brand: "",
      lostAt: "2026-11-06T10:00",
      lastLocation: "East Gymnasium",
      claimantName: "Taylor Reed",
      contact: "taylor@example.test",
      notes: "",
      status: "open",
      createdAt: "2026-11-06T10:00",
    };
    const item = {
      id: "item-10",
      reference: "RCM-10",
      name: "Blue insulated water bottle",
      categoryId: "drinkware",
      categoryName: "Drinkware",
      description: "Blue bottle",
      color: "Blue",
      brand: "",
      foundAt: "2026-11-07T09:00",
      foundLocation: "East Gymnasium",
      storageLocationId: "loc-1",
      storageLocation: "Front Desk",
      storageSecure: false,
      finderName: "",
      finderContact: "",
      staffNotes: "",
      status: "in_custody",
      retentionDays: null,
      returnedAt: null,
      disposedAt: null,
      createdAt: "2026-11-07T09:00",
    };
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "list_lost_reports") return { reports: [lost], total: 1 };
      if (command === "matching_candidates")
        return [
          {
            foundItem: item,
            score: 91,
            explanation: ["Category matches"],
            reviewStatus: "suggested",
            competingClaims: [],
          },
        ];
      if (command === "adjudicate_match")
        throw new Error("The found item is no longer in custody.");
      return previous(command, args);
    });
    render(<App />);
    await screen.findByRole("heading", { name: /Good (?:morning|afternoon|evening)/ });
    fireEvent.click(screen.getByRole("button", { name: "Lost reports" }));
    fireEvent.click(await screen.findByRole("button", { name: "Review matches" }));
    // A stale view submits an adjudication the native layer rejects (for
    // example the item was returned elsewhere): the dialog still completes,
    // the failure is announced in the dialog, and the suggestion stays.
    fireEvent.click(await screen.findByRole("button", { name: /Select this claim/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The found item is no longer in custody.");
    expect(screen.getByRole("button", { name: /Select this claim/i })).toBeInTheDocument();
    invokeMock.mockImplementation(previous);
  });

  it("saves overnight operating hours and blocks ambiguous equal times", async () => {
    const clickContinue = () => {
      const buttons = screen.getAllByRole("button", { name: /continue/i });
      fireEvent.click(buttons[buttons.length - 1]);
    };
    render(<App />);
    await screen.findByRole("heading", { name: "Who are we setting up?" });
    fireEvent.change(screen.getByPlaceholderText("e.g. Northside Community Center"), {
      target: { value: "Northside Center" },
    });
    clickContinue();
    await screen.findByRole("heading", { name: "Set up your first location" });
    fireEvent.change(screen.getByLabelText(/Location name/), {
      target: { value: "Main building" },
    });
    clickContinue();
    await screen.findByRole("heading", { name: "Set your operating hours" });
    const hours = within(screen.getByRole("region", { name: "Weekly operating hours" }));
    const fridayOpens = hours.getByLabelText("Friday opening time") as HTMLInputElement;
    const fridayCloses = hours.getByLabelText("Friday closing time") as HTMLInputElement;
    // A closing time earlier than opening needs the overnight flag.
    fireEvent.change(fridayCloses, { target: { value: "02:00" } });
    expect(hours.getByRole("alert")).toHaveTextContent(
      "Closing time must be later than opening time, or mark overnight.",
    );
    {
      const buttons = screen.getAllByRole("button", { name: /continue/i });
      expect(buttons[buttons.length - 1]).toBeDisabled();
    }
    const fridayRow = within(hours.getByText("Friday").parentElement as HTMLElement);
    fireEvent.click(fridayRow.getByRole("checkbox", { name: /closes next day/i }));
    expect(hours.queryByRole("alert")).not.toBeInTheDocument();
    {
      const buttons = screen.getAllByRole("button", { name: /continue/i });
      expect(buttons[buttons.length - 1]).toBeEnabled();
    }
    // Equal open/close times stay ambiguous in both modes.
    fireEvent.change(fridayOpens, { target: { value: "02:00" } });
    expect(hours.getByRole("alert")).toHaveTextContent(
      "An overnight close time must be earlier than the opening time",
    );
    {
      const buttons = screen.getAllByRole("button", { name: /continue/i });
      expect(buttons[buttons.length - 1]).toBeDisabled();
    }
    fireEvent.change(fridayCloses, { target: { value: "01:00" } });
    expect(hours.queryByRole("alert")).not.toBeInTheDocument();
    // Review step renders the overnight interval with an explicit next-day mark.
    clickContinue();
    clickContinue();
    clickContinue();
    expect(await screen.findByText(/Fri .*next day/)).toBeInTheDocument();
  });

  it("opens the found-item form and submits its validated record to native persistence", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /register found item/i }))[0]);
    fireEvent.change(screen.getByPlaceholderText("e.g. Navy blue water bottle"), {
      target: { value: "Green water bottle" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save found item/i }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        "create_found_item",
        expect.objectContaining({
          input: expect.objectContaining({
            name: "Green water bottle",
            categoryId: "other",
            storageLocationId: "loc-1",
          }),
        }),
      ),
    );
  });

  it("previews, removes, and submits a selected item photo through the native bridge", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /register found item/i }))[0]);
    fireEvent.change(screen.getByLabelText("Choose item photo"), {
      target: { files: [new File(["photo bytes"], "bottle.png", { type: "image/png" })] },
    });
    expect(await screen.findByAltText("Selected item photo preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(screen.queryByAltText("Selected item photo preview")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Choose item photo"), {
      target: { files: [new File(["photo bytes"], "bottle.png", { type: "image/png" })] },
    });
    await screen.findByAltText("Selected item photo preview");
    fireEvent.change(screen.getByPlaceholderText("e.g. Navy blue water bottle"), {
      target: { value: "Green water bottle" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save found item/i }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        "import_item_photo",
        expect.objectContaining({
          itemId: "found-1",
          photoDataUrl: "data:image/png;base64,cGhvdG8gYnl0ZXM=",
        }),
      ),
    );
  });

  it("keeps organization, location and hours, branding, preferences, and review in distinct onboarding steps", async () => {
    render(<App />);
    fireEvent.change(await screen.findByPlaceholderText("e.g. Northside Community Center"), {
      target: { value: "Northside Center" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: /continue/i })[
        screen.getAllByRole("button", { name: /continue/i }).length - 1
      ],
    );
    expect(
      await screen.findByRole("heading", { name: "Set up your first location" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Main building")).toHaveValue("Main location");
    fireEvent.change(screen.getByPlaceholderText("Main building"), {
      target: { value: "North Hall" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /continue/i }).slice(-1)[0]);
    expect(
      await screen.findByRole("heading", { name: "Set your operating hours" }),
    ).toBeInTheDocument();
    for (const day of [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ])
      expect(screen.getByText(day)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /continue/i }).slice(-1)[0]);
    expect(
      await screen.findByRole("heading", { name: "Make this workspace yours" }),
    ).toBeInTheDocument();
    const followSystem = screen.getByRole("radio", { name: "Follow System" });
    const darkTheme = screen.getByRole("radio", { name: "Dark" });
    followSystem.focus();
    fireEvent.keyDown(followSystem, { key: "ArrowLeft" });
    expect(darkTheme).toHaveFocus();
    expect(darkTheme).toHaveAttribute("aria-checked", "true");
    await waitFor(() =>
      expect(document.querySelector(".setup-shell")).toHaveAttribute("data-theme", "dark"),
    );
    fireEvent.click(screen.getAllByRole("button", { name: /continue/i }).slice(-1)[0]);
    expect(await screen.findByRole("heading", { name: "Set your defaults" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /continue/i }).slice(-1)[0]);
    expect(
      await screen.findByRole("heading", { name: "Review your workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/North Hall/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(await screen.findByRole("heading", { name: "Set your defaults" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });
  it("keeps keyboard focus in the item drawer and restores it on close", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    const item = {
      id: "item-1",
      reference: "RCM-1",
      name: "Blue bottle",
      categoryId: "other",
      categoryName: "Other",
      description: "Bottle",
      color: "blue",
      brand: "",
      foundAt: "2026-11-02",
      foundLocation: "Desk",
      storageLocationId: "loc-1",
      storageLocation: "Front Desk",
      storageSecure: false,
      finderName: "",
      finderContact: "",
      staffNotes: "",
      status: "in_custody",
      retentionDays: null,
      returnedAt: null,
      disposedAt: null,
      createdAt: "2026-11-02",
    };
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "list_found_items") return { items: [item], total: 1, page: 1, pageSize: 50 };
      if (command === "item_activity" || command === "item_photos") return [];
      return previous(command, args);
    });
    render(<App />);
    // The dashboard table row and its gallery card share the item name, so
    // pick the first matching control (the table row in DOM order).
    const itemButton = (await screen.findAllByRole("button", { name: /Blue bottle/i }))[0];
    itemButton.focus();
    fireEvent.click(itemButton);
    const dialog = await screen.findByRole("dialog", { name: "Details for Blue bottle" });
    const close = within(dialog).getByRole("button", { name: "Close details" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Edit details" }));
    expect(await screen.findByRole("dialog", { name: /edit/i })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Details for Blue bottle" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Details for Blue bottle" }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(itemButton);
  });

  it("announces a successful lost-report update as a status and failures as alerts", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    const report = {
      id: "lost-1",
      reference: "RCL-1",
      name: "Blue bottle",
      categoryId: "other",
      categoryName: "Other",
      description: "Bottle",
      color: "blue",
      brand: "",
      lostAt: "2026-11-02",
      lastLocation: "Desk",
      claimantName: "Alex",
      contact: "",
      notes: "",
      status: "open",
      createdAt: "2026-11-02",
    };
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "list_lost_reports") return { reports: [report], total: 1 };
      if (command === "set_lost_report_status") return undefined;
      return previous(command, args);
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Lost reports" }));
    fireEvent.click(await screen.findByRole("button", { name: "Close report" }));
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Lost report closed.");
    expect(status).toHaveClass("inline-status");
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "list_lost_reports") return { reports: [report], total: 1 };
      if (command === "set_lost_report_status") throw new Error("Cannot update");
      return previous(command, args);
    });
    fireEvent.click(screen.getByRole("button", { name: "Close report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot update");
  });

  it("greets by time of day from a pure, testable decision", () => {
    expect(timeGreeting(5)).toBe("Good morning");
    expect(timeGreeting(12)).toBe("Good afternoon");
    expect(timeGreeting(18)).toBe("Good evening");
  });

  it("focuses the inventory search with Ctrl+K, navigating there from other views", async () => {
    initialized = true;
    render(<App />);
    await screen.findByRole("heading", { name: /Good (?:morning|afternoon|evening)/ });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Search inventory")),
    );
    expect(invokeMock).toHaveBeenCalledWith(
      "list_found_items",
      expect.objectContaining({ query: "" }),
    );
  });

  it("clears every inventory filter from the empty state in one action", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "list_found_items") return { items: [], total: 0, page: 1, pageSize: 10 };
      return previous(command, args);
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Found items" }));
    const trigger = await screen.findByRole("combobox", { name: "Filter by status" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    await waitFor(() =>
      expect(invokeMock).toHaveBeenLastCalledWith(
        "list_found_items",
        expect.objectContaining({ status: "in_custody" }),
      ),
    );
    fireEvent.click(await screen.findByRole("button", { name: /Clear filters/i }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenLastCalledWith(
        "list_found_items",
        expect.objectContaining({
          status: "all",
          query: "",
          dateFrom: "",
          dateTo: "",
          categoryId: null,
          storageLocationId: null,
        }),
      ),
    );
    invokeMock.mockImplementation(previous);
  });

  it("does not carry an inventory status filter into lost reports", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "list_lost_reports") return { reports: [], total: 0 };
      return previous(command, args);
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Found items" }));
    const trigger = await screen.findByRole("combobox", { name: "Filter by status" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    await waitFor(() =>
      expect(invokeMock).toHaveBeenLastCalledWith(
        "list_found_items",
        expect.objectContaining({ status: "in_custody" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lost reports" }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenLastCalledWith(
        "list_lost_reports",
        expect.objectContaining({ status: "all" }),
      ),
    );
    invokeMock.mockImplementation(previous);
  });

  it("shows the app version from package.json as the single source", async () => {
    initialized = true;
    render(<App />);
    await screen.findByRole("heading", { name: /Good (?:morning|afternoon|evening)/ });
    const versionLabel = screen.getByText(
      (_, element) =>
        element?.tagName === "SPAN" && /^Reclaim desktop/.test(element.textContent ?? ""),
    );
    expect(versionLabel.textContent).toContain(`v${packageJson.version}`);
  });

  it("renders a single-organization sidebar identity without dropdown affordances", async () => {
    initialized = true;
    render(<App />);
    await screen.findByRole("heading", { name: /Good (?:morning|afternoon|evening), Northside/ });
    const identity = document.querySelector(".workspace-identity");
    expect(identity).not.toBeNull();
    expect(identity!.querySelector("button")).toBeNull();
    expect(identity!.textContent).toContain("Northside Center");
    expect(identity!.textContent).not.toContain("Local workspace");
    // Reclaim targets one local workspace: no multi-org dropdown chrome.
    expect(
      screen.queryByRole("button", { name: "Open organization settings" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Offline ready")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Help/ })).not.toBeInTheDocument();
    // Settings stays reachable from the persistent navigation.
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  // jsdom cannot reproduce browser layout, so these guards assert the exact
  // declarations that repair each observed layout defect. The browser-based
  // evidence for each rule is recorded in docs/testing.md.
  describe("stylesheet regression guards", () => {
    it("keeps the drawer custody history from collapsing to a phantom tab stop", () => {
      // Flexbox disables the automatic min-height of scroll containers, so
      // without flex-shrink: 0 the overflow:auto timeline is crushed to zero
      // height (clipped) and becomes an invisible keyboard focus target.
      expect(appCss).toContain(
        ".drawer-timeline { max-height: 185px; overflow: auto; flex-shrink: 0; }",
      );
    });
    it("keeps the item drawer a fixed column with sticky header, bounded body, and pinned footer", () => {
      // The drawer is three zones: header (identity + status) and footer
      // (custody actions) never scroll; .drawer-body is the single scroll
      // container, bounded by min-height: 0 so the whole bar can never
      // scroll and actions stay reachable without scrolling.
      expect(appCss).toContain(".item-drawer { overflow: hidden;");
      expect(appCss).toContain(".drawer-head { flex: 0 0 auto;");
      expect(appCss).toContain(".drawer-body { flex: 1 1 auto; min-height: 0; overflow-y: auto;");
      expect(appCss).toContain(".drawer-foot { flex: 0 0 auto;");
    });
    it("shows the stored photo in the drawer header and keeps custody history collapsed by default", () => {
      // The header identity block prefers the stored photograph over the
      // category icon; custody history is a collapsed disclosure (toggle with
      // aria-expanded + entry count) so the drawer body is not a data dump.
      expect(appCss).toContain(
        ".drawer-item-photo { width: 44px; height: 44px; flex: 0 0 44px; object-fit: cover;",
      );
      expect(appCss).toContain(".drawer-history-toggle { width: 100%;");
      expect(appCss).toContain(
        '.drawer-history-toggle[aria-expanded="true"] > .drawer-history-meta > svg { transform: rotate(180deg); }',
      );
    });
    it("keeps quick-action labels wrapping inside their grid tracks", () => {
      // minmax(145px,1fr) tracks plus white-space: nowrap forced the dashboard
      // quick-action row past the page edge at moderate widths.
      expect(appCss).toContain(
        "grid-template-columns: minmax(170px,1.03fr) repeat(3,minmax(0,1fr))",
      );
      expect(appCss).toContain(".quick-actions > button { min-width: 0;");
      expect(appCss).toContain(
        ".quick-actions > button strong { font-size: calc(max(12px, 9px) * var(--reclaim-ui-scale, 1)); font-weight: 700; white-space: normal;",
      );
      expect(appCss).toContain(
        ".quick-actions > button small { font-size: calc(max(12px, 8px) * var(--reclaim-ui-scale, 1)); color: var(--text-muted); white-space: normal;",
      );
    });
    it("lets inventory toolbar controls wrap instead of clipping behind the panel edge", () => {
      // The toolbar's fixed-width controls overflowed .full-panel's
      // overflow: hidden, hiding the status filter between 1024 and 1440 px.
      expect(appCss).toContain(
        ".inventory-toolbar { min-height: 62px; padding: 12px 17px; display: flex; flex-wrap: wrap;",
      );
    });
    it("places lost-report actions in the content columns, not the avatar column", () => {
      // Auto-placement dropped .lost-actions into the 35px avatar column
      // between 781 and 1000 px, crushing its buttons.
      expect(appCss).toContain(
        ".lost-actions { grid-column: 2 / -1; justify-self: start; margin-bottom: 10px; }",
      );
    });
    it("keeps selected settings-nav descriptions readable on brand-tinted surfaces", () => {
      // --text-muted sits below 4.5:1 on --brand-soft (the selected item's
      // brand-tinted background); the darker secondary token passes for every
      // curated organization brand (guarded by pnpm check:contrast).
      expect(appCss).toContain(
        ".settings-nav button.selected > small { color: var(--text-secondary); }",
      );
    });
    it("shows the supplied SVG brand lockup with a brand-color-reactive mark", () => {
      // The user-supplied reclaim icon + wordmark SVGs are inlined as the
      // brand lockup; the mark's fill is currentColor so the teal follows
      // var(--brand-primary), and the wordmark text follows the text tokens.
      expect(appCss).toContain(
        ".lockup-mark { display: inline-flex; color: var(--brand-primary); }",
      );
      expect(appCss).toContain(
        ".lockup-word { display: inline-flex; color: var(--text-primary); }",
      );
      expect(appCss).toContain(".brand-lockup .lockup-word { display: none; }");
    });
    it("makes the dashboard content column fill the page and anchors quick actions at the bottom", () => {
      // The dashboard is a flex column filling .page-content; the photo
      // gallery absorbs leftover height (flex: 1 1 auto) and quick actions
      // stick to the bottom edge instead of leaving a tall empty gap.
      expect(appCss).toContain(
        ".dashboard-layout { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }",
      );
      expect(appCss).toContain(".dashboard-layout > .quick-actions { margin-top: auto; }");
      expect(appCss).toContain(".gallery-panel { flex: 1 1 auto; min-height: 228px;");
      expect(appCss).toContain(
        ".item-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }",
      );
    });
    it("keeps the app chrome fixed and the overview height-capped with internal scrolling", () => {
      // The shell is a bounded 100vh column: topbar, heading, and statusbar
      // never scroll. Views render in .view-region, the only page-level
      // scroll container. Overview summary panels are height-capped so their
      // tables/list scroll internally and the screen fits without page scroll.
      expect(appCss).toContain(
        ".main-shell { min-width: 0; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }",
      );
      expect(appCss).toContain(".view-region { flex: 1 1 auto; min-height: 0; overflow-y: auto;");
      expect(appCss).toContain(
        ".inventory-panel { height: 228px; display: flex; flex-direction: column; overflow: hidden; }",
      );
      expect(appCss).toContain(
        ".inventory-panel .item-table { flex: 1 1 auto; min-height: 0; overflow-y: auto; }",
      );
      expect(appCss).toContain(
        ".attention-panel .report-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; }",
      );
    });
    it("keeps overview panels free of kickers and subheadings with brand-themed icons", () => {
      // The owner removed the panel kickers and subheadings; metric and
      // quick-action icons follow the organization brand tokens, and quick
      // action descriptions hold a two-line minimum height.
      expect(appCss).toContain(
        ".metric-icon { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: var(--brand-soft); color: var(--brand-accent); }",
      );
      expect(appCss).toContain(
        ".quick-icon { width: 32px; height: 32px; flex: 0 0 32px; display: grid; place-items: center; border-radius: 10px; background: var(--brand-soft); color: var(--brand-accent); }",
      );
      expect(appCss).toContain(
        ".quick-actions > button small { font-size: calc(max(12px, 8px) * var(--reclaim-ui-scale, 1)); color: var(--text-muted); white-space: normal; overflow-wrap: anywhere; line-height: 1.45; min-height: calc(2 * 1.45em); display: block; }",
      );
      expect(appCss).not.toContain(".metric-icon.sand");
      expect(appCss).not.toContain(".quick-icon.green");
    });
    it("keeps storage and retention tables scrolling within full-height panels", () => {
      // The pages fill the view height; their tables scroll internally instead
      // of scrolling the page.
      expect(appCss).toContain(
        ".storage-layout { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }",
      );
      expect(appCss).toContain(
        ".storage-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 0 19px; }",
      );
      expect(appCss).toContain(
        ".retention-layout { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 15px; }",
      );
      expect(appCss).toContain(
        ".retention-layout .full-panel .item-table { flex: 1 1 auto; min-height: 0; overflow-y: auto; }",
      );
    });
    it("sticks the settings navigation to the top of its layout", () => {
      expect(appCss).toContain(".settings-nav { position: sticky; top: 0;");
    });

    it("drops the sidebar policy card", () => {
      // Removed on user request: the private-local-storage pitch was noise in
      // the persistent navigation column.
      expect(appCss).not.toContain(".policy-card {");
      expect(appCss).toContain(".sidebar-bottom { margin-top: auto; }");
    });
    it("shows photo thumbnails in data rows and follows the list alignment standard", () => {
      // Rows show the stored photo when available (bulk preview fetch) with
      // the category icon as fallback; date and status columns align right
      // in both header and cells; storage renders as one full-width list.
      expect(appCss).toContain(
        ".item-thumb { width: 31px; height: 31px; flex: 0 0 31px; object-fit: cover; border-radius: 9px;",
      );
      expect(appCss).toContain(
        ".inventory-table .item-row .date-cell { justify-self: end; text-align: right; }",
      );
      expect(appCss).toContain(
        ".inventory-table .item-row > span:last-child { justify-self: end; }",
      );
      expect(appCss).toContain(
        ".storage-layout { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }",
      );
    });
    it("pauses the looping gallery for pointer and keyboard interaction and honors reduced motion", () => {
      // A continuous marquee must not run while a user is reading, hovering,
      // or tabbing through its cards, and must not animate at all for
      // prefers-reduced-motion users, whose viewport scrolls natively.
      expect(appCss).toContain(".gallery-viewport:hover .gallery-track.is-looping");
      expect(appCss).toContain(".gallery-viewport:focus-within .gallery-track.is-looping");
      expect(appCss).toContain(
        "@media (prefers-reduced-motion: reduce) {\n  .gallery-track.is-looping { animation: none; will-change: auto; }",
      );
      expect(appCss).toContain(".gallery-viewport { overflow-x: auto; }");
    });
    it("grows the inventory content region without stretching rows or pinning pagination wrongly", () => {
      // The Found items panel is a flex column filling .page-content: the
      // table region grows while rows keep their own heights (min-height on
      // .item-row is unchanged), and the pagination row anchors to the panel
      // bottom instead of floating mid-panel under tall viewports.
      expect(appCss).toContain(
        ".inventory-screen { flex: 1 1 auto; display: flex; flex-direction: column; }",
      );
      expect(appCss).toContain(
        ".inventory-screen .item-table { flex: 1 1 auto; min-height: 0; overflow-y: auto; }",
      );
      expect(appCss).toContain(".inventory-screen .pagination { margin-top: auto; }");
      expect(appCss).toContain(
        ".inventory-gallery { flex: 1 1 auto; min-height: 0; overflow-y: auto;",
      );
      expect(appCss).toContain("grid-template-columns: repeat(auto-fill, minmax(212px, 1fr));");
    });
    it("styles the view switcher as an announced two-state control", () => {
      // aria-checked carries the selected view for assistive technology;
      // the selected radio keeps brand-colored text, never color alone
      // (the control also carries an icon plus a visible text label).
      expect(appCss).toContain(
        ".view-switcher button.selected { background: var(--surface-primary); color: var(--brand-accent); box-shadow: var(--shadow-control); }",
      );
    });
  });
});
