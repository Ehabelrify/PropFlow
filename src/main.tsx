import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

const router = getRouter();

// StrictMode disabled to prevent double-rendering that causes CPU freeze
// when clicking email input fields. The double-rendering amplifies re-render
// cascades from unmemoized context values, causing 97% CPU usage.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />
);