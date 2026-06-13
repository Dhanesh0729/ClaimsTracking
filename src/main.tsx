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

const isPlaceholder = (key: string) =>
  !key ||
  key.includes("xxxxxxxxxxxxxxxxxxxxxx") ||
  key.includes("your-deployment");

if (isPlaceholder(PUBLISHABLE_KEY) || isPlaceholder(CONVEX_URL)) {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-4 antialiased text-slate-200 font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(245,158,11,0.08),transparent_40%),radial-gradient(circle_at_70%_70%,rgba(59,130,246,0.08),transparent_40%)] pointer-events-none" />
        
        <div className="relative max-w-xl w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-lg p-8 shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500/50 via-blue-500/50 to-amber-500/50" />
          
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center p-2.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-3 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              ClaimTrack Setup
            </h1>
            <p className="text-xs text-slate-400 mt-1.5">
              Let's configure your environment keys to start the app!
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded bg-slate-950/80 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 pb-2">
                <span>Variables Status</span>
                <span className="text-[10px] text-amber-500 font-mono">Action Required</span>
              </div>
              
              <div className="flex items-center justify-between text-xs py-1">
                <span className="font-mono text-slate-300">VITE_CLERK_PUBLISHABLE_KEY</span>
                {(!PUBLISHABLE_KEY || PUBLISHABLE_KEY.includes("xxxxxxxxxxxxxxxxxxxxxx")) ? (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 border border-red-500/20 text-red-400">❌ Missing / Placeholder</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">✓ Detected</span>
                )}
              </div>
              
              <div className="flex items-center justify-between text-xs py-1">
                <span className="font-mono text-slate-300">VITE_CONVEX_URL</span>
                {(!CONVEX_URL || CONVEX_URL.includes("your-deployment")) ? (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 border border-red-500/20 text-red-400">❌ Missing / Placeholder</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">✓ Detected</span>
                )}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <h2 className="font-semibold text-slate-200">How to configure keys:</h2>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-400">
                <li>
                  Open the created <span className="font-mono text-white bg-slate-800 px-1 py-0.5 rounded">.env</span> file in the project's root folder.
                </li>
                <li>
                  Replace the placeholders with your authentic keys:
                  <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-400 font-mono text-[11px]">
                    <li>Get <span className="text-white">VITE_CLERK_PUBLISHABLE_KEY</span> from the <a href="https://clerk.com" target="_blank" rel="noreferrer" className="text-amber-500 hover:underline">Clerk Dashboard</a></li>
                    <li>Get <span className="text-white">VITE_CONVEX_URL</span> by running <code className="text-amber-500">npx convex dev</code> in your terminal</li>
                  </ul>
                </li>
                <li>
                  Restart your dev server by running <code className="bg-slate-800 text-white px-1 py-0.5 rounded font-mono">npm run dev</code>.
                </li>
              </ol>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4">
            <span className="text-[11px] text-slate-500">
              Template <code className="text-slate-400">.env</code> created successfully.
            </span>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold rounded bg-amber hover:bg-amber-600 text-slate-950 transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Reload Page
            </button>
          </div>
        </div>
      </div>
    </React.StrictMode>
  );
} else {
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
}
