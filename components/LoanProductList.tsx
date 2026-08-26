/**
 * Loan Product List Component
 * 
 * Displays loan products grouped by active/inactive status with toggle functionality.
 * Mobile-responsive card-based layout with confirmation dialogs.
 */

"use client";

import { useState } from "react";
import { toggleLoanProductStatus } from "@/app/actions";
import type { LoanProduct } from "@/lib/types";

interface LoanProductListProps {
  products: LoanProduct[];
}

export function LoanProductList({ products }: LoanProductListProps) {
  // Group products by is_active
  const activeProducts = products.filter(p => p.is_active);
  const inactiveProducts = products.filter(p => !p.is_active);
  
  return (
    <div className="loan-product-list">
      {activeProducts.length > 0 && (
        <>
          <h3>Active Loan Products</h3>
          {activeProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </>
      )}
      
      {inactiveProducts.length > 0 && (
        <>
          <h3>Inactive Loan Products</h3>
          {inactiveProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </>
      )}
      
      {products.length === 0 && (
        <p>No loan products configured yet.</p>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: LoanProduct }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  async function handleToggle() {
    setBusy(true);
    setError(null);
    
    const result = await toggleLoanProductStatus(product.id, !product.is_active);
    
    if (!result.success) {
      setError(result.error || "Toggle failed");
      setBusy(false);
    } else {
      setShowConfirm(false);
      // Page revalidates automatically
    }
  }
  
  // Format currency
  const fmt = (n: number) => `UGX ${Number(n).toLocaleString()}`;
  
  return (
    <div className={`loan-product-card ${!product.is_active ? 'loan-product-inactive' : ''}`}>
      <div className="loan-product-header">
        <strong>{product.name}</strong>
        <button 
          className="btn-action"
          onClick={() => setShowConfirm(true)}
          disabled={busy}
        >
          {product.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
      
      {product.description && (
        <p className="loan-product-description">{product.description}</p>
      )}
      
      <div className="loan-product-summary">
        Interest: {product.interest_rate_min}% - {product.interest_rate_max}% (default {product.interest_rate_default}%)
        <br />
        Amount: {fmt(product.principal_min)} - {fmt(product.principal_max)}
        <br />
        Term: {product.term_min_months} - {product.term_max_months} months
        <br />
        Savings Multiplier: {product.savings_multiplier}x | Minimum Membership: {product.min_membership_days} days
        {product.requires_guarantor && <><br />Requires Guarantor</>}
      </div>
      
      {showConfirm && (
        <div className="confirm-dialog">
          <p>
            {product.is_active 
              ? `Deactivate "${product.name}"? Members will not be able to apply for this product.`
              : `Activate "${product.name}"? Members will be able to apply for this product.`
            }
          </p>
          {error && <div className="form-feedback feedback-err">{error}</div>}
          <button 
            className="btn-action approve" 
            onClick={handleToggle}
            disabled={busy}
          >
            {busy ? 'Processing...' : 'Confirm'}
          </button>
          <button 
            className="btn-action" 
            onClick={() => setShowConfirm(false)}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
