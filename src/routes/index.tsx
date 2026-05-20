import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sageAgent } from "@/lib/sage-agent.functions";
import { initialInsights, initialPending, initialAudit } from "@/mockData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sage — Financial agent with a trust layer" },
      {
        name: "description",
        content:
          "Sage proposes financial actions with confidence scores, reasoning, and a full audit trail you control.",
      },
    ],
  }),
  component: Index,
});

type Risk = "low" | "medium" | "high";
type Decision = "Approved" | "Rejected" | "Edited";

const riskStyles: Record<Risk, string> = {
  low: "bg-success-soft text-success",
  medium: "bg-warning-soft text-warning",
  high: "bg-danger-soft text-danger",
};

const decisionStyles: Record<Decision, string> = {
  Approved: "bg-success-soft text-success",
  Rejected: "bg-danger-soft text-danger",
  Edited: "bg-info-soft text-info",
};

function ConfidenceBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-foreground/60" />
      {value}% confident
    </span>
  );
}

function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${riskStyles[risk]}`}
    >
      {risk} risk
    </span>
  );
}

const AMOUNT_RE = /\$([\d,]+(?:\.\d{1,2})?)/;
const parseAmount = (s: string) => {
  const m = s.match(AMOUNT_RE);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
};
const formatAmount = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function Index() {
  const [insights, setInsights] = useState(initialInsights);
  const [pending, setPending] = useState(initialPending);
  const [audit, setAudit] = useState(initialAudit);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [loadingInsight, setLoadingInsight] = useState(true);
  const [loadingAction, setLoadingAction] = useState(true);

  const callSage = useServerFn(sageAgent);

  useEffect(() => {
    const ctx = {
      accountBalance: 2100,
      rules: [
        "Pay rent of $1,500 on the 1st if balance > $2,000",
        "Move 10% of paycheck to savings on payday + 2",
        "Pay full statement balance if buffer ≥ $500",
      ],
      transactions: [
        { date: "2026-05-28", merchant: "Whole Foods", amount: -82 },
        { date: "2026-05-27", merchant: "Payday Deposit", amount: 2400 },
        { date: "2026-05-25", merchant: "CloudSync", amount: -14.99 },
        { date: "2026-05-22", merchant: "Uber Eats", amount: -54 },
        { date: "2026-05-20", merchant: "ConEd", amount: -85 },
      ],
      todayDate: new Date().toISOString().slice(0, 10),
    };

    callSage({ data: { type: "action", ...ctx } })
      .then((r) => {
        if (!r.action) return;
        setPending((p) => [
          {
            id: `live-p-${Date.now()}`,
            action: r.action,
            risk: (r.risk_level as "low" | "medium" | "high") || "medium",
            confidence: r.confidence || 0,
            reasoning: r.reasoning,
            rule: r.rule_matched,
          },
          ...p,
        ]);
      })
      .catch((e) => console.error("Sage action error:", e))
      .finally(() => setLoadingAction(false));

    callSage({ data: { type: "insight", ...ctx } })
      .then((r) => {
        if (!r.observation) return;
        setInsights((xs) => [
          {
            id: `live-i-${Date.now()}`,
            observation: r.observation,
            recommendation: r.recommendation,
            confidence: r.confidence || 0,
          },
          ...xs,
        ]);
      })
      .catch((e) => console.error("Sage insight error:", e))
      .finally(() => setLoadingInsight(false));
  }, [callSage]);

  const totalDecisions = useMemo(() => audit.length, [audit]);

  const now = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const pushAudit = (entry: {
    action: string;
    decision: Decision;
    confidence: number;
    summary: string;
  }) => {
    setAudit((a) => [
      { id: `a-${Date.now()}`, date: now(), ...entry },
      ...a,
    ]);
  };

  const resolve = (id: string, decision: Decision) => {
    const card = pending.find((p) => p.id === id);
    if (!card) return;
    setPending((p) => p.filter((c) => c.id !== id));
    pushAudit({
      action: card.action,
      decision,
      confidence: card.confidence,
      summary: card.reasoning,
    });
  };

  const startEdit = (id: string) => {
    const card = pending.find((p) => p.id === id);
    if (!card) return;
    setEditingId(id);
    setEditAmount(String(parseAmount(card.action)));
    setEditNote("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount("");
    setEditNote("");
  };

  const confirmEdit = (id: string) => {
    const card = pending.find((p) => p.id === id);
    if (!card) return;
    const original = parseAmount(card.action);
    const next = Number(editAmount);
    const newAction = card.action.replace(AMOUNT_RE, formatAmount(isNaN(next) ? original : next));
    const summary = `User changed amount from ${formatAmount(original)} to ${formatAmount(
      isNaN(next) ? original : next,
    )}.${editNote.trim() ? ` Note: ${editNote.trim()}` : ""}`;
    setPending((p) => p.filter((c) => c.id !== id));
    pushAudit({
      action: newAction,
      decision: "Edited",
      confidence: card.confidence,
      summary,
    });
    cancelEdit();
  };

  const applyInsight = (id: string) => setInsights((xs) => xs.filter((i) => i.id !== id));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="font-display text-lg leading-none">S</span>
            </div>
            <div>
              <h1 className="font-display text-2xl leading-none">Sage</h1>
              <p className="text-xs text-muted-foreground">Financial agent · trust layer</p>
            </div>
          </div>
          <div className="hidden items-center gap-6 sm:flex">
            <Stat label="Pending" value={pending.length} />
            <Stat label="Decisions" value={totalDecisions} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-5 py-8 sm:px-8 sm:py-12">
        {/* Insights */}
        <Section
          eyebrow="01"
          title="Insights"
          description="Proactive observations from your recent activity."
        >
          {loadingInsight && <LoadingBanner label="Generating a fresh insight with Sage…" />}
          {insights.length === 0 ? (
            <EmptyState message="All caught up. Sage will surface new insights as patterns emerge." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {insights.map((i) => (
                <article
                  key={i.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="space-y-3">
                    <ConfidenceBadge value={i.confidence} />
                    <p className="text-sm leading-relaxed text-foreground">{i.observation}</p>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Recommendation
                      </p>
                      <p className="mt-1 text-sm text-foreground">{i.recommendation}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => applyInsight(i.id)}
                    className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    Apply
                  </button>
                </article>
              ))}
            </div>
          )}
        </Section>

        {/* Pending actions */}
        <Section
          eyebrow="02"
          title="Pending actions"
          description="Each action shows the rule that triggered it, Sage's reasoning, and a confidence score."
        >
          {pending.length === 0 ? (
            <EmptyState message="No pending actions. Sage is monitoring." />
          ) : (
            <div className="space-y-4">
              {pending.map((p) => {
                const isEditing = editingId === p.id;
                return (
                  <article
                    key={p.id}
                    className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <RiskBadge risk={p.risk as Risk} />
                          <ConfidenceBadge value={p.confidence} />
                        </div>
                        <h3 className="font-display text-xl leading-tight text-foreground">
                          {p.action}
                        </h3>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Reasoning
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-foreground">
                            {p.reasoning}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Rule matched
                          </p>
                          <p className="mt-1 inline-block rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-foreground">
                            {p.rule}
                          </p>
                        </div>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-5 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
                        <div>
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Amount
                          </label>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="w-40 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Note
                          </label>
                          <textarea
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            rows={2}
                            placeholder="Explain the change..."
                            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => confirmEdit(p.id)}
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-success px-4 text-sm font-medium text-success-foreground transition hover:opacity-90"
                          >
                            Confirm Edit
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground transition hover:bg-accent"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => resolve(p.id, "Approved")}
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-success px-4 text-sm font-medium text-success-foreground transition hover:opacity-90"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => startEdit(p.id)}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground transition hover:bg-accent"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => resolve(p.id, "Rejected")}
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-danger px-4 text-sm font-medium text-danger-foreground transition hover:opacity-90"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Section>

        {/* Audit log */}
        <Section
          eyebrow="03"
          title="Audit log"
          description="Every decision Sage proposed and how it was resolved."
        >
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {/* Desktop table */}
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Decision</th>
                    <th className="px-4 py-3 font-medium">Confidence</th>
                    <th className="px-4 py-3 font-medium">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={idx !== 0 ? "border-t border-border" : ""}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                        {row.date}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{row.action}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${decisionStyles[row.decision as Decision]}`}
                        >
                          {row.decision}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.confidence}%</td>
                      <td className="max-w-md px-4 py-3 text-muted-foreground">{row.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="divide-y divide-border sm:hidden">
              {audit.map((row) => (
                <li key={row.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{row.date}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${decisionStyles[row.decision as Decision]}`}
                    >
                      {row.decision}
                    </span>
                  </div>
                  <p className="font-medium text-foreground">{row.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.confidence}% · {row.summary}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Sage · every action explained, every decision logged.
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <div className="font-display text-xl leading-none text-foreground">{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="font-display text-3xl leading-tight text-foreground">{title}</h2>
        </div>
        <p className="hidden max-w-sm text-sm text-muted-foreground sm:block">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
