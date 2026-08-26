/**
 * Apply for Loan Form (Member Portal)
 * 
 * Integrates with loan eligibility system to show:
 * - Available loan products
 * - Eligibility feedback
 * - Max qualifying amounts
 */

"use client";

import { useActionState, useEffect, useState } from "react";
import { applyForLoan } from "@/app/actions";
import { FormFeedback } from "./FormFeedback";
import type { ActionResult } from "@/lib/types";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

const initial: ActionResult = { success: false };

interface LoanProduct {
  id: string;
  name: string;
  description: string | null;
  interest_rate_default: number;
  principal_min: number;
  principal_max: number;
  term_min_months: number;
  term_max_months: number;
  savings_multiplier: number;
  min_membership_days: number;
  requires_guarantor: boolean;
}

interface ApplyLoanFormProps {
  savingsBalance: number;
  loanProducts: LoanProduct[];
  membershipDays: number;
}

export function ApplyLoanForm({ 
  savingsBalance, 
  loanProducts,
  membershipDays 
}: ApplyLoanFormProps) {
  const [state, action, pending] = useActionState(applyForLoan, initial);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [requestedAmount, setRequestedAmount] = useState<number>(0);
  const [requestedTerm, setRequestedTerm] = useState<number>(6);
  const [eligibilityFeedback, setEligibilityFeedback] = useState<string[]>([]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-UG", { 
      style: "currency", 
      currency: "UGX", 
      maximumFractionDigits: 0 
    }).format(v);

  // Update eligibility feedback when inputs change
  useEffect(() => {
    if (!selectedProduct) {
      setEligibilityFeedback([]);
      return;
    }

    const feedback: string[] = [];
    const maxByBalance = savingsBalance * selectedProduct.savings_multiplier;

    // Check membership duration
    if (membershipDays < selectedProduct.min_membership_days) {
      feedback.push(
        `⚠️ Requires ${selectedProduct.min_membership_days} days membership (you have ${membershipDays} days)`
      );
    }

    // Check amount range
    if (requestedAmount < selectedProduct.principal_min) {
      feedback.push(`⚠️ Minimum amount: ${fmt(selectedProduct.principal_min)}`);
    }
    if (requestedAmount > selectedProduct.principal_max) {
      feedback.push(`⚠️ Maximum amount: ${fmt(selectedProduct.principal_max)}`);
    }
    if (requestedAmount > maxByBalance) {
      feedback.push(
        `⚠️ Based on your savings (${fmt(savingsBalance)}), max amount is ${fmt(maxByBalance)}`
      );
    }

    // Check term range
    if (requestedTerm < selectedProduct.term_min_months) {
      feedback.push(`⚠️ Minimum term: ${selectedProduct.term_min_months} months`);
    }
    if (requestedTerm > selectedProduct.term_max_months) {
      feedback.push(`⚠️ Maximum term: ${selectedProduct.term_max_months} months`);
    }

    // Guarantor requirement
    if (selectedProduct.requires_guarantor) {
      feedback.push("ℹ️ This product requires a guarantor (contact office)");
    }

    // Success message
    if (feedback.length === 0 || feedback.every(f => f.startsWith("ℹ️"))) {
      const maxEligible = Math.min(maxByBalance, selectedProduct.principal_max);
      feedback.push(`✅ You qualify for up to ${fmt(maxEligible)}`);
    }

    setEligibilityFeedback(feedback);
  }, [selectedProduct, requestedAmount, requestedTerm, savingsBalance, membershipDays]);

  if (state.success) {
    return (
      <div className="auth-success">
        <CheckCircle size={36} className="auth-success-icon" aria-hidden="true" />
        <h2>Application submitted</h2>
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="loan-apply-form">
      <FormFeedback result={state?.error ? state : null} />

      {/* Savings balance info */}
      {savingsBalance > 0 && (
        <div className="loan-balance-info">
          Your savings balance: <strong>{fmt(savingsBalance)}</strong>
          <span className="loan-balance-hint"> — determines max loan</span>
        </div>
      )}

      {/* Loan product selector */}
      <label>
        Loan Product
        <select
          name="product_id"
          required
          onChange={(e) => {
            const product = loanProducts.find(p => p.id === e.target.value);
            setSelectedProduct(product || null);
          }}
        >
          <option value="">Select a loan product...</option>
          {loanProducts.map(product => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.interest_rate_default}% interest)
            </option>
          ))}
        </select>
      </label>

      {/* Product details */}
      {selectedProduct && (
        <div className="product-details">
          <h4>
            <Info size={14} />
            {selectedProduct.name} Details
          </h4>
          <ul className="product-details-list">
            <li>Interest rate: {selectedProduct.interest_rate_default}% per month</li>
            <li>
              Amount range: {fmt(selectedProduct.principal_min)} - {fmt(selectedProduct.principal_max)}
            </li>
            <li>
              Term range: {selectedProduct.term_min_months} - {selectedProduct.term_max_months} months
            </li>
            <li>Max loan: {selectedProduct.savings_multiplier}× your savings</li>
            {selectedProduct.description && (
              <li className="product-description">{selectedProduct.description}</li>
            )}
          </ul>
        </div>
      )}

      {/* Principal input */}
      <label>
        Loan Amount (UGX)
        <input
          name="principal"
          type="number"
          min={selectedProduct?.principal_min || 0}
          max={selectedProduct?.principal_max || undefined}
          step="1000"
          placeholder="Enter amount"
          value={requestedAmount || ""}
          onChange={(e) => setRequestedAmount(Number(e.target.value))}
          disabled={!selectedProduct}
          required
        />
      </label>

      {/* Term input */}
      <label>
        Loan Term (months)
        <input
          name="term_months"
          type="number"
          min={selectedProduct?.term_min_months || 1}
          max={selectedProduct?.term_max_months || 24}
          step="1"
          value={requestedTerm}
          onChange={(e) => setRequestedTerm(Number(e.target.value))}
          disabled={!selectedProduct}
          required
        />
      </label>

      {/* Eligibility feedback */}
      {eligibilityFeedback.length > 0 && (
        <div className="eligibility-feedback">
          {eligibilityFeedback.map((msg, idx) => {
            const isError = msg.startsWith("⚠️");
            const isSuccess = msg.startsWith("✅");
            const isInfo = msg.startsWith("ℹ️");
            
            return (
              <div
                key={idx}
                className={`eligibility-item ${
                  isError ? "error" : isSuccess ? "success" : "info"
                }`}
              >
                {isError && <AlertCircle size={14} />}
                {isSuccess && <CheckCircle size={14} />}
                {isInfo && <Info size={14} />}
                <span>{msg.substring(2)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="loan-note">
        <strong>Note:</strong> Admin reviews your application and finalizes terms upon approval.
      </div>

      <button
        type="submit"
        disabled={
          pending ||
          !selectedProduct ||
          eligibilityFeedback.some(f => f.startsWith("⚠️"))
        }
      >
        {pending ? "Submitting…" : "Submit Application"}
      </button>
    </form>
  );
}
