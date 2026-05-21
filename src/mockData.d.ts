declare module "@/mockData" {
  export interface Insight {
    id: string;
    observation: string;
    recommendation: string;
    confidence: number;
  }
  export interface PendingAction {
    id: string;
    action: string;
    risk: "low" | "medium" | "high";
    confidence: number;
    reasoning: string;
    rule: string;
  }
  export interface AuditEntry {
    id: string;
    date: string;
    action: string;
    decision: "Approved" | "Rejected" | "Edited" | "Auto-approved";
    confidence: number;
    summary: string;
  }
  export interface Transaction {
    date: string;
    merchant: string;
    amount: number;
  }
  export const initialInsights: Insight[];
  export const initialPending: PendingAction[];
  export const initialAudit: AuditEntry[];
  export const initialTransactions: Transaction[];
}
