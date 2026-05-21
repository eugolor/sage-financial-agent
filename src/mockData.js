export const initialInsights = [
  {
    id: "i1",
    observation: "You've spent $340 on dining this month, 40% above your 3-month average.",
    recommendation: "Set a $300 monthly dining budget. Sage will alert you when you're close to the limit.",
    confidence: 87,
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

export const initialTransactions = [
  // June (recent)
  { date: "2026-06-01", merchant: "Tim Hortons", amount: -4.87 },
  { date: "2026-05-31", merchant: "TTC Presto Reload", amount: -40.00 },
  { date: "2026-05-30", merchant: "Shoppers Drug Mart", amount: -23.41 },
  { date: "2026-05-29", merchant: "Loblaws", amount: -87.62 },
  { date: "2026-05-28", merchant: "Uber Eats", amount: -32.18 },
  { date: "2026-05-28", merchant: "Tim Hortons", amount: -6.54 },
  { date: "2026-05-27", merchant: "Payroll Deposit — Acme Corp", amount: 2400.00 },
  { date: "2026-05-26", merchant: "LCBO #217", amount: -38.95 },
  { date: "2026-05-25", merchant: "Interac e-Transfer to Sarah M.", amount: -120.00 },
  { date: "2026-05-24", merchant: "Canadian Tire", amount: -156.78 },
  { date: "2026-05-23", merchant: "Tim Hortons", amount: -5.42 },
  { date: "2026-05-22", merchant: "Presto TTC Fare", amount: -3.35 },
  { date: "2026-05-21", merchant: "Rexall Pharma Plus", amount: -18.27 },
  { date: "2026-05-20", merchant: "Rogers Wireless", amount: -85.99 },
  { date: "2026-05-19", merchant: "Loblaws", amount: -64.13 },
  { date: "2026-05-18", merchant: "Spotify Premium", amount: -10.99 },
  { date: "2026-05-17", merchant: "Uber Canada", amount: -14.62 },
  { date: "2026-05-16", merchant: "Interac e-Transfer from Mom", amount: 200.00 },
  { date: "2026-05-15", merchant: "Shoppers Drug Mart", amount: -41.08 },
  { date: "2026-05-14", merchant: "Tim Hortons", amount: -4.87 },
  { date: "2026-05-12", merchant: "Uber Eats", amount: -28.74 },
  { date: "2026-05-11", merchant: "LCBO #044", amount: -54.27 },
  { date: "2026-05-10", merchant: "Canadian Tire", amount: -72.31 },
  { date: "2026-05-08", merchant: "Loblaws", amount: -112.46 },
  { date: "2026-05-07", merchant: "Enbridge Gas", amount: -68.42 },
  { date: "2026-05-05", merchant: "Tim Hortons", amount: -7.23 },
  { date: "2026-05-03", merchant: "Toronto Hydro", amount: -94.18 },
  { date: "2026-05-01", merchant: "Rent — E-Transfer to Landlord", amount: -1500.00 },
  // April
  { date: "2026-04-28", merchant: "Payroll Deposit — Acme Corp", amount: 2400.00 },
  { date: "2026-04-26", merchant: "Shoppers Drug Mart", amount: -31.55 },
  { date: "2026-04-24", merchant: "Uber Eats", amount: -41.83 },
  { date: "2026-04-22", merchant: "Loblaws", amount: -98.27 },
  { date: "2026-04-20", merchant: "Canadian Tire", amount: -47.62 },
  { date: "2026-04-18", merchant: "Tim Hortons", amount: -5.18 },
  { date: "2026-04-15", merchant: "Interac e-Transfer to Jordan K.", amount: -75.00 },
  { date: "2026-04-12", merchant: "LCBO #217", amount: -29.84 },
  { date: "2026-04-10", merchant: "TTC Presto Reload", amount: -40.00 },
  { date: "2026-04-08", merchant: "Loblaws", amount: -76.41 },
  { date: "2026-04-05", merchant: "Bell Internet", amount: -89.95 },
  { date: "2026-04-03", merchant: "Tim Hortons", amount: -6.18 },
];
