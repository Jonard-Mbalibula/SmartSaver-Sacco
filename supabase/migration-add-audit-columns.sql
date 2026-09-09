-- Migration: Add audit columns to loans table
-- Run this in Supabase SQL Editor if your loans table is missing these columns

-- Check if columns exist before adding them
DO $$ 
BEGIN
    -- Add approved_by_user_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'approved_by_user_id'
    ) THEN
        ALTER TABLE public.loans 
        ADD COLUMN approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added column: approved_by_user_id';
    ELSE
        RAISE NOTICE 'Column approved_by_user_id already exists';
    END IF;

    -- Add rejected_by_user_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'rejected_by_user_id'
    ) THEN
        ALTER TABLE public.loans 
        ADD COLUMN rejected_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added column: rejected_by_user_id';
    ELSE
        RAISE NOTICE 'Column rejected_by_user_id already exists';
    END IF;

    -- Add closed_by_user_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'closed_by_user_id'
    ) THEN
        ALTER TABLE public.loans 
        ADD COLUMN closed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added column: closed_by_user_id';
    ELSE
        RAISE NOTICE 'Column closed_by_user_id already exists';
    END IF;

    -- Add rejection_reason column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE public.loans 
        ADD COLUMN rejection_reason text;
        RAISE NOTICE 'Added column: rejection_reason';
    ELSE
        RAISE NOTICE 'Column rejection_reason already exists';
    END IF;

    -- Add closed_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'closed_at'
    ) THEN
        ALTER TABLE public.loans 
        ADD COLUMN closed_at timestamptz;
        RAISE NOTICE 'Added column: closed_at';
    ELSE
        RAISE NOTICE 'Column closed_at already exists';
    END IF;

    -- Add rejected_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'rejected_at'
    ) THEN
        ALTER TABLE public.loans 
        ADD COLUMN rejected_at timestamptz;
        RAISE NOTICE 'Added column: rejected_at';
    ELSE
        RAISE NOTICE 'Column rejected_at already exists';
    END IF;

    -- Add loan_product_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'loans' 
        AND column_name = 'loan_product_id'
    ) THEN
        ALTER TABLE public.loans 
        ADD COLUMN loan_product_id uuid REFERENCES public.loan_products(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added column: loan_product_id';
    ELSE
        RAISE NOTICE 'Column loan_product_id already exists';
    END IF;

END $$;

-- Verify all columns now exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'loans'
ORDER BY ordinal_position;
