# Database Migration Guide

## Issue
Getting error: "Could not find the 'approved_by_user_id' column of 'loans' in the schema cache"

## Cause
Your Supabase database is using an older schema version that doesn't have all the audit columns.

## Solution

### Step 1: Run the Migration Script

1. Go to your Supabase Dashboard
2. Navigate to: **SQL Editor** (left sidebar)
3. Click **New query**
4. Copy the contents of `supabase/migration-add-audit-columns.sql`
5. Paste into the SQL editor
6. Click **Run** or press `Ctrl+Enter`

### Step 2: Verify the Migration

The script will output messages showing which columns were added:
```
NOTICE: Added column: approved_by_user_id
NOTICE: Added column: rejected_by_user_id
NOTICE: Added column: closed_by_user_id
...
```

At the end, you'll see a table showing all columns in the `loans` table.

### Expected Columns After Migration

Your `loans` table should have these columns:
- `id` (uuid)
- `member_id` (uuid)
- `loan_product_id` (uuid) ← NEW
- `principal` (numeric)
- `interest_rate` (numeric)
- `term_months` (integer)
- `status` (text)
- `approved_at` (timestamptz)
- `approved_by_user_id` (uuid) ← NEW
- `rejected_at` (timestamptz) ← NEW
- `rejected_by_user_id` (uuid) ← NEW
- `rejection_reason` (text) ← NEW
- `closed_at` (timestamptz) ← NEW
- `closed_by_user_id` (uuid) ← NEW
- `created_at` (timestamptz)

### Step 3: Test

After running the migration:
1. Refresh your application page
2. Try approving a loan again
3. The error should be gone ✅

## Alternative: Fresh Database Setup

If you prefer to start fresh with the complete schema:

1. **Backup any important data first!**
2. Drop all tables in Supabase
3. Run the complete schema: `supabase/schema-secure-v4.sql`

⚠️ **Warning:** This will delete all existing data!

## Need Help?

If you encounter any issues:
1. Check the Supabase SQL Editor for error messages
2. Verify you're connected to the correct Supabase project
3. Make sure you have admin/owner permissions on the project
