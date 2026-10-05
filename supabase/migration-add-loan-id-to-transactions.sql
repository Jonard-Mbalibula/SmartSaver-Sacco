-- Migration: Add loan_id column to transactions table
-- This allows linking loan repayment transactions to specific loans

-- Add loan_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'transactions' 
    AND column_name = 'loan_id'
  ) THEN
    ALTER TABLE public.transactions
    ADD COLUMN loan_id uuid REFERENCES public.loans(id) ON DELETE RESTRICT;
    
    RAISE NOTICE 'Added loan_id column to transactions table';
  ELSE
    RAISE NOTICE 'loan_id column already exists in transactions table';
  END IF;
END $$;

-- Add constraint: loan_payment type MUST have a loan_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transactions_loan_payment_requires_loan'
    AND table_name = 'transactions'
  ) THEN
    ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_loan_payment_requires_loan CHECK (
      (type = 'loan_payment' AND loan_id IS NOT NULL) OR 
      (type != 'loan_payment')
    );
    
    RAISE NOTICE 'Added transactions_loan_payment_requires_loan constraint';
  ELSE
    RAISE NOTICE 'transactions_loan_payment_requires_loan constraint already exists';
  END IF;
END $$;

-- Create index on loan_id for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_loan_id 
ON public.transactions(loan_id) 
WHERE loan_id IS NOT NULL;

COMMENT ON COLUMN public.transactions.loan_id IS 'Links loan repayment transactions to specific loans. Required for type=loan_payment.';
