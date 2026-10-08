"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ErrorNote } from "@/components/ui";
import { browserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    browserClient()
      .auth.getSession()
      .then(({ data }) => data.session && router.replace("/"));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await browserClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.status === 400 ? "That email and password don't match." : "Can't sign in right now. Try again.");
      setBusy(false);
      return;
    }
    router.replace("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-[22px] font-bold tracking-tight">rotto</p>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-[15px] text-muted">Find candidates by describing who you want.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[15px] outline-none focus:border-ink/40"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[15px] outline-none focus:border-ink/40"
            />
          </label>
          {error && <ErrorNote message={error} />}
          <Button type="submit" variant="primary" loading={busy} className="h-11 w-full">
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
