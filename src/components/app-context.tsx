"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, type Plan, type Shortlist } from "@/lib/client-api";

type Ctx = {
  plan: Plan | null;
  setPlan: (p: Plan) => void;
  refreshPlan: () => Promise<void>;
  shortlists: Shortlist[] | null;
  refreshShortlists: () => Promise<void>;
  setShortlists: React.Dispatch<React.SetStateAction<Shortlist[] | null>>;
  personId: string | null;
  openPerson: (id: string | null) => void;
  upgradeOpen: boolean;
  setUpgradeOpen: (v: boolean) => void;
  toast: (msg: string) => void;
};

const AppContext = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [shortlists, setShortlists] = useState<Shortlist[] | null>(null);
  const [personId, openPerson] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refreshPlan = useCallback(async () => {
    try {
      setPlan(await api<Plan>("/api/plan"));
    } catch {}
  }, []);

  const refreshShortlists = useCallback(async () => {
    try {
      setShortlists(await api<Shortlist[]>("/api/shortlists"));
    } catch {}
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  useEffect(() => {
    refreshPlan();
    refreshShortlists();
    // plan can change from a Stripe webhook while the tab is open
    const onFocus = () => document.visibilityState === "visible" && refreshPlan();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshPlan, refreshShortlists]);

  return (
    <AppContext.Provider
      value={{
        plan,
        setPlan,
        refreshPlan,
        shortlists,
        refreshShortlists,
        setShortlists,
        personId,
        openPerson,
        upgradeOpen,
        setUpgradeOpen,
        toast,
      }}
    >
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6">
        {toastMsg && (
          <div className="sheet-in rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg">{toastMsg}</div>
        )}
      </div>
    </AppContext.Provider>
  );
}
