import { DEFAULT_BRAND_COLOR } from "./theme-palette";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error type error without @types/node package
import { readFileSync } from "node:fs";
// @ts-expect-error type error without @types/node package
import { resolve } from "node:path";
import App from "./App";

// @ts-expect-error type error without @types/node package
const appCss = readFileSync(resolve(process.cwd(), "src/App.css"), "utf8");

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const category = { id: "other", name: "Other / Uncategorized", description: "", icon: "Package", active: true, sortOrder: 0, retentionDays: null };
const organization = { id: "org-1", name: "Northside Center", organizationType: "Community center", phone: "", email: "", street: "", city: "", region: "", postalCode: "", country: "US", operatingHours: "", locale: "en-US", dateFormat: "MMM d, yyyy", retentionDays: 30, requireVerification: true, allowAnonymousFinders: true, theme: "system" as const, primaryColor: DEFAULT_BRAND_COLOR, logoDataUrl: null };
const storage = { id: "loc-1", name: "Front Desk", description: "", parentId: null, parentName: null, organizationLocationId: null, organizationLocationName: null, secure: false, active: true, sortOrder: 0 };
const secureStorage = { ...storage, id: "loc-secure", name: "Secure cabinet", secure: true };

describe("Reclaim application journeys", () => {
  afterEach(() => { cleanup(); window.localStorage.clear(); });
  let initialized: boolean;
  let organizationSiteActive: boolean;
  let currentTheme: "light" | "dark" | "system";
  beforeEach(() => {
    initialized = false;
    organizationSiteActive = true;
    currentTheme = "system";
    window.localStorage.clear();
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "bootstrap") return { organization: initialized ? { ...organization, theme: currentTheme } : null, categories: [category], storageLocations: initialized ? [storage, secureStorage] : [], stats: { held: 0, openReports: 0, foundToday: 0, returnedPeriod: 0, matchesToReview: 0, retentionReview: 0, disposedPeriod: 0 } };
      if (command === "complete_setup") { initialized = true; return organization; }
      if (command === "update_organization") { currentTheme = (args.organization as typeof organization).theme; return { ...organization, theme: currentTheme }; }
      if (command === "list_found_items") return { items: [], total: 0, page: 1, pageSize: 50 };
      if (command === "list_lost_reports") return [];
      if (command === "list_organization_locations") return [
        { id: "site-1", name: "Main site", street: "10 Main Street", city: "Springfield", region: "MA", postalCode: "01101", country: "United States", active: organizationSiteActive },
        { id: "site-2", name: "North Annex", street: "5 River Road", city: "Springfield", region: "MA", postalCode: "01102", country: "United States", active: true },
      ];
      if (command === "set_organization_location_active") { organizationSiteActive = args.active as boolean; return undefined; }
      if (command === "create_found_item") return { id: "found-1", reference: "RCM-2611-ABC12345", ...(args.input as Record<string, unknown>), categoryName: category.name, storageLocation: storage.name, storageSecure: false, status: "in_custody", retentionDays: null, returnedAt: null, disposedAt: null, createdAt: new Date().toISOString() };
      return undefined;
    });
  });

  it("requires organization and location identity before continuing setup", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Who are we setting up?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("e.g. Northside Community Center"), { target: { value: "Northside Center" } });
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
    fireEvent.click(screen.getAllByRole("button", { name: /continue/i })[screen.getAllByRole("button", { name: /continue/i }).length-1]);
    expect(await screen.findByRole("heading", { name: "Set up your first location" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("returns to the top of the dashboard after completing setup", async () => {
    render(<App />);
    fireEvent.change(await screen.findByPlaceholderText("e.g. Northside Community Center"), { target: { value: "Northside Center" } });
    for (let step = 0; step < 4; step += 1) {
      const continueButtons = screen.getAllByRole("button", { name: /continue/i });
      fireEvent.click(continueButtons[continueButtons.length - 1]);
    }
    expect(await screen.findByRole("heading", { name: "Review your workspace" })).toBeInTheDocument();
    document.documentElement.scrollTop = 400;
    document.body.scrollTop = 400;

    fireEvent.click(screen.getByRole("button", { name: "Open my workspace" }));

    expect(await screen.findByRole("heading", { name: /Good morning, Northside/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.documentElement.scrollTop).toBe(0);
      expect(document.body.scrollTop).toBe(0);
    });
    expect(screen.getByRole("group", { name: "Text and interface size" })).toBeInTheDocument();
  });

  it("opens the dashboard after initialization and presents live operational metrics", async () => {
    initialized = true;
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Good morning, Northside/i })).toBeInTheDocument();
    expect(screen.getByText("Items in custody")).toBeInTheDocument();
    expect(screen.getByText("Latest arrivals")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
  });

  it("offers keyboard-operable text sizing on setup and remembers the preference", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Who are we setting up?" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Text and interface size" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Setup steps" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Step 1: Organization" })).toHaveAttribute("aria-current", "step");
    fireEvent.click(screen.getByRole("button", { name: "Increase text and interface size" }));
    await waitFor(() => expect(window.localStorage.getItem("reclaim.interfaceScale")).toBe("1.3"));
    expect(document.querySelector(".setup-shell")).toHaveStyle({ "--reclaim-ui-scale": "1.3" });
  });

  it("provides text sizing in the main app and restores the saved size", async () => {
    initialized = true;
    window.localStorage.setItem("reclaim.interfaceScale", "1.3");
    const first = render(<App />);
    expect(await screen.findByRole("heading", { name: /Good morning, Northside/i })).toBeInTheDocument();
    expect(document.querySelector(".app-shell")).toHaveStyle({ "--reclaim-ui-scale": "1.3" });
    expect(screen.getByRole("button", { name: "Increase text and interface size" })).toBeDisabled();
    first.unmount();
    render(<App />);
    expect(await screen.findByRole("button", { name: "Decrease text and interface size" })).toBeEnabled();
    expect(document.querySelector(".app-shell")).toHaveStyle({ "--reclaim-ui-scale": "1.3" });
  });

  it("supports arrow-key navigation and a single tab stop for appearance radios in settings", async () => {
    initialized = true;
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Good morning, Northside/i })).toBeInTheDocument();
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
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("update_organization", { organization: expect.objectContaining({ theme: "dark" }) }));
  });

  it("development autofill fills realistic data without submitting the form", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /register found item/i }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
    expect(screen.getByPlaceholderText("e.g. Navy blue water bottle")).toHaveValue("Blue insulated water bottle");
    expect(invokeMock).not.toHaveBeenCalledWith("create_found_item", expect.anything());
  });

  it("autofills the chosen secure-storage scenario without saving it", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /register found item/i }))[0]);
    fireEvent.change(screen.getByRole("combobox", { name: "Autofill scenario" }), { target: { value: "secure-storage" } });
    fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
    expect(screen.getByPlaceholderText("e.g. Navy blue water bottle")).toHaveValue("Smartphone in protective case");
    expect(screen.getByRole("combobox", { name: /Storage location/i })).toHaveValue("loc-secure");
    expect(invokeMock).not.toHaveBeenCalledWith("create_found_item", expect.anything());
  });

  it("keeps the secure-storage scenario blocked when no secure location exists", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "bootstrap") return { organization, categories: [category], storageLocations: [storage], stats: { held: 0, openReports: 0, foundToday: 0, returnedPeriod: 0, matchesToReview: 0, retentionReview: 0, disposedPeriod: 0 } };
      if (command === "list_found_items") return { items: [], total: 0, page: 1, pageSize: 50 };
      if (command === "list_lost_reports") return [];
      return previous(command, args);
    });
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /register found item/i }))[0]);
    fireEvent.change(screen.getByRole("combobox", { name: "Autofill scenario" }), { target: { value: "secure-storage" } });
    fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
    expect(screen.getByRole("combobox", { name: /Storage location/i })).toHaveValue("");
    expect(screen.getByRole("button", { name: /save found item/i })).toBeDisabled();
    expect(invokeMock).not.toHaveBeenCalledWith("create_found_item", expect.anything());
  });

  it("saves a storage location with its selected organization site", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Storage" }));
    fireEvent.click(screen.getAllByRole("button", { name: /add location/i })[0]);
    fireEvent.change(screen.getByPlaceholderText("e.g. Cabinet · Shelf A"), { target: { value: "Pool equipment room" } });
    await screen.findByRole("option", { name: "Main site" });
    fireEvent.change(screen.getByLabelText("Organization site"), { target: { value: "site-1" } });
    expect(screen.getByLabelText("Organization site")).toHaveValue("site-1");
    fireEvent.click(screen.getAllByRole("button", { name: "Add location" }).slice(-1)[0]);
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("save_storage_location", expect.objectContaining({ input: expect.objectContaining({ name: "Pool equipment room", organizationLocationId: "site-1" }) })));
  });

  it("creates organization sites with the complete address and edits every address field", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    const heading = await screen.findByRole("heading", { name: "Organization locations" });
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    const siteForm = within(section!);
    fireEvent.change(siteForm.getByLabelText(/^Location name/), { target: { value: "East campus" } });
    fireEvent.change(siteForm.getByLabelText("Street address"), { target: { value: "25 Cedar Road" } });
    fireEvent.change(siteForm.getByLabelText("City"), { target: { value: "Amherst" } });
    fireEvent.change(siteForm.getByLabelText("State or region"), { target: { value: "MA" } });
    fireEvent.change(siteForm.getByLabelText("Postal code"), { target: { value: "01002" } });
    fireEvent.change(siteForm.getByLabelText("Country"), { target: { value: "United States" } });
    fireEvent.click(siteForm.getByRole("button", { name: "Add organization location" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("save_organization_location", expect.objectContaining({
      input: expect.objectContaining({ name: "East campus", street: "25 Cedar Road", city: "Amherst", region: "MA", postalCode: "01002", country: "United States" }),
    })));

    fireEvent.click(siteForm.getByRole("button", { name: "Edit site Main site" }));
    expect(siteForm.getByLabelText("Postal code")).toHaveValue("01101");
    fireEvent.change(siteForm.getByLabelText("Country"), { target: { value: "USA" } });
    fireEvent.click(siteForm.getByRole("button", { name: "Save location" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("save_organization_location", expect.objectContaining({
      input: expect.objectContaining({ id: "site-1", region: "MA", postalCode: "01101", country: "USA" }),
    })));
    fireEvent.click(siteForm.getByRole("button", { name: "Archive site Main site" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("set_organization_location_active", { id: "site-1", active: false }));
    fireEvent.click(siteForm.getByRole("button", { name: "Restore site Main site" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("set_organization_location_active", { id: "site-1", active: true }));
  });

  it("restores focus to the opener after a re-render and Escape closes the found-item modal", async () => {
    initialized = true;
    const first = render(<App />);
    const opener = (await screen.findAllByRole("button", { name: /register found item/i }))[0];
    opener.focus();
    fireEvent.click(opener);
    expect(await screen.findByRole("dialog", { name: "Register a found item" })).toBeInTheDocument();
    // A parent re-render passes a fresh inline onClose to ModalFrame; the focus
    // restore snapshot must survive it (regression: prior was re-captured
    // inside the dialog, so Escape left focus on document.body).
    first.rerender(<App />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Register a found item" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it("opens the found-item form and submits its validated record to native persistence", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /register found item/i }))[0]);
    fireEvent.change(screen.getByPlaceholderText("e.g. Navy blue water bottle"), { target: { value: "Green water bottle" } });
    fireEvent.click(screen.getByRole("button", { name: /save found item/i }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("create_found_item", expect.objectContaining({ input: expect.objectContaining({ name: "Green water bottle", categoryId: "other", storageLocationId: "loc-1" }) })));
  });

  it("previews, removes, and submits a selected item photo through the native bridge", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /register found item/i }))[0]);
    fireEvent.change(screen.getByLabelText("Choose item photo"), { target: { files: [new File(["photo bytes"], "bottle.png", { type: "image/png" })] } });
    expect(await screen.findByAltText("Selected item photo preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(screen.queryByAltText("Selected item photo preview")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Choose item photo"), { target: { files: [new File(["photo bytes"], "bottle.png", { type: "image/png" })] } });
    await screen.findByAltText("Selected item photo preview");
    fireEvent.change(screen.getByPlaceholderText("e.g. Navy blue water bottle"), { target: { value: "Green water bottle" } });
    fireEvent.click(screen.getByRole("button", { name: /save found item/i }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("import_item_photo", expect.objectContaining({ itemId: "found-1", photoDataUrl: "data:image/png;base64,cGhvdG8gYnl0ZXM=" })));
  });

  it("keeps organization, location and hours, branding, preferences, and review in distinct onboarding steps", async () => {
    render(<App />);
    fireEvent.change(await screen.findByPlaceholderText("e.g. Northside Community Center"), { target: { value: "Northside Center" } });
    fireEvent.click(screen.getAllByRole("button", { name: /continue/i })[screen.getAllByRole("button", { name: /continue/i }).length-1]);
    expect(await screen.findByRole("heading", { name: "Set up your first location" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Main building")).toHaveValue("Main location");
    for (const day of ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]) expect(screen.getByText(day)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Main building"), { target: { value: "North Hall" } });
    fireEvent.click(screen.getAllByRole("button", { name: /continue/i }).slice(-1)[0]);
    expect(await screen.findByRole("heading", { name: "Make this workspace yours" })).toBeInTheDocument();
    const followSystem = screen.getByRole("radio", { name: "Follow System" });
    const darkTheme = screen.getByRole("radio", { name: "Dark" });
    followSystem.focus();
    fireEvent.keyDown(followSystem, { key: "ArrowLeft" });
    expect(darkTheme).toHaveFocus();
    expect(darkTheme).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(document.querySelector(".setup-shell")).toHaveAttribute("data-theme", "dark"));
    fireEvent.click(screen.getAllByRole("button", { name: /continue/i }).slice(-1)[0]);
    expect(await screen.findByRole("heading", { name: "Set your defaults" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /continue/i }).slice(-1)[0]);
    expect(await screen.findByRole("heading", { name: "Review your workspace" })).toBeInTheDocument();
    expect(screen.getByText(/North Hall/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(await screen.findByRole("heading", { name: "Set your defaults" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });
  it("keeps keyboard focus in the item drawer and restores it on close", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    const item = { id:"item-1", reference:"RCM-1", name:"Blue bottle", categoryId:"other", categoryName:"Other", description:"Bottle", color:"blue", brand:"", foundAt:"2026-11-02", foundLocation:"Desk", storageLocationId:"loc-1", storageLocation:"Front Desk", storageSecure:false, finderName:"", finderContact:"", staffNotes:"", status:"in_custody", retentionDays:null, returnedAt:null, disposedAt:null, createdAt:"2026-11-02" };
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => { if(command === "list_found_items") return {items:[item],total:1,page:1,pageSize:50}; if(command === "item_activity" || command === "item_photos") return []; return previous(command,args); });
    render(<App />);
    const itemButton = await screen.findByRole("button", {name:/Blue bottle/i});
    itemButton.focus(); fireEvent.click(itemButton);
    const dialog = await screen.findByRole("dialog", {name:"Details for Blue bottle"});
    const close = within(dialog).getByRole("button", {name:"Close details"});
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, {key:"Tab",shiftKey:true});
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", {name:"Edit details"}));
    expect(await screen.findByRole("dialog", {name:/edit/i})).toBeInTheDocument();
    fireEvent.keyDown(document, {key:"Escape"});
    expect(screen.getByRole("dialog", {name:"Details for Blue bottle"})).toBeInTheDocument();
    fireEvent.keyDown(document, {key:"Escape"});
    expect(screen.queryByRole("dialog", {name:"Details for Blue bottle"})).not.toBeInTheDocument();
    expect(document.activeElement).toBe(itemButton);
  });

  it("announces a successful lost-report update as a status and failures as alerts", async () => {
    initialized = true;
    const previous = invokeMock.getMockImplementation()!;
    const report = {id:"lost-1",reference:"RCL-1",name:"Blue bottle",categoryId:"other",categoryName:"Other",description:"Bottle",color:"blue",brand:"",lostAt:"2026-11-02",lastLocation:"Desk",claimantName:"Alex",contact:"",notes:"",status:"open",createdAt:"2026-11-02"};
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => { if(command === "list_lost_reports") return [report]; if(command === "set_lost_report_status") return undefined; return previous(command,args); });
    render(<App />);fireEvent.click(await screen.findByRole("button", {name:"Lost reports"}));fireEvent.click(await screen.findByRole("button", {name:"Close report"}));
    const status = await screen.findByRole("status");expect(status).toHaveTextContent("Lost report closed.");expect(status).toHaveClass("inline-status");
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => { if(command === "list_lost_reports") return [report]; if(command === "set_lost_report_status") throw new Error("Cannot update"); return previous(command,args); });
    fireEvent.click(screen.getByRole("button", {name:"Close report"}));expect(await screen.findByRole("alert")).toHaveTextContent("Cannot update");
  });

  // jsdom cannot reproduce browser layout, so these guards assert the exact
  // declarations that repair each observed layout defect. The browser-based
  // evidence for each rule is recorded in docs/testing.md.
  describe("stylesheet regression guards", () => {
    it("keeps the drawer custody history from collapsing to a phantom tab stop", () => {
      // Flexbox disables the automatic min-height of scroll containers, so
      // without flex-shrink: 0 the overflow:auto timeline is crushed to zero
      // height (clipped) and becomes an invisible keyboard focus target.
      expect(appCss).toContain(".drawer-timeline { max-height: 185px; overflow: auto; flex-shrink: 0; }");
    });
    it("keeps quick-action labels wrapping inside their grid tracks", () => {
      // minmax(145px,1fr) tracks plus white-space: nowrap forced the dashboard
      // quick-action row past the page edge at moderate widths.
      expect(appCss).toContain("grid-template-columns: minmax(170px,1.03fr) repeat(3,minmax(0,1fr))");
      expect(appCss).toContain(".quick-actions > button { min-width: 0;");
      expect(appCss).toContain(".quick-actions > button strong { font-size: calc(max(12px, 9px) * var(--reclaim-ui-scale, 1)); font-weight: 700; white-space: normal;");
      expect(appCss).toContain(".quick-actions > button small { font-size: calc(max(12px, 8px) * var(--reclaim-ui-scale, 1)); color: var(--text-muted); white-space: normal;");
    });
    it("lets inventory toolbar controls wrap instead of clipping behind the panel edge", () => {
      // The toolbar's fixed-width controls overflowed .full-panel's
      // overflow: hidden, hiding the status filter between 1024 and 1440 px.
      expect(appCss).toContain(".inventory-toolbar { min-height: 62px; padding: 12px 17px; display: flex; flex-wrap: wrap;");
    });
    it("places lost-report actions in the content columns, not the avatar column", () => {
      // Auto-placement dropped .lost-actions into the 35px avatar column
      // between 781 and 1000 px, crushing its buttons.
      expect(appCss).toContain(".lost-actions { grid-column: 2 / -1; justify-self: start; margin-bottom: 10px; }");
    });
    it("keeps selected settings-nav descriptions readable on brand-tinted surfaces", () => {
      // --text-muted sits below 4.5:1 on --brand-soft (the selected item's
      // brand-tinted background); the darker secondary token passes for every
      // curated organization brand (guarded by pnpm check:contrast).
      expect(appCss).toContain(".settings-nav button.selected > small { color: var(--text-secondary); }");
    });
  });

});
