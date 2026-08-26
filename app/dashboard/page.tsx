import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeDollarSign,
  Banknote,
  CircleDollarSign,
  Database,
  FileText,
  Landmark,
  Plus,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users
} from "lucide-react";
import { getDashboardData } from "@/lib/data";
import type { Loan, Member, Transaction } from "@/lib/types";
import { AddMemberForm } from "@/components/AddMemberForm";
import { RecordTransactionForm } from "@/components/RecordTransactionForm";
import { CreateLoanForm } from "@/components/CreateLoanForm";
import { LoanActions } from "@/components/LoanActions";
import { LogoutButton } from "@/components/LogoutButton";
import { UserRoleManager } from "@/components/UserRoleManager";
import { MemberStatusActions } from "@/components/MemberStatusActions";
import { ReportDownload } from "@/components/ReportDownload";
import { LoanProductForm } from "@/components/LoanProductForm";
import { LoanProductList } from "@/components/LoanProductList";
import { AuditLogViewer } from "@/components/AuditLogViewer";
import { createSupabaseAuthClient, createSupabaseServerClient, hasAnonKey, hasSupabaseConfig } from "@/lib/supabase";
import { getLoanProductsAdmin, getAuditLogs } from "@/app/actions";

export const metadata = { title: "Admin Dashboard — SmartSaver Sacco" };

const money = new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 });
const fmt = (v: number) => money.format(v);
const fmtDate = (v: string) =>
  new Intl.DateTimeFormat("en-UG", { month: "short", day: "numeric", year: "numeric" }).format(new Date(v));

