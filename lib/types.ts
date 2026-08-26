export type Role = "admin" | "member";

export type Member = {
  id: string;
  full_name: string;
  phone: string;
  national_id: string | null;
  status: "active" | "paused" | "closed";
  joined_at: string;
  balance?: number;
};

export type Transaction = {
  id: string;
  member_id: string;
  type: "deposit" | "withdrawal" | "loan_payment" | "fee" | "adjustment";
  amount: number;
  memo: string | null;
  posted_at: string;
  status: "posted" | "reversed" | "reversal" | "adjustment";
  txn_reference: string | null;
  reversal_reason: string | null;
  members?: Pick<Member, "full_name" | "phone"> | null;
};

export type Loan = {
  id: string;
  member_id: string;
  principal: number;
  interest_rate: number | null;   // null until admin sets it on approval
  term_months: number;
  status: "pending" | "approved" | "rejected" | "closed";
  approved_at: string | null;
  created_at: string;
  members?: Pick<Member, "full_name" | "phone"> | null;
};

export type DashboardData = {
  connected: boolean;
  members: Member[];
  transactions: Transaction[];
  loans: Loan[];
  totals: {
    deposits: number;
    withdrawals: number;
    loanPayments: number;
    activeMembers: number;
    pendingLoans: number;
    portfolio: number;
    interestCollected: number;   // interest earned on closed/approved loans
    netSavings: number;          // deposits - withdrawals
  };
};

export type MemberDetail = {
  member: Member;
  transactions: Transaction[];
  loans: Loan[];
  balance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalLoanPayments: number;
};

/** Links a Supabase auth user to a members row + stores role */
export type UserProfile = {
  id: string;          // auth.users.id
  member_id: string | null;
  role: Role;
  created_at: string;
};

/** Audit log entry for financial and administrative actions */
export type AuditLog = {
  id: string;
  actor_user_id: string | null;
  actor_role: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type ActionResult = {
  success: boolean;
  error?: string;
  message?: string;
  data?: unknown; // Optional data field for bulk operations
};

export type LoanProduct = {
  id: string;
  name: string;
  description: string | null;
  interest_rate_min: number;
  interest_rate_max: number;
  interest_rate_default: number;
  principal_min: number;
  principal_max: number;
  term_min_months: number;
  term_max_months: number;
  savings_multiplier: number;
  min_membership_days: number;
  requires_guarantor: boolean;
  is_active: boolean;
};
