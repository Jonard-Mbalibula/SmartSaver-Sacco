"use client";

import { useActionState } from "react";
import { createLoan } from "@/app/actions";
import { FormFeedback } from "./FormFeedback";
import type { ActionResult, Member } from "@/lib/types";

const initial: ActionResult = { success: false };

export function CreateLoanForm({ members }: { members: Member[] }) {
  const [state, action, pending] = useActionState(createLoan, initial);

  return (
    <form action={action}>
      <FormFeedback result={state?.message || state?.error ? state : null} />
      <label>
        Member
        <select name="member_id" required>
          <option value="">Select member</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name} — {m.phone}
            </option>
          ))}
        </select>
      </label>
      <label>
        Principal (UGX)
        <input name="principal" type="number" min="1" step="1" placeholder="0" required />
      </label>
      <div className="form-grid">
        <label>
          Interest %
          <input name="interest_rate" type="number" min="0.1" step="0.1" defaultValue="5" required />
        </label>
        <label>
          Months
          <input name="term_months" type="number" min="1" step="1" defaultValue="6" required />
        </label>
      </div>
      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create loan"}
      </button>
    </form>
  );
}
