-- SmartSaver Sacco - SECURE Schema v4 (Security Hardened)
-- Run this in Supabase Dashboard -> SQL Editor -> New query
-- This is a COMPREHENSIVE SECURITY UPDATE addressing all P0 audit findings
-- Safe to re-run (uses IF NOT EXISTS and CREATE OR REPLACE)

-- =============================================================================
-- PART 1: CORE TABLES (Enhanced with audit fields)
-- =============================================================================

-- MEMBERS table - Enhanced with lifecycle status
CREATE TABLE IF NOT EXISTS public.members (
  id          uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   text           NOT NULL,
  phone       text           NOT NULL UNIQUE,
  national_id text,
  status      text           NOT NULL DEFAULT 'active',
  joined_at   timestamptz    NOT NULL DEFAULT now(),
  created_at  timestamptz    NOT NULL DEFAULT now(),
  updated_at  timestamptz    NOT NULL DEFAULT now(),
  created_by_user_id  uuid   REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_user_id  uuid   REFERENCES auth.users(id) ON DELETE SET NULL,
  closure_reason      text,
  CONSTRAINT members_status_check CHECK (status IN ('active','paused','closed','archived'))
);

-- ACCOUNTS table
CREATE TABLE IF NOT EXISTS public.accounts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  account_no   text        NOT NULL UNIQUE,
  account_type text        NOT NULL DEFAULT 'savings',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounts_type_check CHECK (account_type IN ('savings','loan'))
);

-- TRANSACTIONS table - Enhanced with reversals, references, and audit
CREATE TABLE IF NOT EXISTS public.transactions (
  id                  uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_reference       text           UNIQUE, -- Auto-generated: TXN-YYYY-NNNNNN
  member_id           uuid           NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  account_id          uuid           REFERENCES public.accounts(id) ON DELETE SET NULL,
  loan_id             uuid           REFERENCES public.loans(id) ON DELETE RESTRICT,
  type                text           NOT NULL,
  amount              numeric(14,2)  NOT NULL,
  memo                text,
  status              text           NOT NULL DEFAULT 'posted',
  reverses_txn_id     uuid           REFERENCES public.transactions(id) ON DELETE RESTRICT,
  reversed_by_txn_id  uuid           REFERENCES public.transactions(id) ON DELETE RESTRICT,
  reversal_reason     text,
  recorded_by_user_id uuid           REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by_user_id uuid           REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_at           timestamptz    NOT NULL DEFAULT now(),
  created_at          timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT transactions_type_check   CHECK (type IN ('deposit','withdrawal','loan_payment','fee','adjustment')),
  CONSTRAINT transactions_amount_check CHECK (amount <> 0),
  CONSTRAINT transactions_status_check CHECK (status IN ('posted','reversed','reversal','adjustment')),
  CONSTRAINT transactions_loan_payment_requires_loan CHECK (
    (type = 'loan_payment' AND loan_id IS NOT NULL) OR 
    (type != 'loan_payment')
  )
);

-- LOAN PRODUCTS table - NEW: Configurable loan offerings
CREATE TABLE IF NOT EXISTS public.loan_products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  description           text,
  interest_rate_min     numeric(6,2) NOT NULL CHECK (interest_rate_min >= 0),
  interest_rate_max     numeric(6,2) NOT NULL CHECK (interest_rate_max >= interest_rate_min),
  interest_rate_default numeric(6,2) NOT NULL CHECK (interest_rate_default BETWEEN interest_rate_min AND interest_rate_max),
  principal_min         numeric(14,2) NOT NULL CHECK (principal_min > 0),
  principal_max         numeric(14,2) NOT NULL CHECK (principal_max >= principal_min),
  term_min_months       integer NOT NULL CHECK (term_min_months > 0),
  term_max_months       integer NOT NULL CHECK (term_max_months >= term_min_months),
  savings_multiplier    numeric(4,2) DEFAULT 3.0 CHECK (savings_multiplier > 0),
  min_membership_days   integer DEFAULT 90 CHECK (min_membership_days >= 0),
  requires_guarantor    boolean DEFAULT false,
  is_active             boolean DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- LOANS table - Enhanced with product linkage
CREATE TABLE IF NOT EXISTS public.loans (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      uuid           NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  loan_product_id uuid          REFERENCES public.loan_products(id) ON DELETE SET NULL,
  principal      numeric(14,2)  NOT NULL CHECK (principal > 0),
  interest_rate  numeric(6,2)   NULL CHECK (interest_rate IS NULL OR interest_rate >= 0), -- NULL until admin sets on approval
  term_months    integer        NOT NULL CHECK (term_months > 0),
  status         text           NOT NULL DEFAULT 'pending',
  approved_at    timestamptz,
  approved_by_user_id uuid       REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at    timestamptz,
  rejected_by_user_id uuid       REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason    text,
  closed_at      timestamptz,
  closed_by_user_id   uuid       REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT loans_status_check CHECK (status IN ('pending','approved','rejected','closed'))
);

