"use client";

import { useActionState } from "react";
import { recordTransaction } from "@/app/actions";
import { FormFeedback } from "./FormFeedback";
import type { ActionResult } from "@/lib/types";
import type { Member } from "@/lib/types";

const initial: ActionResult = { success: false };

export function RecordTransactionForm({ members }: { members: Member[] }) {
  const [state, action, pending] = useActionState(recordTransaction, initial);

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
        Type
        <select name="type" required defaultValue="deposit">
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="loan_payment">Loan payment</option>
          <option value="fee">Fee</option>
          <option value="adjustment">Adjustment</option>
        </select>
      </label>
      <label>
        Amount
        <input name="amount" type="number" min="1" step="1" placeholder="0" required />
      </label>
      <label>
        Memo
        <input name="memo" placeholder="Counter receipt, mobile money ref…" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post transaction"}
      </button>
    </form>
  );
}
