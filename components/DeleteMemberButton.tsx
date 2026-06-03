"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { deleteMember } from "@/app/actions";

export function DeleteMemberButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle() {
    setBusy(true);
    setErr(null);
    const result = await deleteMember(memberId);
    if (!result.success) {
      setErr(result.error ?? "Delete failed.");
      setBusy(false);
      setConfirm(false);
    }
    // On success the page revalidates and the row disappears
  }

  if (err) {
    return <span className="form-feedback inline-feedback feedback-err">{err}</span>;
  }

  if (confirm) {
    return (
      <span className="delete-confirm">
        <AlertTriangle size={14} className="delete-warn-icon" aria-hidden="true" />
        <span className="delete-warn-text">Delete <strong>{memberName}</strong>?</span>
        <button className="btn-action reject" disabled={busy} onClick={handle}>
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
        <button className="btn-action close-loan" disabled={busy} onClick={() => setConfirm(false)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      className="btn-action reject"
      onClick={() => setConfirm(true)}
      title={`Delete ${memberName}`}
    >
      <Trash2 size={13} aria-hidden="true" /> Delete
    </button>
  );
}
