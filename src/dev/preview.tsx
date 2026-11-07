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
