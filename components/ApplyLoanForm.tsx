"use client";

import { useActionState } from "react";
import { applyForLoan } from "@/app/actions";
import { FormFeedback } from "./FormFeedback";
import type { ActionResult } from "@/lib/types";
import { CheckCircle } from "lucide-react";

const initial: ActionResult = { success: false };

export function ApplyLoanForm({ savingsBalance }: { savingsBalance: number }) {
  const [state, action, pending] = useActionState(applyForLoan, initial);

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(v);

  if (state.success) {
    return (
      <div className="auth-success">
        <CheckCircle size={36} className="auth-success-icon" aria-hidden="true" />
        <h2>Application submitted</h2>
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action}>
      <FormFeedback result={state?.error ? state : null} />

      {/* Balance reference — same style as admin creates loan */}
      {savingsBalance > 0 && (
        <div className="loan-balance-info">
          Your savings balance: <strong>{fmt(savingsBalance)}</strong>
          <span className="loan-balance-hint"> — max loan amount</span>
        </div>
      )}

      {/* Principal — same as admin form */}
      <label>
        Principal (UGX)
        <input
          name="principal"
          type="number"
          min="0"
          max={savingsBalance > 0 ? savingsBalance : undefined}
          step="1000"
          placeholder="0"
          required
        />
      </label>

      {/* Term — select instead of free number, mirrors admin form style */}
      <label>
        Months
          <input name="term_months" type="number" min="1" step="1" defaultValue="6" required />
      </label>

      {/* Interest rate — display only, set by admin on approval */}
      <label>
        Interest %
        <input
          value="Set by admin on approval"
          readOnly
          className="input-readonly"
          aria-label="Interest rate is set by admin"
        />
      </label>

      <div className="loan-note">
        <strong>Note:</strong> The admin reviews your application and sets the monthly interest rate when approving.
      </div>

      <button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
