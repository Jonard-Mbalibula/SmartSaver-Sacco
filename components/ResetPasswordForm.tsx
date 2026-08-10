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

  // On mount: handle both token delivery methods Supabase may use.
  //
  // 1. Hash flow (legacy OTP): the email link contains
  //    #access_token=...&refresh_token=...&type=recovery directly.
  //    We call setSession() with those tokens.
  //
  // 2. PKCE flow (default since Supabase JS v2 + @supabase/ssr):
  //    The email link goes to /auth-callback?code=...&type=recovery.
  //    auth-callback exchanges the code server-side and redirects here.
  //    The session lives in the server cookie, so getSession() on the
  //    browser client returns null. Instead we rely on onAuthStateChange
  //    which fires PASSWORD_RECOVERY once Supabase detects the recovery
  //    session — this is the only reliable cross-flow detection method.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // ── Hash flow ────────────────────────────────────────────────────────────
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const hashType = params.get("type");

    if (accessToken && refreshToken && hashType === "recovery") {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            setErrorMsg(error.message);
            setStage("error");
          } else {
            window.history.replaceState(null, "", window.location.pathname);
            setStage("ready");
          }
        })
        .catch((e: Error) => {
          setErrorMsg(e.message);
          setStage("error");
        });
      return; // listener not needed for hash flow
    }

    // ── PKCE flow via ?code= param (recovery) ───────────────────────────────
    // auth-callback passes the code here; we exchange it client-side so the
    // browser Supabase client gets the session and fires PASSWORD_RECOVERY.
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code) {
      // Clean the URL immediately
      window.history.replaceState(null, "", window.location.pathname);

      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            setErrorMsg(error.message);
            setStage("error");
          }
          // On success, onAuthStateChange below fires PASSWORD_RECOVERY → sets stage "ready"
        })
        .catch((e: Error) => {
          setErrorMsg(e.message);
          setStage("error");
        });
      // Fall through to the listener below — it will catch PASSWORD_RECOVERY
    }

    // ── PKCE flow — listen for the PASSWORD_RECOVERY event ──────────────────
    // Give it 8 s; if nothing fires the link is invalid/expired.
    const timeout = setTimeout(() => {
      setErrorMsg("Invalid or expired reset link. Please request a new one.");
      setStage("error");
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          clearTimeout(timeout);
          setStage("ready");
        } else if (event === "SIGNED_IN" && session) {
          // auth-callback already signed us in with the recovery session
          clearTimeout(timeout);
          setStage("ready");
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
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
