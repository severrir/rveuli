import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { registerServiceWorker } from "./lib/push.js";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registered after paint so it never competes with the first render.
if (import.meta.env.PROD) {
  window.addEventListener("load", () => registerServiceWorker());
}
