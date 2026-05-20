export const initialInsights = [
  {
    id: "i1",
    observation: "You've spent $340 on dining this month, 40% above your 3-month average.",
    recommendation: "Flag restaurant charges over $50 for review before they post.",
    confidence: 87,
  },
  {
    id: "i2",
    observation: "Your savings transfers have been inconsistent — only 2 of the last 6 weeks.",
    recommendation: "Auto-transfer $150 every Friday to your high-yield savings.",
    confidence: 92,
  },
];

export const initialPending = [
  {
    id: "p1",
    action: "PAY $1,500 to landlord",
    risk: "low",
    confidence: 97,
    reasoning:
      "Balance of $2,100 exceeds $2,000 threshold. Remaining balance after payment: $600.",
    rule: "Pay rent if balance > $2,000",
  },
  {
    id: "p2",
    action: "TRANSFER $400 to savings",
    risk: "medium",
    confidence: 84,
    reasoning:
      "Payday deposit detected 2 days ago. Discretionary spending budget for the week is intact.",
    rule: "Move 10% of paycheck to savings on payday + 2",
  },
  {
    id: "p3",
    action: "PAY $1,240 to Visa ending 4421",
    risk: "high",
    confidence: 71,
    reasoning:
      "Statement balance is high relative to checking. Payment would leave $380 buffer — below your $500 minimum.",
    rule: "Pay full statement balance if buffer ≥ $500",
  },
];

export const initialAudit = [
  {
    id: "a1",
    date: "2026-05-18 09:14",
    action: "PAY $85 to ConEd",
    decision: "Approved",
    confidence: 99,
    summary: "Utility bill, recurring payee, within threshold.",
  },
  {
    id: "a2",
    date: "2026-05-15 17:42",
    action: "TRANSFER $250 to brokerage",
    decision: "Edited",
    confidence: 88,
    summary: "User reduced amount from $400 to $250 before approval.",
  },
  {
    id: "a3",
    date: "2026-05-12 08:03",
    action: "PAY $620 to unknown vendor",
    decision: "Rejected",
    confidence: 54,
    summary: "Low confidence, unrecognized payee, flagged for manual review.",
  },
];
