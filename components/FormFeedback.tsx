"use client";

import { CheckCircle, XCircle } from "lucide-react";
import type { ActionResult } from "@/lib/types";

export function FormFeedback({ result }: { result: ActionResult | null }) {
  if (!result) return null;

  return (
    <div className={`form-feedback ${result.success ? "feedback-ok" : "feedback-err"}`} role="alert">
      {result.success ? <CheckCircle size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
      <span>{result.success ? result.message : result.error}</span>
    </div>
  );
}
