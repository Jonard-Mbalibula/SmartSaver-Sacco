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

export type ActionResult = {
  success: boolean;
  error?: string;
  message?: string;
};
