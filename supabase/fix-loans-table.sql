-- Run this in: Supabase Dashboard > SQL Editor > New query
-- This fixes the loans table that was created without the required columns.

-- Step 1: Drop the incomplete loans table (it has no data yet)
DROP TABLE IF EXISTS public.loans CASCADE;

-- Step 2: Recreate with all required columns and FK to members
CREATE TABLE public.loans (
  id            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid           NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  principal     numeric(14,2)  NOT NULL,
  interest_rate numeric(6,2)   NOT NULL DEFAULT 5.00,
  term_months   integer        NOT NULL,
  status        text           NOT NULL DEFAULT 'pending',
  approved_at   timestamptz,
  created_at    timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT loans_status_check    CHECK (status IN ('pending','approved','rejected','closed')),
  CONSTRAINT loans_principal_check CHECK (principal > 0),
  CONSTRAINT loans_term_check      CHECK (term_months > 0)
);

CREATE INDEX IF NOT EXISTS idx_loans_member_status ON public.loans(member_id, status);

-- Step 3: Enable RLS
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_loans" ON public.loans;
CREATE POLICY "auth_all_loans"
  ON public.loans FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Done! The loans table now has all required columns and a FK to members.
-- You should also run the full schema.sql if you haven't already.
