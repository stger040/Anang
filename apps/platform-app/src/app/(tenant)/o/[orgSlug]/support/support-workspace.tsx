"use client";

import { Badge, Button } from "@anang/ui";
import { useFormStatus } from "react-dom";
import { createSupportTask, updateSupportTaskStatus } from "./actions";

type PatientOption = { id: string; label: string };
type StatementOption = { id: string; label: string };

type TaskRow = {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  priority: string;
  category: string | null;
  dueAt: Date | null;
  patient: { firstName: string; lastName: string; mrn: string | null } | null;
  statement: { number: string; fhirFixture: boolean } | null;
};

const CAT_LABEL: Record<string, string> = {
  billing_question: "Billing question",
  payment_plan: "Payment plan",
  coverage: "Coverage",
  other: "Other",
};

const STATUS_OPTIONS = [
  "open",
  "in_progress",
  "waiting_patient",
  "resolved",
] as const;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function SupportWorkspace({
  orgSlug,
  patients,
  statements,
  tasks,
}: {
  orgSlug: string;
  patients: PatientOption[];
  statements: StatementOption[];
  tasks: TaskRow[];
}) {
  const openCount = tasks.filter((t) => t.status !== "resolved").length;
  const urgentCount = tasks.filter(
    (t) => t.priority === "urgent" && t.status !== "resolved",
  ).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-violet-100 px-3 py-1 font-medium text-violet-900">
          Open: {openCount}
        </span>
        {urgentCount > 0 ? (
          <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-900">
            Urgent: {urgentCount}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">New task</h2>
          <p className="mt-1 text-xs text-slate-500">
            Billing follow-ups, callbacks, and copilot-assisted queue (data is
            staging).
          </p>
          <form action={createSupportTask} className="mt-4 space-y-3">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Title
              </label>
              <input
                name="title"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-sky"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Detail
              </label>
              <textarea
                name="detail"
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-sky"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Patient (optional)
                </label>
                <select
                  name="patientId"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-sky"
                >
                  <option value="">—</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Statement (optional)
                </label>
                <select
                  name="statementId"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-sky"
                >
                  <option value="">—</option>
                  {statements.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Priority
                </label>
                <select
                  name="priority"
                  defaultValue="normal"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-sky"
                >
                  {(["low", "normal", "high", "urgent"] as const).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Category
                </label>
                <select
                  name="category"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-sky"
                >
                  <option value="">—</option>
                  {Object.entries(CAT_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <SubmitButton label="Add task" />
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Support roadmap
          </h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700">
            <li>Agent Copilot prompts — tie to CRM / ticket IDs.</li>
            <li>Voice (Kora-class) — see brand voice name in config.</li>
            <li>Proactive lists from Insight segments + Pay behavior.</li>
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Queue</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Task</th>
                <th className="px-4 py-2">Patient / Acct</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No tasks — add one or re-seed the database.
                  </td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr key={t.id} className="align-top hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{t.title}</div>
                      {t.detail ? (
                        <p className="mt-1 max-w-md text-xs text-slate-600 line-clamp-2">
                          {t.detail}
                        </p>
                      ) : null}
                      {t.category ? (
                        <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-slate-500">
                          {CAT_LABEL[t.category] ?? t.category}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {t.patient ? (
                        <>
                          {t.patient.lastName}, {t.patient.firstName}
                          <div className="font-mono text-xs text-slate-500">
                            {t.patient.mrn ?? "—"}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                      {t.statement ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span className="font-mono">
                            Stmt {t.statement.number}
                          </span>
                          {t.statement.fhirFixture ? (
                            <Badge tone="default">FHIR</Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          t.priority === "urgent"
                            ? "font-semibold text-red-700"
                            : t.priority === "high"
                              ? "text-amber-800"
                              : "text-slate-600"
                        }
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <form
                        action={updateSupportTaskStatus}
                        className="flex flex-col gap-1"
                      >
                        <input type="hidden" name="orgSlug" value={orgSlug} />
                        <input type="hidden" name="taskId" value={t.id} />
                        <select
                          name="status"
                          defaultValue={t.status}
                          className="max-w-[11rem] rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-sky"
                          onChange={(e) => {
                            e.currentTarget.form?.requestSubmit();
                          }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {t.dueAt ? t.dueAt.toLocaleString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
