"use client";
import { Bookmark, List, LogOut, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { AppProvider, useApp } from "./app-context";
import { PersonPanel } from "./person-panel";
import { Button, Dialog } from "./ui";

const NAV = [
  { href: "/", label: "Search", icon: Search },
  { href: "/shortlists", label: "Shortlists", icon: List },
  { href: "/saved", label: "Saved searches", short: "Saved", icon: Bookmark },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [company, setCompany] = useState<string>("");

  useEffect(() => {
    const sb = browserClient();
    sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) return router.replace("/login");
      setReady(true);
      const { data: c } = await sb.from("companies").select("name").maybeSingle();
      setCompany(c?.name ?? "");
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!ready) return null;
  return (
    <AppProvider>
      <Header company={company} />
      <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 md:px-6 md:pt-8 md:pb-16">{children}</main>
      <TabBar />
      <PersonPanel />
      <UpgradeDialog />
    </AppProvider>
  );
}

const active = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function Header({ company }: { company: string }) {
  const pathname = usePathname();
  const signOut = () => browserClient().auth.signOut();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4 md:px-6">
        <Link href="/" className="text-[19px] font-bold tracking-tight">
          rotto
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active(pathname, n.href) ? "bg-black/[.06] text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <PlanBadge />
          <div className="hidden text-sm text-muted md:block">{company}</div>
          <button onClick={signOut} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-muted hover:bg-black/5 hover:text-ink">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-3">
        {NAV.map((n) => {
          const on = active(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${on ? "text-ink" : "text-faint"}`}
            >
              <n.icon className="size-5" strokeWidth={on ? 2.25 : 1.75} />
              {n.short ?? n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function PlanBadge() {
  const { plan, setUpgradeOpen } = useApp();
  if (!plan) return null;
  if (plan.plan === "paid") {
    return <span className="rounded-full bg-go-soft px-2.5 py-1 text-xs font-semibold text-go">Paid plan</span>;
  }
  const left = plan.searches_remaining ?? 0;
  return (
    <button
      onClick={() => setUpgradeOpen(true)}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
        left > 0 ? "bg-black/[.06] text-ink hover:bg-black/10" : "bg-marker text-marker-ink hover:brightness-95"
      }`}
    >
      {left > 0 ? `Free plan: ${left} search left` : "Free search used"}
      <span className="flex items-center gap-1 underline underline-offset-2">
        <Sparkles className="size-3" aria-hidden />
        Upgrade
      </span>
    </button>
  );
}

function UpgradeDialog() {
  const { upgradeOpen, setUpgradeOpen, plan } = useApp();
  const used = plan?.plan === "free" && plan.searches_remaining === 0;
  return (
    <Dialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} title={plan?.plan === "paid" ? "You're on the paid plan" : "Upgrade to search without limits"}>
      {plan?.plan === "paid" ? (
        <p className="text-[15px] leading-relaxed text-muted">Your company can run as many searches as it needs.</p>
      ) : (
        <div className="space-y-4 text-[15px] leading-relaxed text-muted">
          <p>
            The free plan includes <strong className="text-ink">1 search</strong> for your whole company
            {used ? ", and it's been used" : ""}. Paging through results, opening profiles, shortlisting and saving
            searches stay free.
          </p>
          <div className="rounded-xl bg-paper p-4">
            <p className="font-medium text-ink">How to upgrade</p>
            <p className="mt-1">
              Ask your Rotto admin to start a subscription for your company. Billing runs through Stripe, and your
              plan switches to paid the moment Stripe confirms the subscription. No need to sign out.
            </p>
          </div>
          <Button variant="primary" className="w-full" onClick={() => setUpgradeOpen(false)}>
            Got it
          </Button>
        </div>
      )}
    </Dialog>
  );
}
