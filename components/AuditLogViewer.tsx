/**
 * Audit Log Viewer Component
 * 
 * Displays audit logs with pagination, filtering, and color-coded action types.
 * Mobile-responsive card-based layout for system activity monitoring.
 */

"use client";

import { useState } from "react";
import type { AuditLog } from "@/lib/types";

interface AuditLogViewerProps {
  logs: AuditLog[];
  totalCount?: number;
  currentPage?: number;
}

export function AuditLogViewer({ logs, totalCount = 0, currentPage = 0 }: AuditLogViewerProps) {
  const [filterAction, setFilterAction] = useState<string>("all");
  
  // Get unique action types for filter dropdown
  const actionTypes = Array.from(new Set(logs.map(log => log.action))).sort();
  
  // Filter logs based on selected action type
  const filteredLogs = filterAction === "all" 
    ? logs 
    : logs.filter(log => log.action === filterAction);
  
  const pageSize = 20;
  const totalPages = Math.ceil(totalCount / pageSize);
  
  return (
    <div className="audit-log-viewer">
      {/* Filter Controls */}
      <div className="audit-log-filters">
        <label>
          Filter by action:
          <select 
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="audit-log-filter-select"
          >
            <option value="all">All Actions</option>
            {actionTypes.map(action => (
              <option key={action} value={action}>
                {action.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>
      
      {/* Log Entries */}
      <div className="audit-log-entries">
        {filteredLogs.length === 0 && (
          <p className="audit-log-empty">No audit logs to display.</p>
        )}
        
        {filteredLogs.map(log => (
          <AuditLogEntry key={log.id} log={log} />
        ))}
      </div>
      
      {/* Pagination Info */}
      {totalPages > 1 && (
        <div className="audit-log-pagination">
          <span>
            Page {currentPage + 1} of {totalPages} 
            {totalCount && ` (${totalCount} total entries)`}
          </span>
        </div>
      )}
    </div>
  );
}

function AuditLogEntry({ log }: { log: AuditLog }) {
  const actionColor = getActionColor(log.action);
  const relativeTime = formatRelativeTime(log.created_at);
  const actionLabel = log.action.replace(/_/g, ' ');
  
  return (
    <div className="audit-log-entry">
      <div className="audit-log-header">
        <span className={`audit-log-action ${actionColor}`}>
          {actionLabel}
        </span>
        <span className="audit-log-time">{relativeTime}</span>
      </div>
      
      <div className="audit-log-details">
        <span className="audit-log-actor">
          {log.actor_role === 'admin' ? '👤 Admin' : '👤 Member'}
        </span>
        
        {log.entity_type && (
          <span className="audit-log-entity">
            {log.entity_type}
          </span>
        )}
      </div>
      
      {log.reason && (
        <div className="audit-log-reason">{log.reason}</div>
      )}
      
      <div className="audit-log-meta">
        {log.ip_address && (
          <span>IP: {log.ip_address}</span>
        )}
        {log.entity_id && (
          <span className="audit-log-entity-id">
            ID: {log.entity_id.substring(0, 8)}...
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Get CSS class for action type color coding
 */
function getActionColor(action: string): string {
  // Map action types to color classes
  if (action.includes('CREATE') || action.includes('REGISTER')) {
    return 'action-create';
  }
  if (action.includes('UPDATE') || action.includes('CHANGED') || action.includes('STATUS')) {
    return 'action-update';
  }
  if (action.includes('DELETE') || action.includes('CLOSED') || action.includes('ARCHIVED')) {
    return 'action-delete';
  }
  if (action.includes('APPROVE')) {
    return 'action-approve';
  }
  if (action.includes('REJECT') || action.includes('FAILED')) {
    return 'action-reject';
  }
  if (action.includes('UNAUTHORIZED') || action.includes('ATTEMPT')) {
    return 'action-unauthorized';
  }
  
  // Default color for other actions
  return 'action-default';
}

/**
 * Format timestamp as relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  if (days < 7) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
  
  // For older entries, show the date
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

