import { Card } from "./card";

type Props = {
  label: string;
  value: string;
  hint?: string;
  trend?: string;
};

export function StatCard({ label, value, hint, trend }: Props) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {trend && (
        <p className="mt-2 text-xs font-medium text-emerald-700">{trend}</p>
      )}
    </Card>
  );
}
