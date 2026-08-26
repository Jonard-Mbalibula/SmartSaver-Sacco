import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  Landmark,
  User
} from "lucide-react";
import { getMemberDetail } from "@/lib/data";
import type { Loan, Transaction } from "@/lib/types";
import { LoanActions } from "@/components/LoanActions";
import { MemberStatusActions } from "@/components/MemberStatusActions";
import { TransactionReversal } from "@/components/TransactionReversal";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getMemberDetail(id);
  return { title: detail ? `${detail.member.full_name} — SmartSaver Sacco` : "Member not found" };
}

const money = new Intl.NumberFormat("en-UG", {
  style: "currency",
  currency: "UGX",
  maximumFractionDigits: 0
});

function fmt(v: number) {
  return money.format(v);
}

function fmtDate(v: string) {
  return new Intl.DateTimeFormat("en-UG", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(v));
}

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
      <td>
        <TransactionReversal transaction={tx} />
      </td>
    </tr>
  );
}

function LoanDetailRow({ loan }: { loan: Loan }) {
  const rate = loan.interest_rate ?? 0;
  const total = loan.interest_rate != null
    ? Number(loan.principal) * (1 + rate / 100)
    : null;
  const monthly = (total != null && loan.term_months > 0)
    ? total / loan.term_months
    : null;

  return (
    <tr>
      <td className="num">{fmt(Number(loan.principal))}</td>
      <td className="num">
        {total != null ? fmt(total) : <span className="text-muted">—</span>}
      </td>
      <td className="num">
        {monthly != null
          ? <>{fmt(monthly)}<span className="per-month">/mo</span></>
          : <span className="text-muted">—</span>}
      </td>
      <td>
        {loan.interest_rate != null
          ? `${loan.interest_rate}% / ${loan.term_months}mo`
          : <span className="text-muted">Rate pending</span>}
      </td>
      <td><span className={`status status-${loan.status}`}>{loan.status}</span></td>
      <td>{loan.approved_at ? fmtDate(loan.approved_at) : <span className="text-muted">—</span>}</td>
      <td><LoanActions loanId={loan.id} status={loan.status} /></td>
    </tr>
  );
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getMemberDetail(id);

  if (!detail) notFound();

  const { member, transactions, loans, balance, totalDeposits, totalWithdrawals, totalLoanPayments } = detail;

  return (
    <main>
      {/* Back nav */}
      <div className="shell member-nav">
        <Link href="/dashboard" className="back-link">
          <ArrowLeft size={15} aria-hidden="true" />
          Back to dashboard
        </Link>
      </div>

      {/* Member header */}
      <section className="shell member-header panel">
        <div className="member-avatar">
          <User size={32} aria-hidden="true" />
        </div>
        <div className="member-meta">
          <div className="member-name-row">
            <h1>{member.full_name}</h1>
            <span className={`status status-member-${member.status}`}>{member.status}</span>
          </div>
          <div className="member-details">
            <span>{member.phone}</span>
            {member.national_id && <span>ID: {member.national_id}</span>}
            <span>Joined {fmtDate(member.joined_at)}</span>
          </div>
        </div>
        <div className="member-actions">
          <MemberStatusActions 
            memberId={member.id} 
            memberName={member.full_name} 
            currentStatus={member.status}
          />
        </div>
      </section>

      {/* Balance KPIs */}
      <section className="shell kpi-grid member-kpis" aria-label="Member account summary">
        <div className="kpi kpi-green">
          <div>
            <p>Net balance</p>
            <strong>{fmt(balance)}</strong>
          </div>
          <Banknote aria-hidden="true" />
        </div>
        <div className="kpi kpi-green">
          <div>
            <p>Total deposits</p>
            <strong>{fmt(totalDeposits)}</strong>
          </div>
          <ArrowDownLeft aria-hidden="true" />
        </div>
        <div className="kpi kpi-red">
          <div>
            <p>Total withdrawals</p>
            <strong>{fmt(totalWithdrawals)}</strong>
          </div>
          <ArrowUpRight aria-hidden="true" />
        </div>
        <div className="kpi kpi-blue">
          <div>
            <p>Loan payments</p>
            <strong>{fmt(totalLoanPayments)}</strong>
          </div>
          <CircleDollarSign aria-hidden="true" />
        </div>
      </section>

      {/* Data tables */}
      <section className="shell data-grid">
        {/* Transaction history */}
        <div className="panel table-panel">
          <div className="panel-head">
            <div>
              <h2>Transaction History</h2>
              <p>All money movements for this member.</p>
            </div>
            <Banknote aria-hidden="true" />
          </div>
          {transactions.length === 0 ? (
            <p className="empty-state">No transactions recorded yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Memo</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
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
              <h2>Loans</h2>
              <p>All loan records for this member.</p>
            </div>
            <Landmark aria-hidden="true" />
          </div>
          {loans.length === 0 ? (
            <p className="empty-state">No loans for this member.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Principal</th>
                  <th>Total due</th>
                  <th>Monthly</th>
                  <th>Terms</th>
                  <th>Status</th>
                  <th>Approved</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <LoanDetailRow key={loan.id} loan={loan} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
