import { createServerFn } from "@tanstack/react-start";

type SageRequest = {
  type: "action" | "insight";
  accountBalance: number;
  rules: string[];
  transactions: unknown[];
  todayDate: string;
};

const SYSTEM_PROMPT =
  "You are Sage, a financial agent. You help users manage their money by proposing actions and explaining your reasoning clearly. Always respond with valid JSON only — no intro text, no markdown. Start your response with { and end with }.";

const ACTION_PROMPT = `Given the account balance, rules, and transactions provided, propose the most important pending action right now.

Return this exact JSON:
{
  "action": "description of action",
  "confidence": 0-100,
  "risk_level": "low | medium | high",
  "reasoning": "plain English, max 2 sentences",
  "rule_matched": "exact rule that triggered this"
}`;

const INSIGHT_PROMPT = `Given the transaction history provided, identify the single most important spending insight for this user.

Return this exact JSON:
{
  "observation": "what you noticed",
  "recommendation": "specific action to take",
  "confidence": 0-100
}`;

function validate(input: unknown): SageRequest {
  const d = input as Partial<SageRequest>;
  if (!d || (d.type !== "action" && d.type !== "insight")) {
    throw new Error("Invalid type: must be 'action' or 'insight'");
  }
  return {
    type: d.type,
    accountBalance: Number(d.accountBalance ?? 0),
    rules: Array.isArray(d.rules) ? d.rules : [],
    transactions: Array.isArray(d.transactions) ? d.transactions : [],
    todayDate: String(d.todayDate ?? ""),
  };
}

export const sageAgent = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const userPrompt = `${data.type === "action" ? ACTION_PROMPT : INSIGHT_PROMPT}

Context:
- Today: ${data.todayDate}
- Account balance: $${data.accountBalance}
- Rules: ${JSON.stringify(data.rules)}
- Transactions: ${JSON.stringify(data.transactions)}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Claude API error ${res.status}: ${text}`);
    }

    const payload = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      payload.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as Record<string, unknown>;
      throw new Error("Claude returned non-JSON response");
    }
  });
