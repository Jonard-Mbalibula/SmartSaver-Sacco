/**
 * Transaction Reversal Component
 * 
 * Allows admin to reverse posted transactions with required reason.
 * Creates offsetting entry instead of deleting records.
 * 
 * Use for corrections, errors, or disputed transactions.
 */

"use client";

import { useState } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { reverseTransaction } from "@/app/actions";
import type { Transaction } from "@/lib/types";

interface TransactionReversalProps {
  transaction: Transaction;
}

export function TransactionReversal({ transaction }: TransactionReversalProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0
    }).format(v);

  const fmtDate = (v: string) =>
    new Intl.DateTimeFormat("en-UG", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(v));

  async function handleReverse() {
    if (!reason || reason.trim().length < 10) {
      setError("Reason must be at least 10 characters");
      return;
    }

    setBusy(true);
    setError(null);

    const result = await reverseTransaction(transaction.id, reason.trim());

    if (!result.success) {
      setError(result.error ?? "Reversal failed");
      setBusy(false);
    } else {
      setShowDialog(false);
      // Page revalidates automatically
    }
  }

  // Don't show button if already reversed
  if (transaction.status === "reversed") {
    return (
      <span className="status status-reversed" title="This transaction has been reversed">
        Reversed
      </span>
    );
  }

  // Dialog
  if (showDialog) {
    return (
      <div className="reversal-dialog">
        <div className="reversal-dialog-header">
          <AlertCircle size={16} className="dialog-icon-warn" />
          <strong>Reverse Transaction</strong>
        </div>

        <div className="reversal-transaction-details">
          <div className="reversal-detail-row">
            <span className="detail-label">Type:</span>
            <span className="detail-value type-badge">
              {transaction.type.replace(/_/g, " ")}
            </span>
          </div>
          <div className="reversal-detail-row">
            <span className="detail-label">Amount:</span>
            <span className="detail-value">{fmt(Number(transaction.amount))}</span>
          </div>
          <div className="reversal-detail-row">
            <span className="detail-label">Member:</span>
            <span className="detail-value">{transaction.members?.full_name ?? "—"}</span>
          </div>
          <div className="reversal-detail-row">
            <span className="detail-label">Posted:</span>
            <span className="detail-value">{fmtDate(transaction.posted_at)}</span>
          </div>
          {transaction.memo && (
            <div className="reversal-detail-row">
              <span className="detail-label">Memo:</span>
              <span className="detail-value">{transaction.memo}</span>
            </div>
          )}
          <div className="reversal-detail-row">
            <span className="detail-label">Reference:</span>
            <span className="detail-value">{transaction.txn_reference ?? "—"}</span>
          </div>
        </div>

        <div className="reversal-warning">
          <AlertCircle size={14} />
          <span>
            This will create an offsetting entry. The original transaction will be marked as reversed
            and preserved for audit. This action cannot be undone.
          </span>
        </div>

        <label className="reversal-reason-label">
          Reason for reversal (required):
          <textarea
            className="reversal-reason-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Duplicate entry, Incorrect amount, Member dispute, etc."
            rows={3}
            disabled={busy}
          />
          <span className="reversal-reason-hint">
            Minimum 10 characters. This will be permanently logged.
          </span>
        </label>

        {error && (
          <div className="form-feedback feedback-err">
            {error}
          </div>
        )}

        <div className="reversal-dialog-actions">
          <button
            className="btn-action reject"
            onClick={handleReverse}
            disabled={busy || reason.trim().length < 10}
          >
            {busy ? "Reversing…" : "Reverse Transaction"}
          </button>
          <button
            className="btn-action"
            onClick={() => {
              setShowDialog(false);
              setReason("");
              setError(null);
            }}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Main button
  return (
    <button
      className="btn-action reversal-btn"
      onClick={() => setShowDialog(true)}
      title="Reverse this transaction"
    >
      <RotateCcw size={13} />
      Reverse
    </button>
  );
}
