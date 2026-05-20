# DSLT — Digital Savings & Loan Tracking System

## Overview
DSLT is a mini fintech web system for managing member savings, loan applications, approvals, and repayments.  
It supports role-based access (Admin / Member), financial statistics dashboards, and audit logging of sensitive admin actions.

## Roles & Permissions
### Member
- Register/Login
- Deposit and withdraw savings
- Apply for loans
- View loan details and repayment schedule
- Repay approved loans

### Admin
- Login with admin role
- Approve or reject loan applications
- View/manage members (search + edit)
- Manage member transactions (add + reverse)
- View audit logs
- View reports and dashboards including loan interest metrics

## Core Features
1. Authentication and role-based routing
2. Savings transactions (deposit/withdraw)
3. Loan lifecycle:
   - member request → admin approval/rejection → member repayment → auto-close on full repayment
4. Fintech-safe transaction handling:
   - Transactions are not deleted; reversals are used to preserve history
5. Audit logs:
   - Admin actions are recorded with before/after details
6. Dashboards + reports:
   - Savings totals, loan principal, loan interest due, total due, repayments, outstanding, and charts

## Database Tables
- users (user_id, full_name, phone, password_hash, role, created_at)
- transactions (id, user_id, type, amount, created_at, is_reversal, reversed_transaction_id)
- loans (loan_id, user_id, requested_amount, approved_amount, interest_rate, duration_months, status, start_date, approved_by, created_at)
- loan_repayments (repayment_id, loan_id, amount, created_at)
- audit_logs (audit_id, actor_user_id, action, target_type, target_id, details, created_at)

## Security
- Password hashing using bcrypt (`password_hash`, `password_verify`)
- CSRF protection on all POST forms
- Session regeneration after login
- Role checks on all protected pages
- Audit logs for admin actions

## Installation (XAMPP)
1. Copy project to: `C:\xampp\htdocs\DSLT`
2. Start Apache + MySQL in XAMPP
3. Import the database SQL in phpMyAdmin
4. Open: `http://localhost/DSLT/auth/login.php`

## Demo Walkthrough
1. Register a new member account
2. Login as member → make deposit → withdraw → apply for loan
3. Login as admin → approve the loan
4. Login as member → view loan totals/schedule → make repayments → loan closes automatically
5. Admin → view reports → manage member → reverse transactions → view audit logs
