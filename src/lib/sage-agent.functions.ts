import { createServerFn } from "@tanstack/react-start";

type SageRequest = {
  type: "action" | "insight" | "parse_rule" | "advice";
  accountBalance: number;
  rules: string[];
  transactions: unknown[];
  todayDate: string;
  ruleText: string;
  question: string;
};

const SYSTEM_PROMPT =
  "You are Sage, a financial agent. You help users manage their money by proposing actions and explaining your reasoning clearly. Always respond with valid JSON only. No intro text, no markdown. Start your response with { and end with }.";

const PARSE_RULE_SYSTEM =
  "You are Sage, a financial agent. Always respond with valid JSON only. Start with { and end with }.";

const ACTION_PROMPT = `Given the account balance, rules, and transactions provided, propose the most important pending action right now.

Keep reasoning to ONE sentence maximum, under 20 words. Be direct and specific.

Return this exact JSON:
{
  "action": "description of action",
  "confidence": 0-100,
  "risk_level": "low | medium | high",
  "reasoning": "plain English, max 1 sentence, under 20 words",
  "rule_matched": "exact rule that triggered this"
}`;

const INSIGHT_PROMPT = `Given the transaction history provided, identify the single most important spending insight for this user.

Keep observation to maximum 1 sentence (under 20 words). Keep recommendation to maximum 1 sentence (under 20 words). Be specific but extremely concise.

Return this exact JSON:
{
  "observation": "what you noticed",
  "recommendation": "specific action to take",
  "confidence": 0-100
}`;

function validate(input: unknown): SageRequest {
  const d = (input ?? {}) as Partial<SageRequest>;
  if (d.type !== "action" && d.type !== "insight" && d.type !== "parse_rule" && d.type !== "advice") {
    throw new Error("Invalid type: must be 'action', 'insight', 'parse_rule', or 'advice'");
  }
  return {
    type: d.type,
    accountBalance: Number(d.accountBalance ?? 0),
    rules: Array.isArray(d.rules) ? d.rules : [],
    transactions: Array.isArray(d.transactions) ? d.transactions : [],
    todayDate: String(d.todayDate ?? ""),
    ruleText: String(d.ruleText ?? ""),
    question: String(d.question ?? ""),
  };
}

export const sageAgent = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    console.log("[sage-agent] called", { type: data.type });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[sage-agent] ANTHROPIC_API_KEY is not configured");
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    let system = SYSTEM_PROMPT;
    let userPrompt: string;

    if (data.type === "parse_rule") {
      system = PARSE_RULE_SYSTEM;
      userPrompt = `Convert this plain English rule into a clean, structured rule string suitable for a financial agent. Keep it concise, under 15 words, in the format of a conditional statement.

Rule: ${data.ruleText}

Return: { "rule": "structured rule string" }`;
    } else if (data.type === "advice") {
      system = PARSE_RULE_SYSTEM;
      userPrompt = `The user is asking for financial advice based on their current situation.
Account balance: $2,100
Recent spending this month: $340 dining, $82 groceries, $54 food delivery, $14.99 CloudSync subscription
Upcoming: rent $1,500 due June 1st

Their question: ${data.question}

Return this exact JSON:
{
  "answer": "direct answer in 1-2 sentences",
  "reasoning": "why, based on their actual numbers, 1-2 sentences",
  "confidence": 0-100,
  "verdict": "go ahead | hold off | needs more info"
}`;
    } else {
      userPrompt = `${data.type === "action" ? ACTION_PROMPT : INSIGHT_PROMPT}

Context:
- Today: ${data.todayDate}
- Account balance: $${data.accountBalance}
- Rules: ${JSON.stringify(data.rules)}
- Transactions: ${JSON.stringify(data.transactions)}`;
    }

    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 512,
          system,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
    } catch (err) {
      console.error("[sage-agent] fetch to Anthropic threw", { type: data.type, err });
      throw err;
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("[sage-agent] Claude API call FAILED", {
        type: data.type,
        status: res.status,
        statusText: res.statusText,
        body: text,
      });
      throw new Error(`Claude API error ${res.status}: ${text}`);
    }

    console.log("[sage-agent] Claude API call OK", { type: data.type, status: res.status });

    const payload = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      payload.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

    let parsed: Record<string, string | number> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error("[sage-agent] Claude returned non-JSON response", { type: data.type, text });
        throw new Error("Claude returned non-JSON response");
      }
      parsed = JSON.parse(match[0]);
    }
    return {
      action: typeof parsed.action === "string" ? parsed.action : "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      risk_level: typeof parsed.risk_level === "string" ? parsed.risk_level : "",
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
      rule_matched: typeof parsed.rule_matched === "string" ? parsed.rule_matched : "",
      observation: typeof parsed.observation === "string" ? parsed.observation : "",
      recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : "",
      rule: typeof parsed.rule === "string" ? parsed.rule : "",
      answer: typeof parsed.answer === "string" ? parsed.answer : "",
      verdict: typeof parsed.verdict === "string" ? parsed.verdict : "",
    };
  });
