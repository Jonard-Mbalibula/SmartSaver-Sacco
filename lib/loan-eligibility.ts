/**
 * Loan Eligibility System
 * 
 * Implements configurable loan eligibility rules based on SACCO policies.
 * This replaces the simplistic "loan <= 3x savings" check with comprehensive validation.
 * 
 * Business Rules Enforced:
 * - Member must be active
 * - Minimum membership duration
 * - Savings balance requirements
 * - Outstanding loan restrictions
 * - Loan product limits
 * - Savings multiplier rules
 */

"use server";

import { createSupabaseServerClient } from "./supabase";
import type { Member } from "./types";

/**
 * Loan eligibility result
 */
export interface LoanEligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxLoanAmount?: number;
  recommendedProducts?: Array<{
    id: string;
    name: string;
    maxAmount: number;
    interestRate: number;
  }>;
}

/**
 * Loan product configuration
 */
export interface LoanProduct {
  id: string;
  name: string;
  description: string | null;
  interest_rate_min: number;
  interest_rate_max: number;
  interest_rate_default: number;
  principal_min: number;
  principal_max: number;
  term_min_months: number;
  term_max_months: number;
  savings_multiplier: number;
  min_membership_days: number;
  requires_guarantor: boolean;
  is_active: boolean;
}

/**
 * Calculate member's savings balance
 */
async function getMemberBalance(memberId: string): Promise<number> {
  const supabase = createSupabaseServerClient();
  
  const { data: transactions } = await supabase
    .from("transactions")
    .select("type, amount, status")
    .eq("member_id", memberId)
    .in("status", ["posted"]); // Only count posted transactions (not reversed)
  
  if (!transactions) return 0;
  
  const deposits = transactions
    .filter(t => t.type === "deposit")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const withdrawals = transactions
    .filter(t => t.type === "withdrawal")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  return deposits - withdrawals;
}

/**
 * Check if member has outstanding loans
 */
async function hasOutstandingLoans(memberId: string): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  
  const { data: loans } = await supabase
    .from("loans")
    .select("id")
    .eq("member_id", memberId)
    .in("status", ["pending", "approved"])
    .limit(1);
  
  return Boolean(loans && loans.length > 0);
}

/**
 * Get active loan products
 */
async function getActiveLoanProducts(): Promise<LoanProduct[]> {
  const supabase = createSupabaseServerClient();
  
  const { data: products } = await supabase
    .from("loan_products")
    .select("*")
    .eq("is_active", true)
    .order("principal_min");
  
  return (products || []) as LoanProduct[];
}

/**
 * Calculate membership duration in days
 */