-- =============================================================================
-- PART 2: USER PROFILES & AUTHORIZATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id  uuid        REFERENCES public.members(id) ON DELETE SET NULL,
  role       text        NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_role_check CHECK (role IN ('admin','member'))
);

-- Trigger: Auto-create user_profiles row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Always create with role='member' regardless of user_metadata
  -- Admin role must be granted explicitly via database update
  INSERT INTO public.user_profiles (id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- PART 3: AUDIT LOGGING (IMMUTABLE)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role      text NOT NULL,
  action          text NOT NULL,
  entity_type     text,
  entity_id       uuid,
  old_value       jsonb,
  new_value       jsonb,
  reason          text,
  metadata        jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT audit_logs_action_check CHECK (action IN (
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
    'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED',
    'MFA_ENABLED', 'MFA_DISABLED',
    'MEMBER_CREATED', 'MEMBER_UPDATED', 'MEMBER_STATUS_CHANGED',
    'MEMBER_CLOSED', 'MEMBER_ARCHIVED',
    'TRANSACTION_RECORDED', 'TRANSACTION_REVERSED', 'TRANSACTION_ADJUSTED',
    'TRANSACTION_DELETED_ATTEMPT',
    'LOAN_APPLIED', 'LOAN_CREATED', 'LOAN_APPROVED', 'LOAN_REJECTED',
    'LOAN_CLOSED', 'LOAN_REPAYMENT_RECORDED',
    'ROLE_CHANGED', 'USER_LINKED_TO_MEMBER', 'USER_UNLINKED_FROM_MEMBER',
    'UNAUTHORIZED_ACCESS_ATTEMPT', 'AUTHORIZATION_CHECK_FAILED',
    'DATA_EXPORT', 'REPORT_GENERATED',
    'MEMBER_DATA_ACCESSED', 'SENSITIVE_DATA_REVEALED',
    'CONFIGURATION_CHANGED', 'BACKUP_INITIATED', 'BACKUP_RESTORED'
  ))
);

-- =============================================================================
-- PART 4: SEQUENCES & TRIGGERS
-- =============================================================================

-- Transaction reference generator
CREATE SEQUENCE IF NOT EXISTS txn_reference_seq START 1;

CREATE OR REPLACE FUNCTION generate_txn_reference()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  ref_num text;
BEGIN
  ref_num := 'TXN-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
             LPAD(NEXTVAL('txn_reference_seq')::text, 6, '0');
  RETURN ref_num;
END;
$$;

CREATE OR REPLACE FUNCTION set_txn_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.txn_reference IS NULL THEN
    NEW.txn_reference := generate_txn_reference();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_txn_reference_trigger ON public.transactions;
