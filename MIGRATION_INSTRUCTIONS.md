# Database Migration Instructions

## Issue
The application is trying to use a `loan_id` column in the `transactions` table that doesn't exist in your Supabase database yet.

**Error:** "Could not find the 'loan_id' column of 'transactions' in the schema cache"

## Solution
Run the migration script to add the missing column.

### Steps to Apply Migration

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project: `zouxakzclowsinofbnps`

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "+ New query"

3. **Copy and Run Migration**
   - Open the file: `supabase/migration-add-loan-id-to-transactions.sql`
   - Copy all the SQL content
   - Paste it into the SQL Editor
   - Click "Run" button

4. **Verify Success**
   - You should see messages like:
     - "Added loan_id column to transactions table"
     - "Added transactions_loan_payment_requires_loan constraint"
   - If you see "already exists" messages, that's fine - it means the column is already there

5. **Test the Application**
   - Go back to your application
   - Try recording a transaction for "Bwambale Costa"
   - The error should be gone!

## What This Migration Does

1. **Adds `loan_id` column** to the `transactions` table
   - Links loan payment transactions to specific loans
   - Foreign key reference to `loans` table

2. **Adds constraint** ensuring loan_payment transactions MUST have a loan_id

3. **Creates index** on `loan_id` for faster queries

## Alternative: Apply Full Schema

If you prefer to apply the complete schema from scratch:

1. **Open:** `supabase/schema-secure-v4.sql`
2. **Run it** in SQL Editor (Note: This will recreate all tables, so only do this on a fresh database or if you want to reset)

## Need Help?

If you encounter issues:
1. Check that you're running the SQL in the correct Supabase project
2. Verify you have proper permissions (you should be the project owner)
3. Check the Supabase logs for any error messages
