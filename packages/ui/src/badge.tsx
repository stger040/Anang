import type { HTMLAttributes } from "react";

const tones: Record<string, string> = {
  default: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  danger: "bg-red-50 text-red-800 border-red-200",
  info: "bg-sky-50 text-sky-900 border-sky-200",
  teal: "bg-brand-sky/80 text-brand-navy border-brand-navy/15",
};

export function Badge({
  tone = "default",
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone] ?? tones.default} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
