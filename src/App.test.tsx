import { DEFAULT_BRAND_COLOR } from "./theme-palette";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const category = { id: "other", name: "Other / Uncategorized", description: "", icon: "Package", active: true, sortOrder: 0, retentionDays: null };
const organization = { id: "org-1", name: "Northside Center", organizationType: "Community center", phone: "", email: "", street: "", city: "", region: "", postalCode: "", country: "US", operatingHours: "", locale: "en-US", dateFormat: "MMM d, yyyy", retentionDays: 30, requireVerification: true, allowAnonymousFinders: true, theme: "system" as const, primaryColor: DEFAULT_BRAND_COLOR, logoDataUrl: null };
const storage = { id: "loc-1", name: "Front Desk", description: "", parentId: null, parentName: null, secure: false, active: true, sortOrder: 0 };

describe("Reclaim application journeys", () => {
  afterEach(() => cleanup());
  let initialized: boolean;
  beforeEach(() => {
    initialized = false;
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "bootstrap") return { organization: initialized ? organization : null, categories: [category], storageLocations: initialized ? [storage] : [], stats: { held: 0, openReports: 0, foundToday: 0, returnedPeriod: 0, matchesToReview: 0, retentionReview: 0, disposedPeriod: 0 } };
      if (command === "complete_setup") { initialized = true; return organization; }
      if (command === "list_found_items") return { items: [], total: 0, page: 1, pageSize: 50 };
      if (command === "list_lost_reports") return [];
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

  it("opens the dashboard after initialization and presents live operational metrics", async () => {
    initialized = true;
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Good morning, Northside/i })).toBeInTheDocument();
    expect(screen.getByText("Items in custody")).toBeInTheDocument();
    expect(screen.getByText("Latest arrivals")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
  });

  it("development autofill fills realistic data without submitting the form", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /register found item/i }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Autofill Test Data" }));
    expect(screen.getByPlaceholderText("e.g. Navy blue water bottle")).toHaveValue("Blue insulated water bottle");
    expect(invokeMock).not.toHaveBeenCalledWith("create_found_item", expect.anything());
  });

  it("opens the found-item form and submits its validated record to native persistence", async () => {
    initialized = true;
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /register found item/i }))[0]);
    fireEvent.change(screen.getByPlaceholderText("e.g. Navy blue water bottle"), { target: { value: "Green water bottle" } });
    fireEvent.click(screen.getByRole("button", { name: /save found item/i }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("create_found_item", expect.objectContaining({ input: expect.objectContaining({ name: "Green water bottle", categoryId: "other", storageLocationId: "loc-1" }) })));
  });

  it("shows all seven configurable days and applies theme choice during onboarding", async () => {
    render(<App />);
    fireEvent.change(await screen.findByPlaceholderText("e.g. Northside Community Center"), { target: { value: "Northside Center" } });
    fireEvent.click(screen.getAllByRole("button", { name: /continue/i })[screen.getAllByRole("button", { name: /continue/i }).length-1]);
    fireEvent.click((await screen.findAllByRole("button", { name: /continue/i })).slice(-1)[0]);
    expect(await screen.findByRole("heading", { name: "Set your defaults" })).toBeInTheDocument();
    for (const day of ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]) expect(screen.getByText(day)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    await waitFor(() => expect(document.querySelector(".setup-shell")).toHaveAttribute("data-theme", "dark"));
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });
});
