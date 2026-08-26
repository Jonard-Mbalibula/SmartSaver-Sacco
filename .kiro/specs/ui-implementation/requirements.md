# UI Implementation - Requirements

**Spec ID:** ui-implementation  
**Created:** 2026-08-17  
**Status:** Draft  
**Priority:** High  

---

## Overview

Complete the remaining UI components to expose the fully-implemented backend features (loan products, transaction linkage, member lifecycle, audit logs, and transaction reversals).

---

## Background

**Current State:**
- ✅ Backend complete (P0 & P1 security + features)
- ✅ Server actions implemented and secured
- ✅ Database schema deployed
- ⚠️ UI components partially implemented

**Gap:**
The backend has comprehensive loan product management, eligibility checking, transaction reversals, and audit logging - but no UI to access these features.

---

## Goals

### Primary Goals
1. Enable admins to create and manage loan products
2. Link loan repayments to specific loans in transaction form
3. Replace destructive member deletion with status management
4. Provide visibility into audit logs for administrators

### Success Criteria
- [ ] Admins can create/list/toggle loan products without touching database
- [ ] Transaction form enforces loan selection for repayments
- [ ] Members cannot be deleted, only status-changed
- [ ] Audit logs viewable by admins
- [ ] All UI follows existing design patterns
- [ ] Zero TypeScript errors
- [ ] Mobile-responsive

---

## User Stories

### US-1: Loan Product Management (Admin)
**As an** admin  
**I want to** create and manage loan products  
**So that** I can offer different loan types with specific rules

**Acceptance Criteria:**
- View list of all loan products (active and inactive)
- Create new loan product with all configuration fields
- Toggle product active/inactive status
- See validation errors for invalid configurations
- Changes are audit-logged

### US-2: Link Loan Repayments (Admin)
**As an** admin  
**I want to** specify which loan a repayment applies to  
**So that** repayment tracking is accurate

**Acceptance Criteria:**
- When transaction type is "loan_payment", loan selection is required
- Dropdown shows only member's active/approved loans
- Validation error if loan_payment without loan selected
- Other transaction types don't require loan selection

### US-3: Member Status Management (Admin)
**As an** admin  
**I want to** change member status instead of deleting  
**So that** financial history is preserved

**Acceptance Criteria:**
- No "Delete" button for members with transactions
- Status dropdown shows: active, paused, closed, archived
- Confirmation dialog explains financial preservation
- Reason field required for status changes
- Audit-logged

### US-4: Audit Log Viewer (Admin)
**As an** admin  
**I want to** view recent system actions  
**So that** I can monitor activity and investigate issues

**Acceptance Criteria:**
- View recent audit logs (paginated)
- Filter by action type, user, date range
- See actor, action, timestamp, IP
- No edit/delete capabilities (read-only)

### US-5: Transaction Reversal (Admin - Optional)
**As an** admin  
**I want to** reverse incorrect transactions  
**So that** I can fix errors without deleting records

**Acceptance Criteria:**
- "Reverse" action on posted transactions
- Reason field required
- Creates offsetting transaction
- Original marked as reversed
- Cannot reverse already-reversed transactions

---

## Technical Requirements

### TR-1: UI Framework Consistency
- Use existing component patterns from `components/`
- Match styling and form structure
- Reuse form validation patterns
- Follow server action patterns

### TR-2: Server Action Integration
- `createLoanProduct()` - Create product
- `getLoanProductsAdmin()` - List products
- `toggleLoanProductStatus()` - Activate/deactivate
- `recordTransaction()` - Updated with loan_id
- `closeMemberAccount()` - Status change
- `reverseTransaction()` - Reversal

### TR-3: Data Validation
- All validation server-side (already implemented)
- Display server errors in UI
- Prevent submission with client-side basic checks
- Show loading states during submission

### TR-4: Performance
- Use Next.js caching appropriately
- Revalidate paths after mutations
- Avoid unnecessary re-renders
- Load audit logs paginated

---

## Non-Functional Requirements

### NFR-1: Security
- All forms use server actions (no direct API calls)
- Authorization enforced server-side (already done)
- No client-side bypasses possible

### NFR-2: Usability
- Clear error messages
- Loading indicators
- Success confirmations
- Mobile-responsive forms

### NFR-3: Accessibility
- Semantic HTML
- Keyboard navigation
- Screen reader friendly
- Proper ARIA labels

---

## Out of Scope

- ❌ Loan product editing (can deactivate and create new)
- ❌ Bulk transaction uploads UI
- ❌ Advanced reporting/charts
- ❌ Email/SMS notifications
- ❌ Loan repayment schedules UI
- ❌ Guarantor management

---

## Dependencies

- ✅ Database schema deployed (`schema-secure-v4.sql`)
- ✅ Server actions implemented (`app/actions.ts`)
- ✅ Authorization system (`lib/authorization.ts`)
- ✅ Loan eligibility system (`lib/loan-eligibility.ts`)
- ✅ Audit logging (`lib/audit.ts`)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Form complexity | High | Reuse existing form patterns |
| Validation mismatches | Medium | Use server validation as source of truth |
| UI/UX inconsistency | Low | Follow existing component styles |
| Mobile responsiveness | Low | Test on mobile throughout |

---

## Approval

**Requirements Approved By:** [Pending]  
**Date:** [Pending]  
**Next Phase:** Design

