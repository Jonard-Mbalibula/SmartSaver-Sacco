import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  CircleDollarSign,
  Landmark,
  ShieldCheck,
  Users,
  Zap
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Member Registry",
    desc: "Register members, track their status, and maintain a full profile with savings history."
  },
  {
    icon: BadgeDollarSign,
    title: "Savings & Transactions",
    desc: "Post deposits, withdrawals, fees, and loan payments with real-time balance tracking."
  },
  {
    icon: CircleDollarSign,
    title: "Loan Management",
    desc: "Create loan requests, approve or reject them, and monitor the full loan portfolio."
  },
  {
    icon: Landmark,
    title: "Portfolio Dashboard",
    desc: "Instant snapshot of total deposits, withdrawals, active members, and loan portfolio."
  },
  {
    icon: ShieldCheck,
    title: "Secure & Reliable",
    desc: "Built on Supabase — your data is encrypted, backed up, and accessible anywhere."
  },
  {
    icon: Zap,
    title: "Fast Operations",
    desc: "Purpose-built for the counter — every action is one click away, no slow menus."
  }
];

export default function HomePage() {
  return (
    <div className="home-page">
      {/* ── Nav ── */}
      <nav className="home-nav shell">
        <div className="brand">
          <Landmark size={44} className="brand-icon" aria-hidden="true" />
          <div>
            <strong>SmartSaver Sacco</strong>
            <span>Financial Operations</span>
          </div>
        </div>
        <Link href="/login" className="btn-primary">
          Sign in <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="home-hero-content shell">
          <p className="eyebrow">Built To manage SACCO FINANCIAL</p>
          <h1>
            Savings, loans, and member records —<br />
            in one working desk.
          </h1>
          <p className="hero-sub">
            SmartSaver Sacco gives your team a fast, reliable operations console to manage
            deposits, withdrawals, loan approvals, and member accounts without the paperwork.
          </p>
          <div className="hero-cta">
            <Link href="/login" className="btn-primary btn-lg">
              Go to dashboard <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a href="#features" className="btn-ghost btn-lg">
              See features
            </a>
          </div>
        </div>
        <div className="home-hero-visual" aria-hidden="true">
          <div className="mock-dashboard">
            <div className="mock-kpi green" />
            <div className="mock-kpi blue" />
            <div className="mock-kpi amber" />
            <div className="mock-kpi red" />
            <div className="mock-table" />
            <div className="mock-table short" />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="home-stats shell">
        <div className="stat-card">
          <strong>UGX</strong>
          <span>Currency supported</span>
        </div>
        <div className="stat-card">
          <strong>5 tx types</strong>
          <span>Deposit · Withdrawal · Loan payment · Fee · Adjustment</span>
        </div>
        <div className="stat-card">
          <strong>Real-time</strong>
          <span>Balance per member, always up to date</span>
        </div>
        <div className="stat-card">
          <strong>Demo mode</strong>
          <span>Works without a database for evaluation</span>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="home-features shell" id="features">
        <div className="section-head">
          <h2>Everything your SACCO team needs at the counter</h2>
          <p>No bloated banking software. No Excel sheets. Just a focused tool for daily operations.</p>
        </div>
        <div className="features-grid">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="feature-card">
              <div className="feature-icon">
                <Icon size={22} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="home-cta-banner">
        <div className="shell">
          <h2>Ready to go paperless?</h2>
          <p>Sign in to your operations console and start managing members and transactions today.</p>
          <Link href="/login" className="btn-primary btn-lg">
            Open dashboard <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="home-footer shell">
        <div className="brand">
          <Landmark size={32} className="brand-icon" aria-hidden="true" />
          <span>Kyezabu CybetHut © {new Date().getFullYear()}</span>
        </div>
        <nav aria-label="Footer links">
          <Link href="/login">Sign in</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </footer>
    </div>
  );
}
