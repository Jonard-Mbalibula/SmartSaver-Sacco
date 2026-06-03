import { createSupabaseServerClient, hasSupabaseConfig } from "./supabase";
import type { DashboardData, Loan, Member, MemberDetail, Transaction } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function moneyTotal(rows: Transaction[], type: Transaction["type"]) {
  return rows
    .filter((r) => r.type === type)
    .reduce((sum, r) => sum + Number(r.amount), 0);
}

function memberMap(members: Member[]): Record<string, Pick<Member, "full_name" | "phone">> {
  return Object.fromEntries(members.map((m) => [m.id, { full_name: m.full_name, phone: m.phone }]));
}

/** Interest earned on a single closed/approved loan: principal * rate% */
function loanInterest(loan: Pick<Loan, "principal" | "interest_rate" | "status">): number {
  if (loan.interest_rate == null) return 0;
  if (loan.status !== "closed" && loan.status !== "approved") return 0;
  return Number(loan.principal) * (Number(loan.interest_rate) / 100);
}

// ---------------------------------------------------------------------------
// Demo fallback data (inline so demo-data.ts isn't needed at runtime)
// ---------------------------------------------------------------------------

function getDemoData(): DashboardData {
  const d = (daysAgo: number) => {
    const dt = new Date(); dt.setDate(dt.getDate() - daysAgo); return dt.toISOString();
  };
  const members: Member[] = [
    { id: "demo-1", full_name: "Amina Nakuya",    phone: "+256700000001", national_id: "CM000001", status: "active", joined_at: d(120) },
    { id: "demo-2", full_name: "David Okello",    phone: "+256700000002", national_id: "CM000002", status: "active", joined_at: d(90) },
    { id: "demo-3", full_name: "Sarah Namuli",    phone: "+256700000003", national_id: "CM000003", status: "active", joined_at: d(60) },
    { id: "demo-4", full_name: "James Ssemakula", phone: "+256700000004", national_id: "CM000004", status: "paused", joined_at: d(200) },
  ];
  const transactions: Transaction[] = [
    { id: "t1", member_id: "demo-1", type: "deposit",      amount: 125000, memo: "Weekly savings",       posted_at: d(1),  members: { full_name: "Amina Nakuya", phone: "+256700000001" } },
    { id: "t2", member_id: "demo-2", type: "withdrawal",   amount: 40000,  memo: "Member withdrawal",    posted_at: d(2),  members: { full_name: "David Okello", phone: "+256700000002" } },
    { id: "t3", member_id: "demo-3", type: "deposit",      amount: 200000, memo: "Monthly contribution", posted_at: d(3),  members: { full_name: "Sarah Namuli", phone: "+256700000003" } },
    { id: "t4", member_id: "demo-1", type: "loan_payment", amount: 85000,  memo: "Loan instalment #1",   posted_at: d(5),  members: { full_name: "Amina Nakuya", phone: "+256700000001" } },
    { id: "t5", member_id: "demo-2", type: "deposit",      amount: 50000,  memo: "Weekly savings",       posted_at: d(7),  members: { full_name: "David Okello", phone: "+256700000002" } },
    { id: "t6", member_id: "demo-3", type: "fee",          amount: 5000,   memo: "Annual membership fee",posted_at: d(10), members: { full_name: "Sarah Namuli", phone: "+256700000003" } },
  ];
  const loans: Loan[] = [
    { id: "l1", member_id: "demo-1", principal: 500000, interest_rate: 5,    term_months: 6,  status: "approved", approved_at: d(15), created_at: d(20), members: { full_name: "Amina Nakuya", phone: "+256700000001" } },
    { id: "l2", member_id: "demo-2", principal: 300000, interest_rate: null, term_months: 3,  status: "pending",  approved_at: null,  created_at: d(3),  members: { full_name: "David Okello", phone: "+256700000002" } },
    { id: "l3", member_id: "demo-3", principal: 750000, interest_rate: null, term_months: 12, status: "pending",  approved_at: null,  created_at: d(1),  members: { full_name: "Sarah Namuli", phone: "+256700000003" } },
  ];
  const deposits    = transactions.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
  const withdrawals = transactions.filter(t => t.type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0);
  const interestCollected = loans.reduce((s, l) => s + loanInterest(l), 0);
  return {
    connected: false, members, transactions, loans,
    totals: {
      deposits, withdrawals,
      loanPayments: transactions.filter(t => t.type === "loan_payment").reduce((s, t) => s + Number(t.amount), 0),
      activeMembers: members.filter(m => m.status === "active").length,
      pendingLoans: loans.filter(l => l.status === "pending").length,
      portfolio: loans.filter(l => l.status === "approved" || l.status === "pending").reduce((s, l) => s + Number(l.principal), 0),
      interestCollected,
      netSavings: deposits - withdrawals,
    }
  };
}

