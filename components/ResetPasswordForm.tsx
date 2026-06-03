"use client";

import { useActionState, useState } from "react";
import { resetPasswordAction } from "@/app/actions";
import type { ActionResult } from "@/lib/types";
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react";

const initial: ActionResult = { success: false };

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (state.success) {
    return (
      <div className="auth-success">
        <CheckCircle size={40} className="auth-success-icon" aria-hidden="true" />
        <h2>Password updated</h2>
        <p>{state.message}</p>
        <a href="/login" className="btn-login" style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          Sign in now
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

      <label>
        New password
        <span className="pwd-wrap">
          <input
            name="password"
            type={showPwd ? "text" : "password"}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button
            type="button"
            className="pwd-toggle"
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? "Hide" : "Show"}
          >
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>

      <label>
        Confirm new password
        <span className="pwd-wrap">
          <input
            name="confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="Repeat new password"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className="pwd-toggle"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Hide" : "Show"}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>

      <button type="submit" disabled={pending} className="btn-login">
        <Lock size={16} aria-hidden="true" />
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