function getMembershipDays(joinedAt: string): number {
  const joinedDate = new Date(joinedAt);
  const now = new Date();
  const diffMs = now.getTime() - joinedDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format currency (UGX)
 */
function fmt(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Check comprehensive loan eligibility for a member
 * 
 * @param memberId - Member UUID
 * @param requestedAmount - Desired loan amount
 * @param requestedTerm - Desired loan term in months
 * @param productId - Optional specific loan product ID
 * @returns Detailed eligibility result
 */
export async function checkLoanEligibility(
  memberId: string,
  requestedAmount: number,
  requestedTerm: number,
  productId?: string
): Promise<LoanEligibilityResult> {
  const supabase = createSupabaseServerClient();
  const reasons: string[] = [];
  
  // Fetch member
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("full_name, phone, status, joined_at")
    .eq("id", memberId)
    .single();
  
  if (memberError || !member) {
    return {
      eligible: false,
      reasons: ["Member record not found"]
    };
  }
  
  // Check 1: Member status must be active
  if (member.status !== "active") {
    reasons.push(`Your account status is "${member.status}". Only active members can apply for loans.`);
  }
  
  // Check 2: Get savings balance
  const savingsBalance = await getMemberBalance(memberId);
  
  if (savingsBalance <= 0) {
    reasons.push("You must have a positive savings balance to qualify for a loan.");
    return { eligible: false, reasons };
  }
  
  // Check 3: Membership duration
  const membershipDays = getMembershipDays(member.joined_at);
  
  // Check 4: Outstanding loans
  const hasOutstanding = await hasOutstandingLoans(memberId);
  if (hasOutstanding) {
    reasons.push("You have an outstanding loan. Please clear it before applying for a new loan.");
  }
  
  // Check 5: Get loan products
  const products = await getActiveLoanProducts();
  
  if (products.length === 0) {
    reasons.push("No loan products are currently available. Please contact an administrator.");
    return { eligible: false, reasons };
  }
  
  // If specific product requested, validate against it
  if (productId) {
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      reasons.push("The selected loan product is not available.");
      return { eligible: false, reasons };
    }
    
    // Validate against product rules
    if (membershipDays < product.min_membership_days) {
      reasons.push(
        `This loan product requires ${product.min_membership_days} days of membership. ` +
        `You have been a member for ${membershipDays} days.`
      );
    }
    
    if (requestedAmount < product.principal_min) {
      reasons.push(
        `Minimum loan amount for "${product.name}" is ${fmt(product.principal_min)}.`
      );
    }
    
    if (requestedAmount > product.principal_max) {
      reasons.push(
        `Maximum loan amount for "${product.name}" is ${fmt(product.principal_max)}.`
      );
    }
    
    const maxBysavings = savingsBalance * product.savings_multiplier;
    if (requestedAmount > maxBysavings) {
      reasons.push(
        `Based on your savings balance of ${fmt(savingsBalance)}, ` +
        `maximum loan amount for this product is ${fmt(maxBysavings)} ` +
        `(${product.savings_multiplier}x your savings).`
      );
    }
    
    if (requestedTerm < product.term_min_months) {
      reasons.push(
        `Minimum loan term for "${product.name}" is ${product.term_min_months} months.`
      );
    }
    
    if (requestedTerm > product.term_max_months) {
      reasons.push(
        `Maximum loan term for "${product.name}" is ${product.term_max_months} months.`
      );
    }
    
    if (product.requires_guarantor) {
      // Note: Guarantor functionality not yet implemented
      reasons.push(
        `This loan product requires a guarantor. ` +
        `Please contact the SACCO office to arrange a guarantor.`
      );
    }
    
    return {
      eligible: reasons.length === 0,
      reasons,
      maxLoanAmount: Math.min(maxBysavings, product.principal_max)
    };
  }
  
  // No specific product - find suitable products
  const suitableProducts: LoanEligibilityResult["recommendedProducts"] = [];
  
  for (const product of products) {
    // Check membership duration
    if (membershipDays < product.min_membership_days) {
      continue;
    }
    
    // Check amount range
    if (requestedAmount < product.principal_min || requestedAmount > product.principal_max) {
      continue;
    }
    
    // Check savings multiplier
    const maxBySettings = savingsBalance * product.savings_multiplier;
    if (requestedAmount > maxBySettings) {
      continue;
    }
    
    // Check term range
    if (requestedTerm < product.term_min_months || requestedTerm > product.term_max_months) {
      continue;
    }
    
    // This product is suitable
    suitableProducts.push({
      id: product.id,
      name: product.name,
      maxAmount: Math.min(maxBySettings, product.principal_max),
      interestRate: product.interest_rate_default
    });
  }
  
  if (suitableProducts.length === 0) {
    // No products match - provide helpful feedback
    reasons.push("No loan products match your requested amount and term.");
    
    // Suggest what they could qualify for
    const anyEligibleProduct = products.find(p => 
      membershipDays >= p.min_membership_days &&
      savingsBalance * p.savings_multiplier >= p.principal_min
    );
    
    if (anyEligibleProduct) {
      const maxAmount = Math.min(
        savingsBalance * anyEligibleProduct.savings_multiplier,
        anyEligibleProduct.principal_max
      );
      reasons.push(
        `You may qualify for "${anyEligibleProduct.name}" ` +
        `with amounts between ${fmt(anyEligibleProduct.principal_min)} and ${fmt(maxAmount)}.`
      );
    }
    
    return { eligible: false, reasons };
  }
  
  return {
    eligible: reasons.length === 0,
    reasons,
    recommendedProducts: suitableProducts,
    maxLoanAmount: Math.max(...suitableProducts.map(p => p.maxAmount))
  };
}

/**
 * Get all active loan products (for display in UI)
 */
export async function getLoanProducts(): Promise<LoanProduct[]> {
  return getActiveLoanProducts();
}

/**
 * Quick check: Can member apply for any loan?
 * Returns true if member meets basic requirements
 */
export async function canMemberApplyForLoan(memberId: string): Promise<{
  canApply: boolean;
  reason?: string;
}> {
  const supabase = createSupabaseServerClient();
  
  // Check member exists and is active
  const { data: member } = await supabase
    .from("members")
    .select("status")
    .eq("id", memberId)
    .single();
  
  if (!member) {
    return { canApply: false, reason: "Member not found" };
  }
  
  if (member.status !== "active") {
    return { canApply: false, reason: "Account must be active" };
  }
  
  // Check for outstanding loans
  const hasOutstanding = await hasOutstandingLoans(memberId);
  if (hasOutstanding) {
    return { canApply: false, reason: "Clear outstanding loan first" };
  }
  
  // Check savings balance
  const balance = await getMemberBalance(memberId);
  if (balance <= 0) {
    return { canApply: false, reason: "Positive savings balance required" };
  }
  
  return { canApply: true };
}
