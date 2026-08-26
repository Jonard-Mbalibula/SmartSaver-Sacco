import { redirect } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  Landmark,
  User,
  TrendingUp
} from "lucide-react";
import { getMemberPortalData } from "@/lib/data";
import { createSupabaseAuthClient, hasAnonKey } from "@/lib/supabase";
import { getRoleFromUser } from "@/lib/roles";
import type { Transaction, Loan } from "@/lib/types";
import { LogoutButton } from "@/components/LogoutButton";
import { ApplyLoanForm } from "@/components/ApplyLoanForm";
import { getLoanProductsAdmin } from "@/app/actions";

export const metadata = { title: "My Account — SmartSaver Sacco" };

const money = new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 });
const fmt = (v: number) => money.format(v);
const fmtDate = (v: string) =>
  new Intl.DateTimeFormat("en-UG", { month: "short", day: "numeric", year: "numeric" }).format(new Date(v));

function TxRow({ tx }: { tx: Transaction }) {
  const isOut = tx.type === "withdrawal" || tx.type === "fee";
  const Icon = isOut ? ArrowUpRight : ArrowDownLeft;
  return (
    <tr>
      <td>
        <span className={`type-badge ${isOut ? "out" : "in"}`}>
          <Icon size={13} aria-hidden="true" />
          {tx.type.replace(/_/g, " ")}
        </span>
      </td>
      <td className="num">{fmt(Number(tx.amount))}</td>
      <td>{tx.memo ?? <span className="text-muted">—</span>}</td>
      <td>{fmtDate(tx.posted_at)}</td>
    </tr>
  );
}

function LoanRow({ loan }: { loan: Loan }) {
  const rate = loan.interest_rate ?? 0;
  const totalDue = loan.interest_rate != null
    ? Number(loan.principal) * (1 + rate / 100)
    : null;
  const monthly = (totalDue != null && loan.term_months > 0)
    ? totalDue / loan.term_months
    : null;

  return (
    <tr>
      <td className="num">{fmt(Number(loan.principal))}</td>
      <td className="num">
        {totalDue != null ? fmt(totalDue) : <span className="text-muted">—</span>}
      </td>
      <td>
        {loan.interest_rate != null
          ? <>{loan.interest_rate}% / {loan.term_months}mo</>
          : <span className="text-muted">Awaiting approval</span>}
      </td>
      <td className="num">
        {monthly != null
          ? <>{fmt(monthly)}<span className="per-month">/mo</span></>
          : <span className="text-muted">—</span>}
      </td>
      <td><span className={`status status-${loan.status}`}>{loan.status}</span></td>
      <td>{fmtDate(loan.created_at)}</td>
      <td>{loan.approved_at ? fmtDate(loan.approved_at) : <span className="text-muted">—</span>}</td>
    </tr>
  );
}

