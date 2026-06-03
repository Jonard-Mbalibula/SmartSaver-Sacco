"use client";

import { useState } from "react";
import { UserCheck, Link2 } from "lucide-react";
import { assignRole, linkUserToMember } from "@/app/actions";
import type { Member } from "@/lib/types";

type AuthUser = { id: string; email: string; role: string; member_id?: string | null };

export function UserRoleManager({ users, members }: { users: AuthUser[]; members: Member[] }) {
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function handleRole(userId: string, role: "admin" | "member") {
    setBusy((b) => ({ ...b, [userId]: true }));
    const res = await assignRole(userId, role);
    setMsg((m) => ({ ...m, [userId]: res.success ? (res.message ?? "Updated") : (res.error ?? "Error") }));
    setBusy((b) => ({ ...b, [userId]: false }));
    setTimeout(() => setMsg((m) => { const n = { ...m }; delete n[userId]; return n; }), 3000);
  }

  async function handleLink(userId: string, memberId: string) {
    if (!memberId) return;
    setBusy((b) => ({ ...b, [`link-${userId}`]: true }));
    const res = await linkUserToMember(userId, memberId);
    setMsg((m) => ({ ...m, [`link-${userId}`]: res.success ? (res.message ?? "Linked") : (res.error ?? "Error") }));
    setBusy((b) => ({ ...b, [`link-${userId}`]: false }));
    setTimeout(() => setMsg((m) => { const n = { ...m }; delete n[`link-${userId}`]; return n; }), 3000);
  }

  if (users.length === 0) {
    return <p className="empty-state">No users yet.</p>;
  }

  return (
    <div className="user-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Linked member</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const linked = members.find((m) => m.id === u.member_id);
            return (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>
                  <span className={`role-badge role-${u.role}`}>{u.role}</span>
                </td>
                <td>
                  {linked ? (
                    <span className="member-link">{linked.full_name}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  <div className="action-group" style={{ flexWrap: "wrap", gap: 6 }}>
                    {msg[u.id] ? (
                      <span className="inline-status-msg">{msg[u.id]}</span>
                    ) : (
                      <>
                        {u.role !== "admin" && (
                          <button
                            className="btn-action approve"
                            disabled={busy[u.id]}
                            onClick={() => handleRole(u.id, "admin")}
                          >
                            <UserCheck size={13} /> Make admin
                          </button>
                        )}
                        {u.role !== "member" && (
                          <button
                            className="btn-action pause"
                            disabled={busy[u.id]}
                            onClick={() => handleRole(u.id, "member")}
                          >
                            <UserCheck size={13} /> Make member
                          </button>
                        )}
                      </>
                    )}
                    {u.role === "member" && (
                      msg[`link-${u.id}`] ? (
                        <span className="inline-status-msg">{msg[`link-${u.id}`]}</span>
                      ) : (
                        <span className="action-group">
                          <Link2 size={13} style={{ color: "var(--muted)" }} />
                          <select
                            className="inline-select"
                            defaultValue={u.member_id ?? ""}
                            onChange={(e) => handleLink(u.id, e.target.value)}
                            disabled={busy[`link-${u.id}`]}
                            aria-label="Link to member"
                          >
                            <option value="">Link to member…</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.full_name} ({m.phone})
                              </option>
                            ))}
                          </select>
                        </span>
                      )
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
