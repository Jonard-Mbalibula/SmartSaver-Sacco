import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import brandImage from "../../image.png";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata = { title: "Reset password — SmartSaver Sacco" };

export default function ForgotPasswordPage() {
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

        <h1>Reset password</h1>

        <ForgotPasswordForm />

        <div className="auth-links" style={{ marginTop: 16 }}>
          <Link href="/login" className="back-home" style={{ marginTop: 0 }}>
            <ArrowLeft size={14} aria-hidden="true" />
            Back to sign in
          </Link>
        </div>
      </div>

      <div className="login-visual" aria-hidden="true">
        <div className="login-visual-inner">
          <p className="eyebrow">SmartSaver Sacco</p>
          <blockquote>
            "Secure, reliable, and always there when we need it most."
          </blockquote>
          <cite>— Branch Manager</cite>
          <div className="visual-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    </div>
  );
}
