import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../App";
import { installPreviewBridge } from "./preview-bridge";

// Development-only preview harness. Renders the full application in a plain
// browser (no Tauri backend) by stubbing the native command bridge with the
// same fictional fixtures used by the automated tests. Not part of the
// production bundle: `vite build` only compiles index.html.
installPreviewBridge();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Development-only navigation helper: `preview.html?view=inventory` (etc.)
// clicks the matching sidebar entry after mount so visual sweeps can capture
// secondary screens. Never compiled into the production bundle.
const viewAliases: Record<string, string> = {
  dashboard: "overview",
  overview: "overview",
  inventory: "found items",
  lost: "lost reports",
  storage: "storage",
  retention: "retention review",
  settings: "settings",
};
const requestedView = new URLSearchParams(window.location.search).get("view");
if (requestedView) {
  const label = viewAliases[requestedView.toLowerCase()] ?? requestedView.toLowerCase();
  window.setTimeout(() => {
    const target = Array.from(document.querySelectorAll<HTMLButtonElement>(".nav-link")).find(
      (button) => button.textContent?.trim().toLowerCase().startsWith(label),
    );
    target?.click();
  }, 150);
}
// Development-only: `?inventoryView=gallery` selects the gallery radio after
// the Found items screen mounts so visual sweeps can capture both views.
const requestedInventoryView = new URLSearchParams(window.location.search).get("inventoryView");
if (requestedInventoryView) {
  window.setTimeout(() => {
    const target = document.querySelector<HTMLButtonElement>(
      `.view-switcher [data-value="${requestedInventoryView === "gallery" ? "gallery" : "list"}"]`,
    );
    target?.click();
  }, 400);
}
// Development-only: `?openDrawer=1` opens the first item's detail drawer
// after mount so visual sweeps can capture the drawer zones.
if (new URLSearchParams(window.location.search).get("openDrawer") === "1") {
  window.setTimeout(() => {
    const target = Array.from(document.querySelectorAll<HTMLButtonElement>(".item-row")).find(
      (button) => button.getAttribute("aria-label") !== "Close details",
    );
    target?.click();
  }, 400);
}
// Development-only: `?dropdown=1` opens the first styled dropdown so visual
// sweeps can capture the popup styling.
if (new URLSearchParams(window.location.search).get("dropdown") === "1") {
  window.setTimeout(() => {
    document.querySelector<HTMLButtonElement>(".select-trigger")?.click();
  }, 500);
}
// Development-only: `?drawerDropdown=1` opens the drawer and then its footer
// location dropdown (the bottom-clipped case); `?dispositionDropdown=1` opens
// the disposition modal and its dropdown (the modal-scroll-growth case).
const sweepParams = new URLSearchParams(window.location.search);
if (sweepParams.get("drawerDropdown") === "1") {
  window.setTimeout(() => {
    document.querySelector<HTMLButtonElement>(".item-row")?.click();
  }, 150);
  window.setTimeout(() => {
    document.querySelector<HTMLButtonElement>(".drawer-foot .select-trigger")?.click();
  }, 500);
}
if (sweepParams.get("dispositionDropdown") === "1") {
  window.setTimeout(() => {
    document.querySelector<HTMLButtonElement>(".item-row")?.click();
  }, 400);
  window.setTimeout(() => {
    Array.from(document.querySelectorAll<HTMLButtonElement>(".drawer-foot button"))
      .find((button) => /disposition/i.test(button.textContent ?? ""))
      ?.click();
  }, 1000);
  window.setTimeout(() => {
    document.querySelector<HTMLButtonElement>(".select-trigger")?.click();
  }, 1700);
}
// Development-only: `?expandHistory=1` expands the drawer custody history.
if (new URLSearchParams(window.location.search).get("expandHistory") === "1") {
  window.setTimeout(() => {
    document.querySelector<HTMLButtonElement>(".drawer-history-toggle")?.click();
  }, 700);
}
// Development-only: `?measure=1` records whether the view region overflows
// (page-level scrolling needed) for layout-fit sweeps.
const measureParams = new URLSearchParams(window.location.search);
if (measureParams.has("measure")) {
  window.setTimeout(
    () => {
      const region = document.querySelector<HTMLElement>(".view-region");
      if (region)
        region.setAttribute(
          "data-scroll",
          `${region.scrollHeight > region.clientHeight + 1 ? "overflows" : "fits"}:${region.scrollHeight}/${region.clientHeight}`,
        );
      const shell = document.querySelector<HTMLElement>(".main-shell");
      if (shell)
        shell.setAttribute(
          "data-shell-scroll",
          `${shell.scrollHeight > shell.clientHeight + 1 ? "overflows" : "fits"}`,
        );
      const doc = document.documentElement;
      doc.setAttribute(
        "data-doc-scroll",
        `${doc.scrollHeight > window.innerHeight + 1 ? "overflows" : "fits"}:${doc.scrollHeight}/${window.innerHeight}`,
      );
      const modal = document.querySelector<HTMLElement>(".modal-card");
      if (modal)
        modal.setAttribute(
          "data-modal-scroll",
          `${modal.scrollHeight > modal.clientHeight + 1 ? "overflows" : "fits"}:${modal.scrollHeight}/${modal.clientHeight}`,
        );
      const heading = document.querySelector<HTMLElement>(".setup-form-content h1");
      if (heading) doc.setAttribute("data-setup-heading", heading.textContent ?? "");
      const parts = [
        ".setup-top-row",
        ".step-progress",
        ".setup-form-content",
        ".setup-footer",
        ".setup-aside",
      ].map((selector) => {
        const element = document.querySelector<HTMLElement>(selector);
        return element
          ? `${selector.replace(/^[^.]*/, "")}=${Math.round(element.getBoundingClientRect().height)}`
          : `${selector}=absent`;
      });
      doc.setAttribute("data-setup-parts", parts.join(","));
    },
    measureParams.has("dispositionDropdown") ? 2600 : 1500,
  );
}
// Development-only: `?setupStep=N` autofills the organization step and clicks
// through N continues so setup steps can be captured for fit sweeps.
const setupStep = Number(new URLSearchParams(window.location.search).get("setupStep") ?? "0");
if (new URLSearchParams(window.location.search).has("setup") && setupStep > 0) {
  for (let i = 0; i <= setupStep; i += 1) {
    window.setTimeout(
      () => {
        if (i === 0) document.querySelector<HTMLButtonElement>(".dev-autofill button")?.click();
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter(
          (button) => /continue/i.test(button.textContent ?? "") && !button.disabled,
        );
        buttons[buttons.length - 1]?.click();
      },
      400 + i * 240,
    );
  }
}
