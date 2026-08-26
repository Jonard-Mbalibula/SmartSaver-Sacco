# Implementation Plan: UI Implementation

**Spec ID:** ui-implementation  
**Created:** 2026-08-17  

---

## Overview

Complete the remaining UI components to expose fully-implemented backend features including loan product management, audit log viewing, and enhanced transaction/member management interfaces.

**Total Tasks:** 8  
**Estimated Time:** 6 hours 15 minutes  
**Dependencies:** Backend features complete (P0 & P1)

---

## Tasks

- [ ] 1. Add getAuditLogs Server Action  
  **Priority:** High | **Time:** 30m | **Depends on:** None  
  Implement server action in `app/actions.ts` to fetch audit logs with pagination (limit, offset) and filtering (actionType, dateFrom, dateTo). Requires admin authorization. Returns `{ logs: AuditLog[]; total: number }`.

- [ ] 2. Create LoanProductList Component  
  **Priority:** High | **Time:** 1h | **Depends on:** None  
  Create `components/LoanProductList.tsx` to display loan products grouped by active/inactive status. Include toggle buttons using `toggleLoanProductStatus()` server action, confirmation dialogs, loading states, and mobile-responsive layout.

- [ ] 3. Create AuditLogViewer Component  
  **Priority:** Medium | **Time:** 1.5h | **Depends on:** Task 1  
  Create `components/AuditLogViewer.tsx` to display audit logs with color-coded action types, relative timestamps ("2 minutes ago"), pagination controls, action type filter, and mobile-responsive card layout.

- [ ] 4. Add CSS Styles for New Components  
  **Priority:** Medium | **Time:** 30m | **Depends on:** Tasks 2, 3  
  Add CSS to `app/globals.css` for `.loan-product-card`, `.loan-product-inactive`, `.audit-log-entry`, action type colors (create=green, update=blue, delete=red, etc.), and mobile breakpoints (@media max-width 640px).

- [ ] 5. Update Dashboard Page with New Sections  
  **Priority:** High | **Time:** 45m | **Depends on:** Tasks 1, 2, 3  
  Update `app/dashboard/page.tsx` to add loan products and audit log sections (admin only). Fetch data using `getLoanProductsAdmin()` and `getAuditLogs()`, add role checks, handle loading/error states.

- [ ] 6. Add Loan Product Creation UI to Dashboard  
  **Priority:** Medium | **Time:** 30m | **Depends on:** Task 2  
  Add collapsible `<details>` section to dashboard with heading "+ Create New Loan Product" containing existing `LoanProductForm` component. Admin only. Verify new product appears in list after creation.

- [ ] 7. Integration Testing  
  **Priority:** High | **Time:** 1h | **Depends on:** Tasks 1-6  
  End-to-end testing of all workflows: loan product create/toggle, transaction with loan linkage, member status management, audit log display/filtering, mobile responsiveness, accessibility (keyboard nav, screen readers), and form validation.

- [ ] 8. Documentation Updates  
  **Priority:** Low | **Time:** 30m | **Depends on:** Tasks 1-7  
  Update README.md with new features (Loan Product Management, Audit Log Viewer). Update QUICK_START.md with usage instructions for creating products, viewing logs, managing member status, and linking loan repayments.

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Wave 1: Data & Components",
      "tasks": [1, 2],
      "description": "Build data fetching and primary components in parallel"
    },
    {
      "name": "Wave 2: Audit Viewer",
      "tasks": [3],
      "description": "Build audit viewer using data from Task 1"
    },
    {
      "name": "Wave 3: Styling & Product UI",
      "tasks": [4, 6],
      "description": "Add styles and product creation UI in parallel"
    },
    {
      "name": "Wave 4: Integration",
      "tasks": [5],
      "description": "Integrate all components into dashboard"
    },
    {
      "name": "Wave 5: Validation",
      "tasks": [7, 8],
      "description": "Test and document"
    }
  ]
}
```

**Critical Path:** Task 1 → Task 3 → Task 4 → Task 5 → Task 7 → Task 8 (4.75 hours)  
**Parallel Opportunities:** Tasks 1 & 2 (Wave 1), Tasks 4 & 6 (Wave 3)

---

## Notes

### Existing Components (Already Complete) ✅
- `LoanProductForm.tsx` - Product creation form
- `RecordTransactionForm.tsx` - Updated with loan linkage
- `MemberStatusActions.tsx` - Status management workflow
- `TransactionReversal.tsx` - Reversal UI

### New Components to Build 🆕
- `LoanProductList.tsx` - Display and toggle loan products
- `AuditLogViewer.tsx` - Display audit logs with filtering

### Files to Modify 📝
- `app/actions.ts` - Add `getAuditLogs()` function
- `app/dashboard/page.tsx` - Add new sections
- `app/globals.css` - Add component styles
- `README.md` - Feature updates
- `QUICK_START.md` - Usage instructions

### Key Implementation Details

**Task 1 - getAuditLogs():**
```typescript
export async function getAuditLogs(options: {
  limit?: number;
  offset?: number;
  actionType?: string;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<{ logs: AuditLog[]; total: number }>
```

**Task 2 - LoanProductList:**
- Group products by `is_active` status
- Show: name, interest rates, amounts, terms, multiplier
- Toggle with confirmation dialog
- Loading states during toggle

**Task 3 - AuditLogViewer:**
- Display: actor, action, timestamp, IP
- Color code actions (CRUD operations)
- Relative timestamps using date-fns or custom formatter
- Pagination controls (prev/next, page numbers)

**Task 4 - CSS Classes:**
- `.loan-product-card` - Card styling
- `.loan-product-inactive` - Opacity 0.6, gray background
- `.audit-log-entry` - Entry styling
- `.action-create`, `.action-update`, etc. - Color classes

**Task 5 - Dashboard Integration:**
```tsx
{isAdmin && (
  <>
    <section>
      <h2>Loan Products</h2>
      <LoanProductList products={products} />
      <details>
        <summary>+ Create New Loan Product</summary>
        <LoanProductForm />
      </details>
    </section>
    <section>
      <h2>Recent Activity</h2>
      <AuditLogViewer logs={logs} totalCount={total} />
    </section>
  </>
)}
```

**Task 7 - Test Scenarios:**
1. Loan product lifecycle (create → toggle → check audit log)
2. Loan repayment tracking (select loan in transaction form)
3. Member status workflow (active → paused → closed)
4. Audit log features (filter, paginate)
5. Mobile responsiveness and accessibility

---

**Implementation Status:** Ready to execute  
**Estimated Completion:** 6 hours 15 minutes  
**Can Start:** Immediately (no blockers)
