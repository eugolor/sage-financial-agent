import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sageAgent } from "@/lib/sage-agent.functions";
import { initialInsights, initialPending, initialAudit, initialTransactions } from "@/mockData";

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
type Decision = "Approved" | "Rejected" | "Edited" | "Auto-approved";

const riskStyles: Record<Risk, string> = {
  low: "bg-success-soft text-success",
  medium: "bg-warning-soft text-warning",
  high: "bg-danger-soft text-danger",
};

const decisionStyles: Record<Decision, string> = {
  Approved: "bg-success-soft text-success",
  Rejected: "bg-danger-soft text-danger",
  Edited: "bg-info-soft text-info",
  "Auto-approved": "bg-success-soft text-success",
};

const TRUST_STOPS = [
  {
    value: 100,
    label: "Always ask me",
    description: "Sage will always wait for your approval before acting.",
  },
  {
    value: 90,
    label: "Auto-approve if 90%+ confident",
    description:
      "Sage will act automatically on high-confidence, low-risk actions. You'll still approve anything medium or high risk.",
  },
  {
    value: 75,
    label: "Auto-approve if 75%+ confident",
    description:
      "Sage will handle most routine actions automatically. You'll only see flagged or unusual items.",
  },
];

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
  const [rules, setRules] = useState<string[]>([
    "Pay rent of $1,500 on the 1st if balance > $2,000",
    "Move 10% of paycheck to savings on payday + 2",
    "Flag any transaction over $500 for review",
  ]);
  const [ruleInput, setRuleInput] = useState("");
  const [addingRule, setAddingRule] = useState(false);

  const callSage = useServerFn(sageAgent);

  const addRule = () => {
    const text = ruleInput.trim();
    if (!text || addingRule) return;
    setAddingRule(true);
    callSage({ data: { type: "parse_rule", ruleText: text } })
      .then((r) => {
        const structured = r.rule?.trim() || text;
        setRules((rs) => [...rs, structured]);
        setRuleInput("");
      })
      .catch((e) => {
        console.error("[Sage] parse_rule FAILED — adding raw text as fallback", e);
        setRules((rs) => [...rs, text]);
        setRuleInput("");
      })
      .finally(() => setAddingRule(false));
  };

  const removeRule = (idx: number) =>
    setRules((rs) => rs.filter((_, i) => i !== idx));

  const [stopIdx, setStopIdx] = useState(0);
  const threshold = TRUST_STOPS[stopIdx].value;
  const [autoApprovingIds, setAutoApprovingIds] = useState<Set<string>>(new Set());

  const [askInput, setAskInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [advice, setAdvice] = useState<{
    answer: string;
    reasoning: string;
    confidence: number;
    verdict: string;
  } | null>(null);

  const askSage = () => {
    const q = askInput.trim();
    if (!q || asking) return;
    setAsking(true);
    callSage({ data: { type: "advice", question: q } })
      .then((r) => {
        setAdvice({
          answer: r.answer || "",
          reasoning: r.reasoning || "",
          confidence: r.confidence || 0,
          verdict: (r.verdict || "needs more info").toLowerCase(),
        });
        setAskInput("");
      })
      .catch((e) => {
        console.error("[Sage] advice FAILED", e);
        setAdvice({
          answer: "Sage couldn't reach the model right now.",
          reasoning: e?.message || "Unknown error",
          confidence: 0,
          verdict: "needs more info",
        });
      })
      .finally(() => setAsking(false));
  };

  useEffect(() => {
    const ctx = {
      accountBalance: 2100,
      rules,

      transactions: initialTransactions,
      todayDate: new Date().toISOString().slice(0, 10),
    };

    callSage({ data: { type: "action", ...ctx } })
      .then((r) => {
        if (!r.action) {
          console.warn("[Sage] action call returned empty payload, keeping mock data", r);
          return;
        }
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
      .catch((e) => {
        console.error("[Sage] action call FAILED — falling back to mock data", {
          message: e?.message ?? String(e),
          status: e?.status,
          cause: e?.cause,
          error: e,
        });
      })
      .finally(() => setLoadingAction(false));

    callSage({ data: { type: "insight", ...ctx } })
      .then((r) => {
        if (!r.observation) {
          console.warn("[Sage] insight call returned empty payload, keeping mock data", r);
          return;
        }
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
      .catch((e) => {
        console.error("[Sage] insight call FAILED — falling back to mock data", {
          message: e?.message ?? String(e),
          status: e?.status,
          cause: e?.cause,
          error: e,
        });
      })
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

  useEffect(() => {
    pending.forEach((p) => {
      if (
        p.risk === "low" &&
        p.confidence >= threshold &&
        !autoApprovingIds.has(p.id)
      ) {
        setAutoApprovingIds((prev) => {
          const next = new Set(prev);
          next.add(p.id);
          return next;
        });
        setTimeout(() => {
          setPending((cur) => cur.filter((c) => c.id !== p.id));
          setAudit((a) => [
            {
              id: `a-${Date.now()}-${p.id}`,
              date: now(),
              action: p.action,
              decision: "Auto-approved",
              confidence: p.confidence,
              summary: `Auto-approved by Sage at ${threshold}% threshold. ${p.reasoning}`,
            },
            ...a,
          ]);
          setAutoApprovingIds((prev) => {
            const next = new Set(prev);
            next.delete(p.id);
            return next;
          });
        }, 1600);
      }
    });
  }, [pending, threshold, autoApprovingIds]);

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

        {/* Rules */}
        <Section
          eyebrow="02"
          title="My Rules"
          description="Plain-English rules Sage uses to decide which actions to propose."
        >
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active rules yet. Add one below.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rules.map((r, idx) => (
                  <li key={`${idx}-${r}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="text-sm text-foreground">{r}</span>
                    <button
                      onClick={() => removeRule(idx)}
                      aria-label="Delete rule"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
              <input
                type="text"
                value={ruleInput}
                onChange={(e) => setRuleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRule();
                  }
                }}
                placeholder="Describe a rule in plain English e.g. 'Alert me if I spend more than $200 on food in a week'"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={addRule}
                disabled={addingRule || !ruleInput.trim()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {addingRule && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                )}
                Add Rule
              </button>
            </div>
          </div>
        </Section>

        {/* Trust Settings */}
        <Section
          eyebrow="03"
          title="Trust Settings"
          description="How much should Sage act on its own?"
        >
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <p className="text-sm text-muted-foreground">How much should Sage act on its own?</p>

            <div className="mt-6">
              <div className="relative px-2">
                <div className="relative h-1.5 rounded-full bg-muted">
                  <div
                    className="absolute left-0 top-0 h-1.5 rounded-full bg-primary transition-all"
                    style={{ width: `${(stopIdx / (TRUST_STOPS.length - 1)) * 100}%` }}
                  />
                  {TRUST_STOPS.map((_, i) => {
                    const active = i <= stopIdx;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setStopIdx(i)}
                        aria-label={`Set trust level ${TRUST_STOPS[i].label}`}
                        className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition ${
                          active
                            ? "border-primary bg-primary"
                            : "border-border bg-card"
                        } ${i === stopIdx ? "ring-4 ring-primary/20" : ""}`}
                        style={{ left: `${(i / (TRUST_STOPS.length - 1)) * 100}%` }}
                      />
                    );
                  })}
                </div>
                <input
                  type="range"
                  min={0}
                  max={TRUST_STOPS.length - 1}
                  step={1}
                  value={stopIdx}
                  onChange={(e) => setStopIdx(Number(e.target.value))}
                  className="absolute inset-x-0 top-1/2 h-6 w-full -translate-y-1/2 cursor-pointer opacity-0"
                  aria-label="Trust threshold"
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                {TRUST_STOPS.map((s, i) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStopIdx(i)}
                    className={`text-left transition ${
                      i === stopIdx ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    } ${i === 1 ? "text-center" : ""} ${i === 2 ? "text-right" : ""}`}
                  >
                    <span className="font-medium">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-muted p-4">
              <p className="text-sm leading-relaxed text-foreground">
                {TRUST_STOPS[stopIdx].description}
              </p>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              You can change this at any time. All actions are logged regardless of setting.
            </p>
          </div>
        </Section>

        {/* Pending actions */}
        <Section
          eyebrow="04"
          title="Pending actions"
          description="Each action shows the rule that triggered it, Sage's reasoning, and a confidence score."
        >
          {loadingAction && <LoadingBanner label="Sage is reviewing your account…" />}
          {pending.length === 0 ? (
            <EmptyState message="No pending actions. Sage is monitoring." />
          ) : (
            <div className="space-y-4">
              {pending.map((p) => {
                const isEditing = editingId === p.id;
                const isAutoApproving = autoApprovingIds.has(p.id);
                return (
                  <article
                    key={p.id}
                    className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
                  >
                    {isAutoApproving && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">
                        <span className="inline-flex h-2 w-2 rounded-full bg-success" />
                        Auto-approved by Sage · {p.confidence}% confident
                      </div>
                    )}
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

                    {!isAutoApproving && (
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
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </Section>

        {/* Audit log */}
        <Section
          eyebrow="05"
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

      <footer className="border-t border-border py-8 pb-28 text-center text-xs text-muted-foreground sm:pb-28">
        Sage · every action explained, every decision logged.
      </footer>

      {/* Ask Sage floating chat */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="pointer-events-auto mx-auto max-w-3xl space-y-3">
          {advice && <AdviceCard advice={advice} onDismiss={() => setAdvice(null)} />}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              askSage();
            }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80"
          >
            <div className="flex shrink-0 items-center gap-2 pl-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <span className="font-display text-sm leading-none">S</span>
              </div>
              <span className="hidden text-sm font-medium text-foreground sm:inline">Ask Sage</span>
            </div>
            <input
              type="text"
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              placeholder="e.g. Should I buy a $800 laptop right now?"
              className="flex-1 bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="submit"
              disabled={asking || !askInput.trim()}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {asking && (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              )}
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const verdictStyles: Record<string, string> = {
  "go ahead": "bg-success text-success-foreground",
  "hold off": "bg-danger text-danger-foreground",
  "needs more info": "bg-secondary text-secondary-foreground",
};

function AdviceCard({
  advice,
  onDismiss,
}: {
  advice: { answer: string; reasoning: string; confidence: number; verdict: string };
  onDismiss: () => void;
}) {
  const verdictKey = verdictStyles[advice.verdict] ? advice.verdict : "needs more info";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-wide ${verdictStyles[verdictKey]}`}
        >
          {verdictKey}
        </span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          ×
        </button>
      </div>
      <p className="mt-3 text-base leading-relaxed text-foreground">{advice.answer}</p>
      <div className="mt-3 rounded-lg bg-muted p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reasoning</p>
        <p className="mt-1 text-sm text-foreground">{advice.reasoning}</p>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{advice.confidence}% confident</div>
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

function LoadingBanner({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
      {label}
    </div>
  );
}
