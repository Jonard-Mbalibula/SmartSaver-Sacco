import type { DashboardData } from "./types";

const d = (daysAgo: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - daysAgo);
  return dt.toISOString();
};

export const demoData: DashboardData = {
  connected: false,
  members: [
    {
      id: "demo-member-1",
      full_name: "Amina Nakuya",
      phone: "+256700000001",
      national_id: "CM000001",
      status: "active",
      joined_at: d(120)
    },
    {
      id: "demo-member-2",
      full_name: "David Okello",
      phone: "+256700000002",
      national_id: "CM000002",
      status: "active",
      joined_at: d(90)
    },
    {
      id: "demo-member-3",
      full_name: "Sarah Namuli",
      phone: "+256700000003",
      national_id: "CM000003",
      status: "active",
      joined_at: d(60)
    },
    {
      id: "demo-member-4",
      full_name: "James Ssemakula",
      phone: "+256700000004",
      national_id: "CM000004",
      status: "paused",
      joined_at: d(200)
    }
  ],
  transactions: [
    {
      id: "demo-tx-1",
      member_id: "demo-member-1",
      type: "deposit",
      amount: 125000,
      memo: "Weekly savings",
      posted_at: d(1),
      members: { full_name: "Amina Nakuya", phone: "+256700000001" }
    },
    {
      id: "demo-tx-2",
      member_id: "demo-member-2",
      type: "withdrawal",
      amount: 40000,
      memo: "Member withdrawal",
      posted_at: d(2),
      members: { full_name: "David Okello", phone: "+256700000002" }
    },
    {
      id: "demo-tx-3",
      member_id: "demo-member-3",
      type: "deposit",
      amount: 200000,
      memo: "Monthly contribution",
      posted_at: d(3),
      members: { full_name: "Sarah Namuli", phone: "+256700000003" }
    },
    {
      id: "demo-tx-4",
      member_id: "demo-member-1",
      type: "loan_payment",
      amount: 85000,
      memo: "Loan instalment #1",
      posted_at: d(5),
      members: { full_name: "Amina Nakuya", phone: "+256700000001" }
    },
    {
      id: "demo-tx-5",
      member_id: "demo-member-2",
      type: "deposit",
      amount: 50000,
      memo: "Weekly savings",
      posted_at: d(7),
      members: { full_name: "David Okello", phone: "+256700000002" }
    },
    {
      id: "demo-tx-6",
      member_id: "demo-member-3",
      type: "fee",
      amount: 5000,
      memo: "Annual membership fee",
      posted_at: d(10),
      members: { full_name: "Sarah Namuli", phone: "+256700000003" }
    }
  ],
  loans: [
    {
      id: "demo-loan-1",
      member_id: "demo-member-1",
      principal: 500000,
      interest_rate: 5,
      term_months: 6,
      status: "approved",
      approved_at: d(15),
      created_at: d(20),
      members: { full_name: "Amina Nakuya", phone: "+256700000001" }
    },
    {
      id: "demo-loan-2",
      member_id: "demo-member-2",
      principal: 300000,
      interest_rate: null,
      term_months: 3,
      status: "pending",
      approved_at: null,
      created_at: d(3),
      members: { full_name: "David Okello", phone: "+256700000002" }
    },
    {
      id: "demo-loan-3",
      member_id: "demo-member-3",
      principal: 750000,
      interest_rate: null,
      term_months: 12,
      status: "pending",
      approved_at: null,
      created_at: d(1),
      members: { full_name: "Sarah Namuli", phone: "+256700000003" }
    }
  ],
  totals: {
    deposits: 375000,
    withdrawals: 40000,
    loanPayments: 85000,
    activeMembers: 3,
    pendingLoans: 2,
    portfolio: 1550000,
    interestCollected: 25000,   // 500000 * 5% on the approved demo loan
    netSavings: 335000          // 375000 deposits - 40000 withdrawals
  }
};
