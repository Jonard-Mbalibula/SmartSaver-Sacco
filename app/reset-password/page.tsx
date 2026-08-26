import { Landmark } from "lucide-react";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata = { title: "Set new password — SmartSaver Sacco" };

export default function ResetPasswordPage() {
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

        <h1>Set new password</h1>
        <p className="login-sub">Choose a strong password for your account.</p>

        <ResetPasswordForm />
      </div>

      <div className="login-visual" aria-hidden="true">
        <div className="login-visual-inner">
          <p className="eyebrow">SmartSaver Sacco</p>
          <blockquote>
            "Security and simplicity — exactly what a SACCO operations desk needs."
          </blockquote>
          <cite>— IT Administrator</cite>
          <div className="visual-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    </div>
  );
}
