/**
 * Member Status Management Component
 * 
 * Replaces the dangerous DeleteMemberButton with proper lifecycle management.
 * Members with financial history cannot be deleted - only closed/archived.
 * 
 * Status Flow: active → paused → closed → archived
 */

"use client";

import { useState } from "react";
import { AlertCircle, Archive, Pause, Play, XCircle } from "lucide-react";
import { updateMemberStatus, closeMemberAccount } from "@/app/actions";

interface MemberStatusActionsProps {
  memberId: string;
  memberName: string;
  currentStatus: "active" | "paused" | "closed" | "archived";
}

export function MemberStatusActions({ 
  memberId, 
  memberName, 
  currentStatus 
}: MemberStatusActionsProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle status changes (active ↔ paused)
  async function handleStatusChange(newStatus: "active" | "paused") {
    setBusy(true);
    setError(null);
    
    const result = await updateMemberStatus(memberId, newStatus);
    
    if (!result.success) {
      setError(result.error ?? "Status update failed");
      setBusy(false);
    } else {
      setShowMenu(false);
    }
    // On success, page revalidates automatically
  }

  // Handle close/archive (requires reason)
  async function handleClose() {
    if (!closeReason || closeReason.trim().length < 10) {
      setError("Please provide a reason (minimum 10 characters)");
      return;
    }

    setBusy(true);
    setError(null);
    
    const result = await closeMemberAccount(memberId, closeReason.trim());
    
    if (!result.success) {
      setError(result.error ?? "Close failed");
      setBusy(false);
    } else {
      setShowCloseDialog(false);
      setShowMenu(false);
    }
  }

  // Close/Archive dialog
  if (showCloseDialog) {
    return (
      <div className="status-action-dialog">
        <div className="status-dialog-header">
          <AlertCircle size={16} className="dialog-icon-warn" />
          <strong>Close Account: {memberName}</strong>
        </div>
        
        <p className="status-dialog-text">
          This will permanently close this member&apos;s account. 
          All financial records will be preserved for audit compliance.
        </p>
        
        <label className="status-dialog-label">
          Reason for closure (required):
          <textarea
            className="status-dialog-textarea"
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="e.g., Member requested closure, Moved to different SACCO, etc."
            rows={3}
            disabled={busy}
          />
          <span className="status-dialog-hint">
            Minimum 10 characters. This will be logged for audit.
          </span>
        </label>
        
        {error && (
          <div className="form-feedback feedback-err">
            {error}
          </div>
        )}
        
        <div className="status-dialog-actions">
          <button
            className="btn-action reject"
            onClick={handleClose}
            disabled={busy || closeReason.trim().length < 10}
          >
            {busy ? "Closing…" : "Close Account"}
          </button>
          <button
            className="btn-action"
            onClick={() => {
              setShowCloseDialog(false);
              setCloseReason("");
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

  // Status menu
  if (showMenu) {
    return (
      <div className="status-action-menu">
        {error && (
          <div className="form-feedback inline-feedback feedback-err">
            {error}
          </div>
        )}
        
        <div className="status-menu-title">
          Change Status: <strong>{memberName}</strong>
        </div>
        
        {/* Active ↔ Paused */}
        {currentStatus === "active" && (
          <button
            className="status-menu-btn"
            onClick={() => handleStatusChange("paused")}
            disabled={busy}
          >
            <Pause size={14} />
            Pause Account
          </button>
        )}
        
        {currentStatus === "paused" && (
          <>
            <button
              className="status-menu-btn"
              onClick={() => handleStatusChange("active")}
              disabled={busy}
            >
              <Play size={14} />
              Reactivate Account
            </button>
            <button
              className="status-menu-btn danger"
              onClick={() => {
                setShowMenu(false);
                setShowCloseDialog(true);
              }}
              disabled={busy}
            >
              <XCircle size={14} />
              Close Account
            </button>
          </>
        )}
        
        {/* Closed/Archived - No changes allowed */}
        {(currentStatus === "closed" || currentStatus === "archived") && (
          <div className="status-menu-info">
            <Archive size={14} />
            Account is {currentStatus}. No actions available.
          </div>
        )}
        
        <button
          className="status-menu-btn cancel"
          onClick={() => setShowMenu(false)}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    );
  }

  // Main button
  return (
    <button
      className={`btn-action status-action-btn status-${currentStatus}`}
      onClick={() => setShowMenu(true)}
      title={`Manage status for ${memberName}`}
    >
      <AlertCircle size={13} />
      Manage Status
    </button>
  );
}
