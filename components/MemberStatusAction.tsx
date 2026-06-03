"use client";

import { useState } from "react";
import { updateMemberStatus } from "@/app/actions";

type Status = "active" | "paused" | "closed";

export function MemberStatusAction({ memberId, current }: { memberId: string; current: Status }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const options: { label: string; value: Status; cls: string }[] = [
    { label: "Pause", value: "paused", cls: "btn-action pause" },
    { label: "Close", value: "closed", cls: "btn-action reject" },
    { label: "Reactivate", value: "active", cls: "btn-action approve" }
  ];

  const available = options.filter((o) => o.value !== current);

  async function handle(status: Status) {
    setBusy(true);
    const result = await updateMemberStatus(memberId, status);
    setMsg(result.success ? `Status set to ${status}` : (result.error ?? "Error"));
    setBusy(false);
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <span className="action-group">
      {msg && <span className="inline-status-msg">{msg}</span>}
      {!msg &&
        available.map((o) => (
          <button key={o.value} className={o.cls} disabled={busy} onClick={() => handle(o.value)}>
            {o.label}
          </button>
        ))}
    </span>
  );
}
