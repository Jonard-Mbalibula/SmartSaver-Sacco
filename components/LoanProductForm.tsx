/**
 * Loan Product Management Component
 * 
 * Allows admins to create and configure loan products with:
 * - Interest rate ranges
 * - Principal limits
 * - Term limits
 * - Savings multiplier
 * - Membership requirements
 * - Guarantor flags
 */

"use client";

import { useActionState } from "react";
import { createLoanProduct } from "@/app/actions";
import { FormFeedback } from "./FormFeedback";
import type { ActionResult } from "@/lib/types";

const initial: ActionResult = { success: false };

export function LoanProductForm() {
  const [state, action, pending] = useActionState(createLoanProduct, initial);

  return (
    <form action={action} className="loan-product-form">
      <FormFeedback result={state?.message || state?.error ? state : null} />
      
      <div className="form-section">
        <h4>Product Details</h4>
        
        <label>
          Product Name
          <input 
            name="name" 
            placeholder="e.g., Standard Savings Loan" 
            required 
          />
        </label>
        
        <label>
          Description
          <textarea 
            name="description" 
            placeholder="Optional description of loan product"
            rows={2}
          />
        </label>
      </div>
      
      <div className="form-section">
        <h4>Interest Rate (% per month)</h4>
        <div className="form-row-3">
          <label>
            Minimum
            <input 
              name="interest_rate_min" 
              type="number" 
              min="0" 
              max="50" 
              step="0.1" 
              placeholder="3.0" 
              required 
            />
          </label>
          
          <label>
            Maximum
            <input 
              name="interest_rate_max" 
              type="number" 
              min="0" 
              max="50" 
              step="0.1" 
              placeholder="8.0" 
              required 
            />
          </label>
          
          <label>
            Default
            <input 
              name="interest_rate_default" 
              type="number" 
              min="0" 
              max="50" 
              step="0.1" 
              placeholder="5.0" 
              required 
            />
          </label>
        </div>
        <span className="field-hint">
          Admin can set rate between min and max when approving loan
        </span>
      </div>
      
      <div className="form-section">
        <h4>Loan Amount (UGX)</h4>
        <div className="form-row-2">
          <label>
            Minimum Principal
            <input 
              name="principal_min" 
              type="number" 
              min="1000" 
              step="1000" 
              placeholder="50000" 
              required 
            />
          </label>
          
          <label>
            Maximum Principal
            <input 
              name="principal_max" 
              type="number" 
              min="1000" 
              step="1000" 
              placeholder="5000000" 
              required 
            />
          </label>
        </div>
      </div>
      
      <div className="form-section">
        <h4>Loan Term (months)</h4>
        <div className="form-row-2">
          <label>
            Minimum Term
            <input 
              name="term_min_months" 
              type="number" 
              min="1" 
              step="1" 
              placeholder="1" 
              required 
            />
          </label>
          
          <label>
            Maximum Term
            <input 
              name="term_max_months" 
              type="number" 
              min="1" 
              step="1" 
              placeholder="24" 
              required 
            />
          </label>
        </div>
      </div>
      
      <div className="form-section">
        <h4>Eligibility Rules</h4>
        
        <label>
          Savings Multiplier
          <input 
            name="savings_multiplier" 
            type="number" 
            min="0.1" 
            max="10" 
            step="0.1" 
            placeholder="3.0" 
            required 
          />
          <span className="field-hint">
            Maximum loan = member savings × multiplier (e.g., 3.0 = 3× savings)
          </span>
        </label>
        
        <label>
          Minimum Membership Duration (days)
          <input 
            name="min_membership_days" 
            type="number" 
            min="0" 
            step="1" 
            defaultValue="90" 
            required 
          />
          <span className="field-hint">
            Member must have been active for at least this many days
          </span>
        </label>
        
        <label className="checkbox-label">
          <input 
            name="requires_guarantor" 
            type="checkbox" 
            value="true"
          />
          Requires Guarantor
          <span className="field-hint">
            Check if this loan product requires a guarantor
          </span>
        </label>
      </div>
      
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creating Product…" : "Create Loan Product"}
      </button>
    </form>
  );
}
