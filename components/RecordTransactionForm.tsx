"use client";

import { useActionState, useState, useEffect } from "react";
import { recordTransaction } from "@/app/actions";
import { FormFeedback } from "./FormFeedback";
import type { ActionResult, Member, Loan } from "@/lib/types";

const initial: ActionResult = { success: false };

interface RecordTransactionFormProps {
  members: Member[];
  loans?: Loan[];  // Optional: pass loans if available
}

export function RecordTransactionForm({ members, loans = [] }: RecordTransactionFormProps) {
  const [state, action, pending] = useActionState(recordTransaction, initial);
  const [selectedType, setSelectedType] = useState("deposit");
  const [selectedMember, setSelectedMember] = useState("");
  
  // Filter loans for selected member
  const memberLoans = selectedMember
    ? loans.filter(l => 
        l.member_id === selectedMember && 
        l.status === "approved"
      )
    : [];
  
  // Reset loan selection when type changes away from loan_payment
  useEffect(() => {
    if (selectedType !== "loan_payment") {
      const loanInput = document.querySelector<HTMLSelectElement>('select[name="loan_id"]');
      if (loanInput) loanInput.value = "";
    }
  }, [selectedType]);

  return (
    <form action={action}>
      <FormFeedback result={state?.message || state?.error ? state : null} />
      
      <label>
        Member
        <select 
          name="member_id" 
          required
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
        >
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
        <select 
          name="type" 
          required 
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="loan_payment">Loan payment</option>
          <option value="fee">Fee</option>
          <option value="adjustment">Adjustment</option>
        </select>
      </label>
      
      {/* Show loan selector only for loan_payment type */}
      {selectedType === "loan_payment" && (
        <label>
          Loan <span className="required-note">*Required for loan payments</span>
          <select name="loan_id" required={selectedType === "loan_payment"}>
            <option value="">Select loan</option>
            {memberLoans.length === 0 && selectedMember && (
              <option value="" disabled>No approved loans for this member</option>
            )}
            {memberLoans.map((loan) => (
              <option key={loan.id} value={loan.id}>
                Loan #{loan.id.substring(0, 8)}... — UGX {Number(loan.principal).toLocaleString()} 
                @ {loan.interest_rate}% — {loan.term_months}mo
              </option>
            ))}
          </select>
          {!selectedMember && (
            <span className="field-hint">Select a member first</span>
          )}
          {selectedMember && memberLoans.length === 0 && (
            <span className="field-hint warning">
              This member has no approved loans to link repayment to
            </span>
          )}
        </label>
      )}
      
      <label>
        Amount
        <input 
          name="amount" 
          type="number" 
          min="1" 
          step="1" 
          placeholder="0" 
          required 
        />
      </label>
      
      <label>
        Memo
        <input 
          name="memo" 
          placeholder="Counter receipt, mobile money ref…" 
        />
      </label>
      
      <button type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post transaction"}
      </button>
    </form>
  );
}
