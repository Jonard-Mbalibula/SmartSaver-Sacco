"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Lock, Percent } from "lucide-react";
import { approveLoan, rejectLoan, closeLoan } from "@/app/actions";

type Props = { loanId: string; status: string };

export function LoanActions({ loanId, status }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [approving, setApproving] = useState(false);
  const [rate, setRate] = useState("5");

  async function handleApprove() {
    const rateNum = parseFloat(rate);
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      setMsg({ ok: false, text: "Enter a valid interest rate." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const result = await approveLoan(loanId, rateNum);
    setMsg({ ok: result.success, text: (result.success ? result.message : result.error) ?? "" });
    setBusy(false);
    setApproving(false);
  }

  async function handleReject() {
    setBusy(true);
    setMsg(null);
    const result = await rejectLoan(loanId);
    setMsg({ ok: result.success, text: (result.success ? result.message : result.error) ?? "" });
    setBusy(false);
  }

  async function handleClose() {
    setBusy(true);
    setMsg(null);
    const result = await closeLoan(loanId);
    setMsg({ ok: result.success, text: (result.success ? result.message : result.error) ?? "" });
    setBusy(false);
  }

  if (msg) {
    return (
      <span className={`form-feedback inline-feedback ${msg.ok ? "feedback-ok" : "feedback-err"}`}>
        {msg.ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
        {msg.text}
      </span>
    );
  }

  if (status === "pending") {
    if (approving) {
      return (
        <span className="approve-inline">
          <span className="approve-rate-wrap">
            <Percent size={13} className="rate-icon" aria-hidden="true" />
            <input
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="rate-input"
              aria-label="Monthly interest rate %"
              autoFocus
            />
            <span className="rate-label">% / mo</span>
          </span>
          <button className="btn-action approve" disabled={busy} onClick={handleApprove}>
            <CheckCircle size={13} /> Confirm
          </button>
          <button className="btn-action close-loan" disabled={busy} onClick={() => setApproving(false)}>
            Cancel
          </button>
        </span>
      );
    }

    return (
      <span className="action-group">
        <button
          className="btn-action approve"
          disabled={busy}
          onClick={() => setApproving(true)}
          title="Approve — set interest rate"
        >
          <CheckCircle size={14} aria-hidden="true" /> Approve
        </button>
        <button
          className="btn-action reject"
          disabled={busy}
          onClick={handleReject}
          title="Reject loan"
        >
          <XCircle size={14} aria-hidden="true" /> Reject
        </button>
      </span>
    );
  }

  if (status === "approved") {
    return (
      <button
        className="btn-action close-loan"
        disabled={busy}
        onClick={handleClose}
        title="Close loan"
      >
        <Lock size={14} aria-hidden="true" /> Close
      </button>
    );
  }

  return null;
}
