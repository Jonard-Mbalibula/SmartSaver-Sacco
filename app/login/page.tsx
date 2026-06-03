import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import brandImage from "../../image.png";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Sign in — SmartSaver Sacco" };

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <Image src={brandImage} alt="SmartSaver Sacco" width={56} height={56} priority />
          <div>
            <strong>SmartSaver Sacco</strong>
            <span>Financial Operations Console</span>
          </div>
        </div>

        <h1>Welcome back</h1>
        <p className="login-sub">Sign in to access the operations dashboard.</p>

        <LoginForm />

        <div className="auth-links">
          <Link href="/forgot-password">Forgot your password?</Link>
          <span className="auth-sep">|</span>
          <Link href="/register">Create account</Link>
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
            "Managing member savings and loans used to take hours. Now the whole team works from one screen."
          </blockquote>
          <cite>— Branch Operations Manager</cite>
          <div className="visual-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    </div>
  );
}
