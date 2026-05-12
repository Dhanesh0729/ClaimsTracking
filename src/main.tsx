import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;

if (!PUBLISHABLE_KEY) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set");
}
if (!CONVEX_URL) {
  throw new Error("VITE_CONVEX_URL is not set");
}

const convex = new ConvexReactClient(CONVEX_URL);

const stored = localStorage.getItem("claimtrack-theme");
if (stored === "dark") {
  document.documentElement.classList.add("dark");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <App />
          <Toaster position="top-right" richColors closeButton />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
