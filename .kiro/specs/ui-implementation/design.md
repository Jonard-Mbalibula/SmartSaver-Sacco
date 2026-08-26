# UI Implementation - Design

**Spec ID:** ui-implementation  
**Created:** 2026-08-17  
**Status:** Ready for Implementation  

---

## Architecture Overview

### Component Strategy
- **Pattern:** Follow existing form component patterns (AddMemberForm, RecordTransactionForm)
- **State Management:** useActionState hook for server actions
- **Validation:** Server-side (already implemented), client-side basic checks
- **Styling:** Reuse existing CSS classes and structure

### Data Flow
```
UI Component → Server Action → Authorization Check → Database → Audit Log → Revalidate → UI Update
```

---

## Component Designs

### 1. LoanProductForm.tsx ✅ (Already Exists)

**Status:** Already implemented  
**Location:** `components/LoanProductForm.tsx`  
**Purpose:** Create new loan products

**Features:**
- Form fields for all product configuration
- Server-side validation via `createLoanProduct()`
- Success/error feedback
- Loading states

---

### 2. LoanProductList.tsx (NEW)

**Purpose:** Display and manage existing loan products

**Props:**
```typescript
interface LoanProductListProps {
  products: LoanProduct[];  // From getLoanProductsAdmin()
}
```

**UI Structure:**
```
┌─────────────────────────────────────────┐
│ Active Loan Products                     │
├─────────────────────────────────────────┤
│ □ Standard Savings Loan      [Deactivate]│
│   3.0% - 8.0% | UGX 50K - 5M | 1-24mo   │
│   Savings 3x | 90 days membership        │
├─────────────────────────────────────────┤
│ □ Emergency Loan             [Deactivate]│
│   5.0% - 10.0% | UGX 10K - 500K | 1-6mo │
├─────────────────────────────────────────┤
│ Inactive Loan Products                   │
├─────────────────────────────────────────┤
│ □ Old Product                [Activate]  │
└─────────────────────────────────────────┘
```

**Key Features:**
- Group by active/inactive
- Show key metrics in summary
- Toggle button for activate/deactivate
- Confirmation dialog for status changes
- Loading state during toggle

**Server Actions Used:**
- `getLoanProductsAdmin()` - Fetch products
- `toggleLoanProductStatus(productId, isActive)` - Toggle status

**Implementation Notes:**
- Server component fetches data
- Client component for toggle interactions
- Optimistic UI updates
- Revalidate path after toggle

---

### 3. RecordTransactionForm.tsx ✅ (Already Updated)

**Status:** Already implemented with loan linkage  
**Location:** `components/RecordTransactionForm.tsx`  

**Features:**
- Loan dropdown appears when type = "loan_payment"
- Shows only member's approved loans
- Required validation for loan_payment type
- Clear error messages

---

### 4. MemberStatusActions.tsx ✅ (Already Exists)

**Status:** Already implemented  
**Location:** `components/MemberStatusActions.tsx`  

**Features:**
- Status change menu (active ↔ paused)
- Close account with reason dialog
- Preserves financial history
- Audit-logged

---

### 5. AuditLogViewer.tsx (NEW)

**Purpose:** Display audit logs for admins

**Props:**
```typescript
interface AuditLogViewerProps {
  logs: AuditLog[];
  totalCount?: number;
  page?: number;
}
```

**UI Structure:**
```
┌──────────────────────────────────────────────────┐
│ Recent Activity                                   │
│ Filter: [All Actions ▼] [All Users ▼] [Today ▼] │
├──────────────────────────────────────────────────┤
│ 🔵 LOAN_APPROVED                                  │
│    Admin User approved loan for Jane Doe          │
│    2 minutes ago • 192.168.1.100                  │
├──────────────────────────────────────────────────┤
│ 🟢 TRANSACTION_RECORDED                           │
│    Admin User recorded deposit for John Smith     │
│    5 minutes ago • 192.168.1.100                  │
├──────────────────────────────────────────────────┤
│ 🟡 MEMBER_CREATED                                 │
│    Admin User created member Alice Johnson        │
│    10 minutes ago • 192.168.1.100                 │
├──────────────────────────────────────────────────┤
│ [Load More] Page 1 of 10                         │
└──────────────────────────────────────────────────┘
```

**Key Features:**
- Paginated display (10-20 per page)
- Color-coded action types
- Relative timestamps ("2 minutes ago")
- Show actor name, action, target, IP
- Read-only (no edit/delete)
- Filter by action type, date range
- Mobile-responsive table/card view

