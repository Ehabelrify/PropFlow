import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

const router = getRouter();

// Performance monitoring
let lastLogTime = Date.now();
let renderCount = 0;

const perfObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 16) {
      console.log(`[PERF] ${entry.name} took ${entry.duration.toFixed(2)}ms`, entry);
    }
  }
});

try {
  perfObserver.observe({ entryTypes: ["measure", "mark", "navigation"] });
} catch (e) {
  console.log("[PERF] PerformanceObserver not fully supported");
}

// Monitor for blocking operations
setInterval(() => {
  const now = Date.now();
  const delta = now - lastLogTime;
  if (delta > 100) {
    console.warn(`[PERF] Main thread blocked for ${delta}ms`, { timestamp: new Date().toISOString() });
  }
  lastLogTime = now;
}, 50);

// StrictMode disabled to prevent double-rendering that causes CPU freeze
// when clicking email input fields. The double-rendering amplifies re-render
// cascades from unmemoized context values, causing 97% CPU usage.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />
);