export default async function MemberPortalPage() {
  // Must be logged in as member role
  let userId: string | null = null;
  let userEmail: string | null = null;

  if (hasAnonKey()) {
    try {
      const auth = await createSupabaseAuthClient();
      const { data: { user } } = await auth.auth.getUser();
      if (!user) redirect("/login");
      const role = getRoleFromUser(user);
      if (role === "admin") redirect("/dashboard");
      userId = user.id;
      userEmail = user.email ?? null;
    } catch {
      redirect("/login");
    }
  }

  const detail = userId ? await getMemberPortalData(userId) : null;

  // Fetch active loan products
  const loanProductsResult = await getLoanProductsAdmin();
  const loanProducts = loanProductsResult.success 
    ? (loanProductsResult.products ?? []).filter(p => p.is_active) 
    : [];

  // Calculate membership days for eligibility
  const membershipDays = detail 
    ? Math.floor((Date.now() - new Date(detail.member.joined_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <main>
      {/* Top bar */}
      <header className="shell topbar">
        <div className="brand">
          <Landmark size={52} className="brand-icon" aria-hidden="true" />
          <div>
            <strong>SmartSaver Sacco</strong>
            <span>Member portal</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="role-badge role-member">Member</span>
          {userEmail && <span className="topbar-user">{userEmail}</span>}
          <LogoutButton />
        </div>
      </header>

      {/* Member header */}
      {detail ? (
        <>
          <section className="shell member-header panel" style={{ marginTop: 24 }}>
            <div className="member-avatar">
              <User size={32} aria-hidden="true" />
            </div>
            <div className="member-meta">
              <div className="member-name-row">
                <h1>{detail.member.full_name}</h1>
                <span className={`status status-member-${detail.member.status}`}>{detail.member.status}</span>
              </div>
              <div className="member-details">
                <span>{detail.member.phone}</span>
                {detail.member.national_id && <span>ID: {detail.member.national_id}</span>}
                <span>Member since {fmtDate(detail.member.joined_at)}</span>
              </div>
            </div>
          </section>

          {/* Balance KPIs */}
          <section className="shell kpi-grid member-kpis" aria-label="Account summary">
            <div className="kpi kpi-green">
              <div><p>Net savings balance</p><strong>{fmt(detail.balance)}</strong></div>
              <Banknote aria-hidden="true" />
            </div>
            <div className="kpi kpi-green">
              <div><p>Total deposits</p><strong>{fmt(detail.totalDeposits)}</strong></div>
              <ArrowDownLeft aria-hidden="true" />
            </div>
            <div className="kpi kpi-red">
              <div><p>Total withdrawals</p><strong>{fmt(detail.totalWithdrawals)}</strong></div>
              <ArrowUpRight aria-hidden="true" />
            </div>
            <div className="kpi kpi-blue">
              <div><p>Loan repayments made</p><strong>{fmt(detail.totalLoanPayments)}</strong></div>
              <CircleDollarSign aria-hidden="true" />
            </div>
          </section>

          {/* Tables + apply form */}
          <section className="shell data-grid" style={{ marginBottom: 0 }}>
            {/* Transaction history */}
            <div className="panel table-panel">
              <div className="panel-head">
                <div>
                  <h2>My Transactions</h2>
                  <p>Your complete savings movement history.</p>
                </div>
                <Banknote aria-hidden="true" />
              </div>
              {detail.transactions.length === 0 ? (
                <p className="empty-state">No transactions on your account yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Memo</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.transactions.map((tx) => (
                      <TxRow key={tx.id} tx={tx} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Loans */}
            <div className="panel table-panel">
              <div className="panel-head">
                <div>
                  <h2>My Loans</h2>
                  <p>Your active and past loan records.</p>
                </div>
                <Landmark aria-hidden="true" />
              </div>
              {detail.loans.length === 0 ? (
                <p className="empty-state">You have no loan records yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Principal</th>
                      <th>Total due</th>
                      <th>Terms</th>
                      <th>Monthly</th>
                      <th>Status</th>
                      <th>Applied</th>
                      <th>Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.loans.map((loan) => (
                      <LoanRow key={loan.id} loan={loan} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Apply for loan */}
          <section className="shell members-section">
            <div className="panel" id="apply-loan" style={{ maxWidth: 520 }}>
              <div className="panel-head">
                <div>
                  <h2>Apply for a Loan</h2>
                  <p>Submit a loan application for admin review and approval.</p>
                </div>
                <TrendingUp aria-hidden="true" />
              </div>
              <ApplyLoanForm 
                savingsBalance={detail.balance} 
                loanProducts={loanProducts}
                membershipDays={membershipDays}
              />
            </div>
          </section>
        </>
      ) : (
        /* Account not linked yet */
        <section className="shell" style={{ marginTop: 48, maxWidth: 560 }}>
          <div className="panel not-linked-panel">
            <div className="not-linked-icon" aria-hidden="true">
              <User size={40} />
            </div>
            <h2>Account not linked yet</h2>
            <p>
              Your login account hasn&apos;t been connected to a member record.
              Please contact your SACCO administrator to link your account so you can
              view your savings, transactions, and apply for loans.
            </p>
            <div style={{ marginTop: 20 }}>
              <LogoutButton />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
