import Link from "next/link";
import { ArrowLeft, Landmark } from "lucide-react";
import { RegisterForm } from "@/components/RegisterForm";

export const metadata = { title: "Create account — SmartSaver Sacco" };

export default function RegisterPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <Landmark size={56} className="brand-icon" aria-hidden="true" />
          <div>
            <strong>SmartSaver Sacco</strong>
            <span>Financial Operations Console</span>
          </div>
        </div>

        <h1>Create account</h1>
        <p className="login-sub">Set up your operator account to access the dashboard.</p>

        <RegisterForm />

        <div className="auth-links">
          <span>Already have an account?</span>
          <span className="auth-sep"> </span>
          <Link href="/login">Sign in</Link>
        </div>

        <Link href="/" className="back-home">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to home
        </Link>
      </div>

      <div className="login-visual" aria-hidden="true">
        <div className="login-visual-inner">
          <p className="eyebrow">SmartSaver Sacco</p>
          <blockquote>
            "From registration to loan approval — everything our branch needs is right here."
          </blockquote>
          <cite>— Savings Operations Officer</cite>
          <div className="visual-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    </div>
  );
}
