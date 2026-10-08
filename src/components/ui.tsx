"use client";
import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({ variant = "secondary", size = "md", loading, className = "", children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: "bg-ink text-white hover:bg-black disabled:bg-ink/40",
    secondary: "bg-surface text-ink border border-line hover:border-ink/30 disabled:text-faint",
    ghost: "text-muted hover:text-ink hover:bg-black/5 disabled:text-faint",
    danger: "bg-warn text-white hover:bg-warn/90",
  }[variant];
  const s = size === "sm" ? "h-8 px-3 text-sm gap-1.5" : "h-10 px-4 text-[15px] gap-2";
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center rounded-[10px] font-medium transition-colors disabled:cursor-not-allowed ${v} ${s} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Avatar({ src, name, size = 44 }: { src: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("");
    return (
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-full bg-line font-semibold text-muted"
        style={{ width: size, height: size, fontSize: size * 0.36 }}
      >
        {initials}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className="shrink-0 rounded-full bg-line object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function Logo({ src, size = 16 }: { src: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)} className="inline-block shrink-0 rounded-[3px]" />
  );
}

// Bottom sheet on phones, centered dialog on larger screens.
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 md:items-center" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="sheet-in pb-safe w-full max-w-md rounded-t-2xl bg-surface p-6 shadow-xl outline-none md:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-m-1 rounded-md p-1 text-muted hover:text-ink">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-warn/25 bg-warn-soft px-4 py-3 text-sm text-warn">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden className="divide-y divide-line">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="skeleton size-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-64 max-w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
