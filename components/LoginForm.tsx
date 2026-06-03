"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";
import type { ActionResult } from "@/lib/types";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState } from "react";

const initial: ActionResult = { success: false };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  const [showPwd, setShowPwd] = useState(false);

  return (
    <form action={action} className="login-form">
      {state?.error && (
        <div className="form-feedback feedback-err" role="alert">
          {state.error}
        </div>
      )}
      <label>
        Email address
        <input
          name="email"
          type="email"
          placeholder="name@gmail.com"
          autoComplete="email"
          required
        />
      </label>
      <label>
        Password
        <span className="pwd-wrap">
          <input
            name="password"
            type={showPwd ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="pwd-toggle"
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? "Hide password" : "Show password"}
          >
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>
      <button type="submit" disabled={pending} className="btn-login">
        <LogIn size={16} aria-hidden="true" />
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
