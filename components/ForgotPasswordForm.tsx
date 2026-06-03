"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/app/actions";
import type { ActionResult } from "@/lib/types";
import { Mail, CheckCircle } from "lucide-react";

const initial: ActionResult = { success: false };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);

  if (state.success) {
    return (
      <div className="auth-success">
        <CheckCircle size={40} className="auth-success-icon" aria-hidden="true" />
        <h2>Email sent</h2>
        <p>{state.message}</p>
        <a href="/login" className="back-home" style={{ marginTop: 16 }}>
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="login-form">
      {state?.error && (
        <div className="form-feedback feedback-err" role="alert">
          {state.error}
        </div>
      )}
      <p className="login-sub" style={{ margin: 0 }}>
        Enter the email address linked to your account and we will send a reset link.
      </p>
      <label>
        Email address
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </label>
      <button type="submit" disabled={pending} className="btn-login">
        <Mail size={16} aria-hidden="true" />
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