// ---------------------------------------------------------------------------
// ADMIN: Full dashboard data
// ---------------------------------------------------------------------------

export async function getDashboardData(): Promise<DashboardData> {
  if (!hasSupabaseConfig()) return getDemoData();

  const supabase = createSupabaseServerClient();

  const [membersResult, transactionsResult, loansResult, allTxResult] = await Promise.all([
    supabase.from("members").select("id, full_name, phone, national_id, status, joined_at, created_at").order("joined_at", { ascending: false }),
    supabase.from("transactions").select("id, member_id, type, amount, memo, posted_at").order("posted_at", { ascending: false }).limit(50),
    supabase.from("loans").select("id, member_id, principal, interest_rate, term_months, status, approved_at, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("transactions").select("type, amount"),
  ]);

  if (membersResult.error) {
    console.error("members error:", membersResult.error.message);
    return getDemoData();
  }

  const members = (membersResult.data ?? []) as Member[];
  const mmap = memberMap(members);

  const rawTx = (transactionsResult.data ?? []) as Array<Omit<Transaction, "members">>;
  if (transactionsResult.error) console.error("transactions error:", transactionsResult.error.message);
  const transactions: Transaction[] = rawTx.map((t) => ({ ...t, members: mmap[t.member_id] ?? null }));

  const rawLoans = (loansResult.data ?? []) as Array<Omit<Loan, "members">>;
  if (loansResult.error) console.error("loans error:", loansResult.error.message);
  const loans: Loan[] = rawLoans.map((l) => ({ ...l, members: mmap[l.member_id] ?? null }));

  const allTx = (allTxResult.data ?? []) as { type: string; amount: number }[];
  const deposits    = allTx.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
  const withdrawals = allTx.filter(t => t.type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0);

  // Interest collected = sum of (principal × rate%) for all closed + approved loans
  const interestCollected = loans.reduce((s, l) => s + loanInterest(l), 0);

  return {
    connected: true,
    members,
    transactions,
    loans,
    totals: {
      deposits,
      withdrawals,
      loanPayments: allTx.filter(t => t.type === "loan_payment").reduce((s, t) => s + Number(t.amount), 0),
      activeMembers: members.filter(m => m.status === "active").length,
      pendingLoans: loans.filter(l => l.status === "pending").length,
      portfolio: loans.filter(l => l.status === "approved" || l.status === "pending").reduce((s, l) => s + Number(l.principal), 0),
      interestCollected,
      netSavings: deposits - withdrawals,
    }
  };
}

// ---------------------------------------------------------------------------
// ADMIN: Member detail
// ---------------------------------------------------------------------------

export async function getMemberDetail(memberId: string): Promise<MemberDetail | null> {
  if (!hasSupabaseConfig()) {
    const demo = getDemoData();
    const member = demo.members.find(m => m.id === memberId);
    if (!member) return null;
    const transactions = demo.transactions.filter(t => t.member_id === memberId);
    const loans = demo.loans.filter(l => l.member_id === memberId);
    const totalDeposits = moneyTotal(transactions, "deposit");
    const totalWithdrawals = moneyTotal(transactions, "withdrawal");
    const totalLoanPayments = moneyTotal(transactions, "loan_payment");
    return { member, transactions, loans, balance: totalDeposits - totalWithdrawals, totalDeposits, totalWithdrawals, totalLoanPayments };
  }

  const supabase = createSupabaseServerClient();
  const [memberResult, txResult, loanResult] = await Promise.all([
    supabase.from("members").select("*").eq("id", memberId).single(),
    supabase.from("transactions").select("id, member_id, type, amount, memo, posted_at").eq("member_id", memberId).order("posted_at", { ascending: false }),
    supabase.from("loans").select("id, member_id, principal, interest_rate, term_months, status, approved_at, created_at").eq("member_id", memberId).order("created_at", { ascending: false }),
  ]);

  if (memberResult.error || !memberResult.data) return null;

  const member = memberResult.data as Member;
  const transactions = (txResult.data ?? []) as Transaction[];
  const loans = (loanResult.data ?? []) as Loan[];
  const totalDeposits = moneyTotal(transactions, "deposit");
  const totalWithdrawals = moneyTotal(transactions, "withdrawal");
  const totalLoanPayments = moneyTotal(transactions, "loan_payment");

  return { member, transactions, loans, balance: totalDeposits - totalWithdrawals, totalDeposits, totalWithdrawals, totalLoanPayments };
}

// ---------------------------------------------------------------------------
// MEMBER PORTAL
// ---------------------------------------------------------------------------

export async function getMemberByUserId(userId: string): Promise<Member | null> {
  if (!hasSupabaseConfig()) return getDemoData().members[0] ?? null;

  const supabase = createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase.from("user_profiles").select("member_id").eq("id", userId).single();
  if (profileError || !profile?.member_id) return null;

  const { data: member, error } = await supabase.from("members").select("*").eq("id", profile.member_id).single();
  if (error || !member) return null;
  return member as Member;
}

export async function getMemberPortalData(userId: string): Promise<MemberDetail | null> {
  if (!hasSupabaseConfig()) {
    const demo = getDemoData();
    const member = demo.members[0];
    if (!member) return null;
    const transactions = demo.transactions.filter(t => t.member_id === member.id);
    const loans = demo.loans.filter(l => l.member_id === member.id);
    const totalDeposits = moneyTotal(transactions, "deposit");
    const totalWithdrawals = moneyTotal(transactions, "withdrawal");
    const totalLoanPayments = moneyTotal(transactions, "loan_payment");
    return { member, transactions, loans, balance: totalDeposits - totalWithdrawals, totalDeposits, totalWithdrawals, totalLoanPayments };
  }

  const supabase = createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase.from("user_profiles").select("member_id").eq("id", userId).single();
  if (profileError || !profile?.member_id) return null;
  const memberId = profile.member_id as string;

  const [memberResult, txResult, loanResult] = await Promise.all([
    supabase.from("members").select("*").eq("id", memberId).single(),
    supabase.from("transactions").select("id, member_id, type, amount, memo, posted_at").eq("member_id", memberId).order("posted_at", { ascending: false }),
    supabase.from("loans").select("id, member_id, principal, interest_rate, term_months, status, approved_at, created_at").eq("member_id", memberId).order("created_at", { ascending: false }),
  ]);

  if (memberResult.error || !memberResult.data) return null;

  const member = memberResult.data as Member;
  const transactions = (txResult.data ?? []) as Transaction[];
  const loans = (loanResult.data ?? []) as Loan[];
  const totalDeposits = moneyTotal(transactions, "deposit");
  const totalWithdrawals = moneyTotal(transactions, "withdrawal");
  const totalLoanPayments = moneyTotal(transactions, "loan_payment");

  return { member, transactions, loans, balance: totalDeposits - totalWithdrawals, totalDeposits, totalWithdrawals, totalLoanPayments };
}

// ---------------------------------------------------------------------------
// ADMIN: Members list with search
// ---------------------------------------------------------------------------

export async function getAllMembers(search?: string): Promise<Member[]> {
  if (!hasSupabaseConfig()) return getDemoData().members;

  const supabase = createSupabaseServerClient();
  let query = supabase.from("members").select("*").order("joined_at", { ascending: false });
  if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as Member[];
}