function Kpi({ label, value, tone, icon: Icon }: { label: string; value: string; tone: "green" | "blue" | "amber" | "red"; icon: typeof Banknote }) {
  return (
    <section className={`kpi kpi-${tone}`}>
      <div><p>{label}</p><strong>{value}</strong></div>
      <Icon aria-hidden="true" />
    </section>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isOut = tx.type === "withdrawal" || tx.type === "fee";
  const Icon = isOut ? ArrowUpRight : ArrowDownLeft;
  return (
    <tr>
      <td>
        <span className={`type-badge ${isOut ? "out" : "in"}`}>
          <Icon aria-hidden="true" size={13} />
          {tx.type.replace(/_/g, " ")}
        </span>
      </td>
      <td>{tx.members?.full_name ?? "—"}</td>
      <td className="num">{fmt(Number(tx.amount))}</td>
      <td>{fmtDate(tx.posted_at)}</td>
    </tr>
  );
}

function LoanRow({ loan }: { loan: Loan }) {
  const rate = loan.interest_rate ?? 0;
  const totalDue = Number(loan.principal) * (1 + rate / 100);
  // Monthly payment = principal * monthly_rate / (1 - (1+rate)^-n)  (simple: total/months)
  const monthlyPayment = loan.term_months > 0
    ? (Number(loan.principal) + Number(loan.principal) * rate / 100) / loan.term_months
    : 0;
  return (
    <tr>
      <td>
        <Link href={`/dashboard/members/${loan.member_id}`} className="member-link">
          {loan.members?.full_name ?? "—"}
        </Link>
      </td>
      <td className="num">{fmt(Number(loan.principal))}</td>
      <td className="num">{fmt(totalDue)}</td>
      <td className="num">
        {loan.interest_rate != null
          ? <>{fmt(monthlyPayment)}<span className="per-month">/mo</span></>
          : <span className="text-muted">pending</span>}
      </td>
      <td>{loan.interest_rate != null ? `${loan.interest_rate}%` : <span className="text-muted">—</span>}</td>
      <td><span className={`status status-${loan.status}`}>{loan.status}</span></td>
      <td><LoanActions loanId={loan.id} status={loan.status} /></td>
    </tr>
  );
}

function MemberRow({ member }: { member: Member }) {
  return (
    <tr>
      <td>
        <Link href={`/dashboard/members/${member.id}`} className="member-link">
          {member.full_name}
        </Link>
      </td>
      <td>{member.phone}</td>
      <td><span className={`status status-member-${member.status}`}>{member.status}</span></td>
      <td>{fmtDate(member.joined_at)}</td>
      <td>
        <MemberStatusActions 
          memberId={member.id} 
          memberName={member.full_name} 
          currentStatus={member.status}
        />
      </td>
    </tr>
  );
}

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  let userEmail: string | null = null;
  if (hasAnonKey()) {
    try {
      const auth = await createSupabaseAuthClient();
      const { data: { user } } = await auth.auth.getUser();
      userEmail = user?.email ?? null;
    } catch { /* demo mode */ }
  }

  // Fetch auth users + their profiles (admin-only via service role)
  type AuthUserRow = { id: string; email: string; role: string; member_id?: string | null };
  let authUsers: AuthUserRow[] = [];
  if (hasSupabaseConfig()) {
    try {
      const admin = createSupabaseServerClient();
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 100 });
      const { data: profiles } = await admin.from("user_profiles").select("id, role, member_id");
      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

      authUsers = users.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        role: (profileMap[u.id]?.role as string) ?? (u.user_metadata?.role as string) ?? "member",
        member_id: profileMap[u.id]?.member_id ?? null
      }));
    } catch { /* ignore */ }
  }

  // Fetch loan products
  const loanProductsResult = await getLoanProductsAdmin();
  const loanProducts = loanProductsResult.success ? (loanProductsResult.products ?? []) : [];

  // Fetch audit logs (recent 20 entries)
  const auditLogsResult = await getAuditLogs({ limit: 20, offset: 0 });
  const auditLogs = auditLogsResult.logs || [];
  const auditLogsTotal = auditLogsResult.total || 0;

  return (
    <main>
      {/* Topbar */}
      <header className="shell topbar">
        <div className="brand">
          <Landmark size={52} className="brand-icon" aria-hidden="true" />
          <div>
            <strong>SmartSaver Sacco</strong>
            <span>Admin console</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="role-badge role-admin">Admin</span>
          <div className={`connection ${data.connected ? "online" : "demo"}`}>
            <Database aria-hidden="true" size={14} />
            {data.connected ? "Live" : "Demo"}
          </div>
          {userEmail && <span className="topbar-user">{userEmail}</span>}
          <LogoutButton />
        </div>
      </header>

      {/* Hero */}
      <section className="shell hero-panel">
        <div>
          <p className="eyebrow">Admin — today&apos;s position</p>
          <h1>Savings, loans, and member records in one working desk.</h1>
        </div>
        <div className="hero-actions">
          <a href="#new-member">Add member</a>
          <a href="#record-money">Record money</a>
          <a href="#new-loan">New loan</a>
          <a href="#loan-products">Loan products</a>
          <a href="#audit-logs">Activity log</a>
          <a href="#reports">Reports</a>
          <a href="#users">Manage users</a>
        </div>
      </section>

      {/* KPIs */}
      <section className="shell kpi-grid kpi-grid-8" aria-label="Portfolio summary">
        <Kpi label="Total deposits" value={fmt(data.totals.deposits)} tone="green" icon={ArrowDownLeft} />
        <Kpi label="Net savings" value={fmt(data.totals.netSavings)} tone="green" icon={TrendingUp} />
        <Kpi label="Interest collected" value={fmt(data.totals.interestCollected)} tone="blue" icon={Landmark} />
        <Kpi label="Loan portfolio" value={fmt(data.totals.portfolio)} tone="blue" icon={CircleDollarSign} />
        <Kpi label="Withdrawals" value={fmt(data.totals.withdrawals)} tone="red" icon={ArrowUpRight} />
        <Kpi label="Loan repayments in" value={fmt(data.totals.loanPayments)} tone="green" icon={Banknote} />
        <Kpi label="Active members" value={String(data.totals.activeMembers)} tone="amber" icon={Users} />
        <Kpi label="Pending loans" value={String(data.totals.pendingLoans)} tone="amber" icon={ShieldCheck} />
      </section>

      {/* Workbench forms */}
      <section className="shell workbench">
        <div className="panel" id="new-member">
          <div className="panel-head">
            <div><h2>Register Member</h2><p>Create the member record used for savings and loans.</p></div>
            <Plus aria-hidden="true" />
          </div>
          <AddMemberForm />
        </div>
        <div className="panel" id="record-money">
          <div className="panel-head">
            <div><h2>Record Transaction</h2><p>Post savings deposits, withdrawals, fees, or loan payments.</p></div>
            <BadgeDollarSign aria-hidden="true" />
          </div>
          <RecordTransactionForm members={data.members} loans={data.loans} />
        </div>
        <div className="panel" id="new-loan">
          <div className="panel-head">
            <div><h2>Create Loan Request</h2><p>Start a loan record for review and approval.</p></div>
            <CircleDollarSign aria-hidden="true" />
          </div>
          <CreateLoanForm members={data.members} />
        </div>
      </section>

      {/* Data tables */}
      <section className="shell data-grid">
        <div className="panel table-panel">
          <div className="panel-head">
            <div><h2>Recent Transactions</h2><p>Latest money movement records.</p></div>
            <Banknote aria-hidden="true" />
          </div>
          {data.transactions.length === 0 ? (
            <p className="empty-state">No transactions yet.</p>
          ) : (
            <table>
              <thead><tr><th>Type</th><th>Member</th><th>Amount</th><th>Posted</th></tr></thead>
              <tbody>{data.transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}</tbody>
            </table>
          )}
        </div>
        <div className="panel table-panel">
          <div className="panel-head">
            <div><h2>Loan Queue</h2><p>Pending and active portfolio.</p></div>
            <ShieldCheck aria-hidden="true" />
          </div>
          {data.loans.length === 0 ? (
            <p className="empty-state">No loans yet.</p>
          ) : (
            <table>
              <thead><tr><th>Member</th><th>Principal</th><th>Total due</th><th>Monthly</th><th>Rate</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{data.loans.map((loan) => <LoanRow key={loan.id} loan={loan} />)}</tbody>
            </table>
          )}
        </div>
      </section>

      {/* All members */}
      <section className="shell members-section">
        <div className="panel table-panel">
          <div className="panel-head">
            <div><h2>All Members</h2><p>Click a member to view their full profile.</p></div>
            <Users aria-hidden="true" />
          </div>
          {data.members.length === 0 ? (
            <p className="empty-state">No members registered yet.</p>
          ) : (
            <table>
              <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th>Joined</th><th>Action</th></tr></thead>
              <tbody>{data.members.map((m) => <MemberRow key={m.id} member={m} />)}</tbody>
            </table>
          )}
        </div>
      </section>

      {/* Loan Products Management */}
      <section className="shell members-section" id="loan-products">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Loan Product Management</h2>
              <p>Configure loan products with eligibility rules, interest rates, and terms.</p>
            </div>
            <Settings aria-hidden="true" />
          </div>
          
          <div className="workbench" style={{ gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '14px' }}>Create Loan Product</h3>
              <LoanProductForm />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '14px' }}>Active Products</h3>
              <LoanProductList products={loanProducts} />
            </div>
          </div>
        </div>
      </section>

      {/* Audit Log Viewer */}
      <section className="shell members-section" id="audit-logs">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Recent Activity</h2>
              <p>System audit trail showing all administrative actions and security events.</p>
            </div>
            <ShieldCheck aria-hidden="true" />
          </div>
          <AuditLogViewer 
            logs={auditLogs} 
            totalCount={auditLogsTotal}
            currentPage={0}
          />
        </div>
      </section>

      {/* Users & Roles */}
      <section className="shell members-section" id="users">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Users &amp; Roles</h2>
              <p>Assign roles and link users to member records so they can access their portal.</p>
            </div>
            <Settings aria-hidden="true" />
          </div>
          <UserRoleManager users={authUsers} members={data.members} />
        </div>
      </section>

      {/* Reports */}
      <section className="shell members-section" id="reports">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Reports &amp; Summaries</h2>
              <p>Financial overview and downloadable CSV exports.</p>
            </div>
            <FileText aria-hidden="true" />
          </div>

          {/* Report KPIs */}
          <div className="report-kpis">
            <div className="report-stat">
              <span className="report-stat-label">Total deposits collected</span>
              <strong className="report-stat-value green">{fmt(data.totals.deposits)}</strong>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Total withdrawals paid out</span>
              <strong className="report-stat-value red">{fmt(data.totals.withdrawals)}</strong>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Net savings held</span>
              <strong className="report-stat-value green">{fmt(data.totals.netSavings)}</strong>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Interest earned (approved + closed loans)</span>
              <strong className="report-stat-value blue">{fmt(data.totals.interestCollected)}</strong>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Total income (savings + interest)</span>
              <strong className="report-stat-value blue">{fmt(data.totals.netSavings + data.totals.interestCollected)}</strong>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Active loan portfolio</span>
              <strong className="report-stat-value amber">{fmt(data.totals.portfolio)}</strong>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Loan repayments received</span>
              <strong className="report-stat-value green">{fmt(data.totals.loanPayments)}</strong>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Pending loan applications</span>
              <strong className="report-stat-value amber">{String(data.totals.pendingLoans)}</strong>
            </div>
          </div>

          {/* Download buttons */}
          <div className="report-downloads">
            <p className="report-downloads-label">Download as CSV</p>
            <div className="report-btn-row">
              <ReportDownload
                reportType="summary"
                totals={data.totals}
                label="Financial summary"
              />
              <ReportDownload
                reportType="transactions"
                transactions={data.transactions}
                label="Transactions"
              />
              <ReportDownload
                reportType="loans"
                loans={data.loans}
                label="Loans"
              />
              <ReportDownload
                reportType="members"
                members={data.members}
                label="Members"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
