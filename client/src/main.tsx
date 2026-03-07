import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.PROD) {
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  document.addEventListener("keydown", (e) => {
    if (e.key === "F12") { e.preventDefault(); return; }
    if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) { e.preventDefault(); return; }
    if (e.ctrlKey && e.key === "u") { e.preventDefault(); return; }
  });

  const devToolsCheck = setInterval(() => {
    const threshold = 160;
    if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
      document.body.innerHTML = "<div style='display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#0f172a;color:#e2e8f0;'><h1>Access Denied</h1></div>";
      clearInterval(devToolsCheck);
    }
  }, 2000);

  (function () {
    const el = new Image();
    Object.defineProperty(el, "id", {
      get: function () {
        document.body.innerHTML = "<div style='display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#0f172a;color:#e2e8f0;'><h1>Access Denied</h1></div>";
      },
    });
  })();
}

createRoot(document.getElementById("root")!).render(<App />);