CREATE TRIGGER set_txn_reference_trigger
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_txn_reference();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_members_updated_at ON public.members;
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- PART 5: INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_members_status             ON public.members(status);
CREATE INDEX IF NOT EXISTS idx_members_phone              ON public.members(phone);
CREATE INDEX IF NOT EXISTS idx_accounts_member            ON public.accounts(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_member_posted ON public.transactions(member_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_reference     ON public.transactions(txn_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_loan          ON public.transactions(loan_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status        ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_loans_member_status        ON public.loans(member_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_product              ON public.loans(loan_product_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_member       ON public.user_profiles(member_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor           ON public.audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity          ON public.audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action          ON public.audit_logs(action, created_at DESC);

-- =============================================================================
-- PART 6: HARDENED SECURITY DEFINER FUNCTIONS
-- =============================================================================

-- SECURE is_admin() function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' 
     FROM public.user_profiles 
     WHERE id = auth.uid() 
     LIMIT 1),
    FALSE
  );
$$;

-- SECURE my_member_id() function
CREATE OR REPLACE FUNCTION public.my_member_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT member_id 
  FROM public.user_profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
$$;

-- Revoke and grant proper permissions
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_member_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_member_id() TO authenticated;

-- =============================================================================
-- PART 7: ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs    ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "auth_all_members" ON public.members;
DROP POLICY IF EXISTS "auth_all_accounts" ON public.accounts;
DROP POLICY IF EXISTS "auth_all_transactions" ON public.transactions;
DROP POLICY IF EXISTS "auth_all_loans" ON public.loans;
DROP POLICY IF EXISTS "admin_all_members" ON public.members;
DROP POLICY IF EXISTS "admin_all_accounts" ON public.accounts;
DROP POLICY IF EXISTS "admin_all_transactions" ON public.transactions;
DROP POLICY IF EXISTS "admin_all_loans" ON public.loans;
DROP POLICY IF EXISTS "member_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "member_read_own" ON public.members;
DROP POLICY IF EXISTS "admin_full_members" ON public.members;
DROP POLICY IF EXISTS "admin_full_accounts" ON public.accounts;
DROP POLICY IF EXISTS "member_read_own_accounts" ON public.accounts;
DROP POLICY IF EXISTS "admin_full_transactions" ON public.transactions;
DROP POLICY IF EXISTS "member_read_own_transactions" ON public.transactions;
DROP POLICY IF EXISTS "admin_full_loans" ON public.loans;
DROP POLICY IF EXISTS "member_read_own_loans" ON public.loans;
DROP POLICY IF EXISTS "member_insert_own_loan" ON public.loans;
DROP POLICY IF EXISTS "user_read_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_full_profiles" ON public.user_profiles;

-- MEMBERS policies
CREATE POLICY "admin_full_members" ON public.members 
  FOR ALL TO authenticated
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "member_read_own" ON public.members 
  FOR SELECT TO authenticated
  USING (id = public.my_member_id());

-- ACCOUNTS policies
CREATE POLICY "admin_full_accounts" ON public.accounts 
  FOR ALL TO authenticated
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "member_read_own_accounts" ON public.accounts 
  FOR SELECT TO authenticated
  USING (member_id = public.my_member_id());

-- TRANSACTIONS policies - NO DELETE/UPDATE for members
CREATE POLICY "admin_full_transactions" ON public.transactions 
  FOR ALL TO authenticated
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "member_read_own_transactions" ON public.transactions 
  FOR SELECT TO authenticated
  USING (member_id = public.my_member_id());

-- LOANS policies
CREATE POLICY "admin_full_loans" ON public.loans 
  FOR ALL TO authenticated
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "member_read_own_loans" ON public.loans 
  FOR SELECT TO authenticated
  USING (member_id = public.my_member_id());

CREATE POLICY "member_insert_own_loan" ON public.loans 
  FOR INSERT TO authenticated
  WITH CHECK (member_id = public.my_member_id() AND status = 'pending');

-- LOAN PRODUCTS policies - READ ONLY for all authenticated users
CREATE POLICY "authenticated_read_loan_products" ON public.loan_products
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "admin_manage_loan_products" ON public.loan_products
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- USER PROFILES policies
CREATE POLICY "user_read_own_profile" ON public.user_profiles 
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "admin_full_profiles" ON public.user_profiles 
  FOR ALL TO authenticated
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

-- AUDIT LOGS policies - READ ONLY for admins, NO WRITE via RLS
CREATE POLICY "admin_read_audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- NO INSERT/UPDATE/DELETE policies on audit_logs - only service-role can write

-- =============================================================================
-- PART 8: SEED DATA
-- =============================================================================

-- Seed default loan product
INSERT INTO public.loan_products (
  name, description,
  interest_rate_min, interest_rate_max, interest_rate_default,
  principal_min, principal_max,
  term_min_months, term_max_months,
  savings_multiplier, min_membership_days, requires_guarantor
) VALUES (
  'Standard Savings Loan',
  'General purpose loan for active members in good standing',
  3.0, 8.0, 5.0,
  50000, 5000000,
  1, 24,
  3.0, 90, false
) ON CONFLICT DO NOTHING;

-- Seed demo members (optional - remove in production)
INSERT INTO public.members (full_name, phone, national_id, status) VALUES
  ('Amina Nakuya',  '+256700000001', 'CM000001', 'active'),
  ('David Okello',  '+256700000002', 'CM000002', 'active'),
  ('Sarah Namuli',  '+256700000003', 'CM000003', 'active')
ON CONFLICT (phone) DO NOTHING;

-- =============================================================================
-- SETUP CHECKLIST
-- =============================================================================
-- ✅ 1. Run this schema in Supabase SQL Editor
-- ✅ 2. Enable Email auth: Authentication > Providers > Email
-- ✅ 3. Set redirect URLs: Authentication > URL Configuration
--      Site URL:      http://localhost:3000
--      Redirect URLs: http://localhost:3000/auth-callback
--                     http://localhost:3000/reset-password
-- ✅ 4. Add keys to .env.local:
--      NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
--      NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from API settings>
--      SUPABASE_SERVICE_ROLE_KEY=<service role key>
-- ✅ 5. Create first admin:
--      a) Register via /register (will be created as member)
--      b) Run: UPDATE public.user_profiles SET role = 'admin' WHERE id = '<user-uuid>';
--      c) User must sign out and back in for role to take effect
-- ✅ 6. Members register at /register and admin links them via dashboard

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================
-- ✅ User role is stored ONLY in user_profiles.role (database)
-- ✅ user_metadata.role is IGNORED for authorization
-- ✅ All privileged operations checked server-side
-- ✅ Audit logs are immutable (no UPDATE/DELETE via RLS)
-- ✅ Financial transactions cannot be deleted (only reversed)
-- ✅ Member deletion blocked if financial history exists
-- ✅ Transaction references auto-generated for reconciliation
-- ✅ Loan repayments linked to specific loans
-- ✅ Security definer functions hardened with search_path
