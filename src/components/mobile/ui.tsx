/**
 * TriloWMS Mobile — small UI kit for the phone app (big touch targets, one-handed layouts).
 */
import { useEffect } from "react";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-secondary text-muted-foreground border-border",
  primary: "bg-primary/15 text-primary border-primary/30",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  danger: "bg-red-500/10 text-red-400 border-red-500/30",
  info: "bg-sky-500/10 text-sky-400 border-sky-500/30",
};

export function Chip({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

export function Card({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn("w-full text-left rounded-3xl border border-border bg-card/60 p-4", onClick && "active:scale-[0.99] active:bg-card transition", className)}
    >
      {children}
    </Tag>
  );
}

export function StatTile({ label, value, sub, tone = "neutral" }: { label: string; value: React.ReactNode; sub?: string; tone?: Tone }) {
  const color = tone === "neutral" ? "text-foreground" : TONES[tone].split(" ")[1];
  return (
    <div className="rounded-3xl border border-border bg-card/60 p-4">
      <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={cn("text-2xl font-bold mt-0.5 font-mono", color)}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function BigButton({ children, onClick, tone = "primary", disabled, className }: { children: React.ReactNode; onClick?: () => void; tone?: "primary" | "ghost" | "success" | "danger"; disabled?: boolean; className?: string }) {
  const t = {
    primary: "bg-primary text-primary-foreground",
    success: "bg-emerald-500 text-black",
    danger: "bg-red-500/90 text-white",
    ghost: "bg-secondary text-foreground border border-border",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn("min-h-[48px] rounded-xl px-4 font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-40", t, className)}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pt-1">
      <h2 className="text-[13px] font-bold tracking-wide text-muted-foreground uppercase">{children}</h2>
      {right}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 text-muted-foreground">
      <div className="text-base font-semibold text-foreground/80">{title}</div>
      {hint && <div className="text-sm mt-1">{hint}</div>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 rounded-xl bg-card/60 border border-border pl-10 pr-3 text-[16px] focus:outline-none focus:border-primary/60"
      />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number }[] }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "shrink-0 h-10 px-4 rounded-full text-sm font-semibold border transition",
            value === o.id ? "bg-primary text-primary-foreground border-primary" : "bg-card/60 text-muted-foreground border-border",
          )}
        >
          {o.label}{o.count !== undefined ? ` · ${o.count}` : ""}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet: slides up from the bottom, closes on backdrop tap. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-border bg-background pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/60">
          <div className="mx-auto absolute left-1/2 -translate-x-1/2 top-1.5 h-1 w-10 rounded-full bg-border" />
          <h3 className="text-base font-bold pt-2">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="h-10 w-10 -mr-2 flex items-center justify-center rounded-full text-muted-foreground active:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, value, onChange, placeholder, type = "text", inputMode }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; inputMode?: "text" | "numeric" | "decimal" }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <input
        value={value}
        type={type}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full h-12 rounded-xl bg-card/60 border border-border px-3 text-[16px] focus:outline-none focus:border-primary/60"
      />
    </label>
  );
}

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words min-w-0">{value}</span>
    </div>
  );
}

export const timeAgo = (iso?: string | null) => {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