**Data Fetching:**
```typescript
// Server component fetches logs
const logs = await getAuditLogs({
  limit: 20,
  offset: page * 20,
  actionType: filter,
  dateFrom: dateFilter
});
```

**Server Actions Needed:**
```typescript
// Add to app/actions.ts
export async function getAuditLogs(options: {
  limit?: number;
  offset?: number;
  actionType?: string;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const user = await requireAdmin();
  // Query audit_logs with filters and pagination
}
```

**Implementation Notes:**
- Server component for initial render
- Client component for pagination/filters
- Use searchParams for filter state
- Revalidate on filter change

---

### 6. TransactionReversal.tsx ✅ (Already Exists)

**Status:** Already implemented  
**Location:** `components/TransactionReversal.tsx`  

**Features:**
- Reverse button on transactions
- Reason field required
- Cannot reverse already-reversed
- Creates offsetting entry

---

## Page Updates

### Dashboard Page (app/dashboard/page.tsx)

**Add Sections:**

1. **Loan Products Section** (Admin only)
```tsx
<section>
  <h2>Loan Products</h2>
  <LoanProductList products={products} />
  <details>
    <summary>Create New Product</summary>
    <LoanProductForm />
  </details>
</section>
```

2. **Audit Log Section** (Admin only)
```tsx
<section>
  <h2>Recent Activity</h2>
  <AuditLogViewer 
    logs={recentLogs} 
    totalCount={totalLogs}
    page={Number(searchParams.page ?? 0)}
  />
</section>
```

**Data Fetching:**
```typescript
// In dashboard page.tsx
const products = await getLoanProductsAdmin();
const recentLogs = await getAuditLogs({ limit: 20 });
```

---

## Data Models (Already Defined)

### LoanProduct
```typescript
interface LoanProduct {
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
  created_at: string;
}
```

### AuditLog
```typescript
interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_role: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
```

---

## Server Actions Required

### Existing (Already Implemented)
- ✅ `createLoanProduct()` - Create product
- ✅ `getLoanProductsAdmin()` - List products
- ✅ `toggleLoanProductStatus()` - Activate/deactivate
- ✅ `recordTransaction()` - With loan_id support
- ✅ `updateMemberStatus()` - Change status
- ✅ `closeMemberAccount()` - Close with reason
- ✅ `reverseTransaction()` - Reverse transaction

### New (Need to Add)
- 🆕 `getAuditLogs()` - Fetch audit logs with pagination/filters

---

## Styling Strategy

### Reuse Existing Classes
```css
/* Form elements */
.form-feedback
.feedback-err
.feedback-ok

/* Buttons */
.btn-action
.btn-action.approve
.btn-action.reject

/* Status indicators */
.status-active
.status-paused
.status-closed
.status-archived

/* Dialogs/Menus */
.status-action-dialog
.status-action-menu
.status-dialog-header
```

### New CSS Needed (Minimal)
```css
/* Loan product card */
.loan-product-card {
  border: 1px solid #ddd;
  padding: 1rem;
  margin-bottom: 0.5rem;
  border-radius: 4px;
}

.loan-product-inactive {
  opacity: 0.6;
  background: #f9f9f9;
}

.loan-product-summary {
  font-size: 0.9rem;
  color: #666;
  margin-top: 0.5rem;
}

/* Audit log entries */
.audit-log-entry {
  border-bottom: 1px solid #eee;
  padding: 0.75rem 0;
}

.audit-log-action {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}

.audit-log-meta {
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.25rem;
}

/* Action type colors */
.action-create { color: #10b981; }
.action-update { color: #3b82f6; }
.action-delete { color: #ef4444; }
.action-approve { color: #059669; }
.action-reject { color: #dc2626; }
.action-unauthorized { color: #f59e0b; }
```

---

## Mobile Responsiveness

### Strategy
- Forms: Stack labels vertically (already done)
- Tables: Convert to card layout on mobile
- Dialogs: Full-width on mobile
- Buttons: Full-width on small screens

### Breakpoints
```css
@media (max-width: 640px) {
  /* Stack form elements */
  label {
    display: block;
    width: 100%;
  }
  
  /* Card layout for lists */
  .loan-product-card,
  .audit-log-entry {
    margin-bottom: 1rem;
  }
  
  /* Full-width buttons */
  .btn-action {
    width: 100%;
    margin-bottom: 0.5rem;
  }
}
```

---

## Error Handling

### Client-Side Validation
- Required fields marked with `required` attribute
- Number inputs with `min`, `max`, `step`
- Disable submit while pending

### Server-Side Validation (Already Implemented)
- All validation in server actions
- Return `ActionResult` with success/error
- Display errors using `FormFeedback` component

