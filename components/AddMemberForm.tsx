"use client";

import { useActionState } from "react";
import { addMember } from "@/app/actions";
import { FormFeedback } from "./FormFeedback";
import type { ActionResult } from "@/lib/types";

const initial: ActionResult = { success: false };

export function AddMemberForm() {
  const [state, action, pending] = useActionState(addMember, initial);

  return (
    <form action={action}>
      <FormFeedback result={state?.message || state?.error ? state : null} />
      <label>
        Full name
        <input name="full_name" placeholder="Member full name" required />
      </label>
      <label>
        Phone
        <input name="phone" placeholder="+256..." required />
      </label>
      <label>
        National ID
        <input name="national_id" placeholder="Optional" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save member"}
      </button>
    </form>
  );
}
