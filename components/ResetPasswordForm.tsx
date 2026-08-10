"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, CheckCircle, AlertTriangle, Loader } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Stage = "loading" | "ready" | "success" | "error";

export function ResetPasswordForm() {
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  // On mount: handle both token flows:
  // 1. Hash flow (legacy): #access_token=...&refresh_token=...&type=recovery
  // 2. PKCE flow (newer): auth-callback already exchanged the code and set the
  //    session cookie — we just need to verify the session is a recovery session.
  useEffect(() => {
    async function init() {
      const supabase = createSupabaseBrowserClient();

      // ── Hash flow ──────────────────────────────────────────────────────────
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const hashType = params.get("type");

      if (accessToken && refreshToken && hashType === "recovery") {
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (error) {
            setErrorMsg(error.message);
            setStage("error");
          } else {
            // Clear the hash so tokens aren't visible in the URL
            window.history.replaceState(null, "", window.location.pathname);
            setStage("ready");
          }
        } catch (e) {
          setErrorMsg((e as Error).message);
          setStage("error");
        }
        return;
      }

      // ── PKCE flow ──────────────────────────────────────────────────────────
      // auth-callback already exchanged the code; check we have a valid session.
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          setErrorMsg("Invalid or expired reset link. Please request a new one.");
          setStage("error");
          return;
        }
        setStage("ready");
      } catch (e) {
        setErrorMsg((e as Error).message);
        setStage("error");
      }
    }

    init();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    setErrorMsg("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMsg(error.message);
        setBusy(false);
      } else {
        // Sign out so they log in fresh with the new password
        await supabase.auth.signOut();
        setStage("success");
      }
    } catch (e) {
      setErrorMsg((e as Error).message);
      setBusy(false);
    }
  }

  // Loading — exchanging the token
  if (stage === "loading") {
    return (
      <div className="auth-success" style={{ padding: "32px 0" }}>
        <Loader size={36} className="auth-success-icon spin" aria-hidden="true" />
        <p style={{ color: "var(--muted)", marginTop: 12 }}>Verifying reset link…</p>
      </div>
    );
  }

  // Invalid / expired link
  if (stage === "error") {
    return (
      <div className="auth-success">
        <AlertTriangle size={36} style={{ color: "var(--red)" }} aria-hidden="true" />
        <h2 style={{ color: "var(--red)" }}>Link invalid</h2>
        <p>{errorMsg}</p>
        <a
          href="/forgot-password"
          className="btn-login"
          style={{ marginTop: 16, display: "flex", justifyContent: "center" }}
        >
          Request a new link
        </a>
      </div>
    );
  }

  // Success
  if (stage === "success") {
    return (
      <div className="auth-success">
        <CheckCircle size={40} className="auth-success-icon" aria-hidden="true" />
        <h2>Password updated</h2>
        <p>Your password has been changed. You can now sign in with your new password.</p>
        <a
          href="/login"
          className="btn-login"
          style={{ marginTop: 16, display: "flex", justifyContent: "center" }}
        >
          Sign in now
        </a>
      </div>
    );
  }

  // Ready — show the form
  return (
    <form onSubmit={handleSubmit} className="login-form">
      {errorMsg && (
        <div className="form-feedback feedback-err" role="alert">
          {errorMsg}
        </div>
      )}

      <label>
        New password
        <span className="pwd-wrap">
          <input
            type={showPwd ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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

      <button type="submit" disabled={busy} className="btn-login">
        <Lock size={16} aria-hidden="true" />
        {busy ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