### Loading States
- Use `pending` from `useActionState`
- Disable forms/buttons while submitting
- Show "Loading…" text
- Prevent double-submission

---

## Accessibility

### Standards
- Semantic HTML (labels, buttons, form elements)
- ARIA labels where needed
- Keyboard navigation (tab order)
- Focus management (dialogs)
- Color contrast (WCAG AA minimum)
- Screen reader friendly

### Implementation
```tsx
// Label association
<label htmlFor="product-name">
  Product Name
  <input id="product-name" name="name" required />
</label>

// ARIA for dialogs
<div role="dialog" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Close Account</h2>
  {/* ... */}
</div>

// Loading states
<button disabled={pending} aria-busy={pending}>
  {pending ? "Saving…" : "Save"}
</button>
```

---

## Testing Strategy

### Manual Testing Checklist
- [ ] Create loan product with valid data
- [ ] Create loan product with invalid data (see errors)
- [ ] Toggle product active/inactive
- [ ] Record loan payment with loan selected
- [ ] Record loan payment without loan (see error)
- [ ] Change member status (active → paused → closed)
- [ ] View audit logs
- [ ] Filter audit logs
- [ ] Paginate audit logs
- [ ] Reverse transaction
- [ ] All forms work on mobile
- [ ] Keyboard navigation works

### Validation Testing
- [ ] Interest rate min > max (should error)
- [ ] Principal min > max (should error)
- [ ] Term min > max (should error)
- [ ] Loan payment without loan_id (should error)
- [ ] Close account without reason (should error)
- [ ] Reverse already-reversed transaction (should error)

---

## Performance Considerations

### Optimization Strategy
1. **Server Components:** Use for data fetching (products, logs)
2. **Client Components:** Only for interactive parts (forms, toggles)
3. **Caching:** Use Next.js cache for audit logs (revalidate: 60s)
4. **Pagination:** Limit audit logs to 20 per page
5. **Revalidation:** Call `revalidatePath()` after mutations

### Database Queries
- Audit logs: Index on `created_at DESC` (already exists)
- Loan products: Index on `is_active` (already exists)
- Filter queries: Use indexed columns

---

## Security Considerations

### Already Implemented ✅
- Authorization checks in all server actions
- Audit logging on all mutations
- Server-side validation
- RLS policies enforced

### UI Security
- No sensitive data in client state
- No direct API calls (only server actions)
- Forms use POST (CSRF protection via Next.js)
- No client-side authorization checks (server only)

---

## Migration & Rollout

### Phase 1: Loan Products (Priority 1)
1. Add `getAuditLogs()` server action
2. Create `LoanProductList.tsx` component
3. Add loan products section to dashboard
4. Test product creation and toggling

### Phase 2: Audit Viewer (Priority 2)
1. Create `AuditLogViewer.tsx` component
2. Add pagination support
3. Add filters (action type, date)
4. Add to dashboard page

### Phase 3: Polish (Priority 3)
1. Add CSS for new components
2. Mobile responsiveness testing
3. Accessibility audit
4. Documentation updates

---

## Open Questions

✅ **Resolved:**
- Transaction form already updated with loan linkage
- Member status management already implemented
- Transaction reversal already implemented

❓ **Remaining:**
1. Should loan products be editable, or create-new-only?
   - **Decision:** Create-new-only (can deactivate old)
2. How many audit logs per page?
   - **Decision:** 20 per page
3. Should audit log filters be persistent (URL params)?
   - **Decision:** Yes, use searchParams

---

## Success Metrics

### Functional Completeness
- [ ] All 5 user stories implemented
- [ ] Zero TypeScript errors
- [ ] All server actions working
- [ ] Mobile responsive

### Code Quality
- [ ] Follows existing patterns
- [ ] Proper error handling
- [ ] Loading states
- [ ] Accessibility compliant

### User Experience
- [ ] Clear error messages
- [ ] Success confirmations
- [ ] Intuitive UI
- [ ] Fast performance

---

## References

### Existing Components (Patterns)
- `components/AddMemberForm.tsx` - Form pattern
- `components/RecordTransactionForm.tsx` - Dynamic form fields
- `components/MemberStatusActions.tsx` - Status management
- `components/FormFeedback.tsx` - Error/success display

### Server Actions
- `app/actions.ts` - All server actions
- `lib/authorization.ts` - Authorization helpers
- `lib/audit.ts` - Audit logging

### Database Schema
- `supabase/schema-secure-v4.sql` - Current schema

---

**Design Status:** ✅ Complete  
**Ready for Implementation:** Yes  
**Next Step:** Create implementation tasks
