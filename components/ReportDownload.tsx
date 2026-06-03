"use client";

import { Download } from "lucide-react";
import type { Loan, Member, Transaction } from "@/lib/types";

type Props = {
  reportType: "transactions" | "loans" | "members" | "summary";
  transactions?: Transaction[];
  loans?: Loan[];
  members?: Member[];
  totals?: {
    deposits: number;
    withdrawals: number;
    netSavings: number;
    loanPayments: number;
    portfolio: number;
    interestCollected: number;
    activeMembers: number;
    pendingLoans: number;
  };
  label: string;
};

function esc(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function buildCSV(props: Props): string {
  const { reportType, transactions, loans, members, totals } = props;

  if (reportType === "summary" && totals) {
    const rows = [
      ["Report", "SmartSaver Sacco — Financial Summary"],
      ["Generated", new Date().toLocaleString("en-UG")],
      [],
      ["Metric", "Amount (UGX)"],
      ["Total deposits", totals.deposits],
      ["Total withdrawals", totals.withdrawals],
      ["Net savings", totals.netSavings],
      ["Loan payments received", totals.loanPayments],
      ["Active loan portfolio", totals.portfolio],
      ["Interest collected (closed/approved loans)", totals.interestCollected],
      ["Total income (savings + interest)", totals.netSavings + totals.interestCollected],
      [],
      ["Active members", totals.activeMembers],
      ["Pending loan applications", totals.pendingLoans],
    ];
    return rows.map(r => r.map(c => esc(c as string)).join(",")).join("\n");
  }

  if (reportType === "transactions" && transactions) {
    const header = ["Date", "Member", "Phone", "Type", "Amount (UGX)", "Memo"];
    const rows = transactions.map(t => [
      new Date(t.posted_at).toLocaleDateString("en-UG"),
      t.members?.full_name ?? "",
      t.members?.phone ?? "",
      t.type,
      t.amount,
      t.memo ?? "",
    ]);
    return [header, ...rows].map(r => r.map(c => esc(c as string)).join(",")).join("\n");
  }

  if (reportType === "loans" && loans) {
    const header = ["Member", "Principal (UGX)", "Interest Rate (%)", "Term (months)", "Total Due (UGX)", "Monthly Payment (UGX)", "Status", "Applied", "Approved"];
    const rows = loans.map(l => {
      const rate = l.interest_rate ?? 0;
      const totalDue = l.interest_rate != null ? Number(l.principal) * (1 + rate / 100) : "";
      const monthly = (totalDue && l.term_months > 0) ? Number(totalDue) / l.term_months : "";
      return [
        l.members?.full_name ?? "",
        l.principal,
        l.interest_rate ?? "Pending",
        l.term_months,
        totalDue || "Pending",
        monthly || "Pending",
        l.status,
        new Date(l.created_at).toLocaleDateString("en-UG"),
        l.approved_at ? new Date(l.approved_at).toLocaleDateString("en-UG") : "",
      ];
    });
    return [header, ...rows].map(r => r.map(c => esc(c as string)).join(",")).join("\n");
  }

  if (reportType === "members" && members) {
    const header = ["Name", "Phone", "National ID", "Status", "Joined"];
    const rows = members.map(m => [
      m.full_name,
      m.phone,
      m.national_id ?? "",
      m.status,
      new Date(m.joined_at).toLocaleDateString("en-UG"),
    ]);
    return [header, ...rows].map(r => r.map(c => esc(c as string)).join(",")).join("\n");
  }

  return "";
}

export function ReportDownload(props: Props) {
  function download() {
    const csv = buildCSV(props);
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartsaver-${props.reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button className="btn-download" onClick={download} title={`Download ${props.label}`}>
      <Download size={14} aria-hidden="true" />
      {props.label}
    </button>
  );
}
