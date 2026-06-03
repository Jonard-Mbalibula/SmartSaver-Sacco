-- SmartSaver Sacco - Complete Schema v3 (Role-based)
-- Run this in Supabase Dashboard -> SQL Editor -> New query
-- Safe to re-run

-- =============================================================================
-- CORE TABLES
-- =============================================================================

create table if not exists public.members (
  id          uuid           primary key default gen_random_uuid(),
  full_name   text           not null,
  phone       text           not null unique,
  national_id text,
  status      text           not null default 'active',
  joined_at   timestamptz    not null default now(),
  created_at  timestamptz    not null default now(),
  constraint members_status_check check (status in ('active','paused','closed'))
);

create table if not exists public.accounts (
  id           uuid        primary key default gen_random_uuid(),
  member_id    uuid        not null references public.members(id) on delete cascade,
  account_no   text        not null unique,
  account_type text        not null default 'savings',
  created_at   timestamptz not null default now(),
  constraint accounts_type_check check (account_type in ('savings','loan'))
);

create table if not exists public.transactions (
  id         uuid           primary key default gen_random_uuid(),
  member_id  uuid           not null references public.members(id) on delete restrict,
  account_id uuid           references public.accounts(id) on delete set null,
  type       text           not null,
  amount     numeric(14,2)  not null,
  memo       text,
  posted_at  timestamptz    not null default now(),
  created_at timestamptz    not null default now(),
  constraint transactions_type_check   check (type in ('deposit','withdrawal','loan_payment','fee','adjustment')),
  constraint transactions_amount_check check (amount > 0)
);

create table if not exists public.loans (
  id            uuid           primary key default gen_random_uuid(),
  member_id     uuid           not null references public.members(id) on delete restrict,
  principal     numeric(14,2)  not null,
  interest_rate numeric(6,2)   null,              -- NULL until admin approves and sets it
  term_months   integer        not null,
  status        text           not null default 'pending',
  approved_at   timestamptz,
  created_at    timestamptz    not null default now(),
  constraint loans_status_check    check (status in ('pending','approved','rejected','closed')),
  constraint loans_principal_check check (principal > 0),
  constraint loans_term_check      check (term_months > 0)
);

-- =============================================================================
-- USER PROFILES  (links auth.users to members + stores role)
-- =============================================================================

create table if not exists public.user_profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  member_id  uuid        references public.members(id) on delete set null,
  role       text        not null default 'member',
  created_at timestamptz not null default now(),
  constraint user_profiles_role_check check (role in ('admin','member'))
);

-- Auto-create a user_profiles row on new auth user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, role)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::text, 'member')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================================
-- INDEXES
-- =============================================================================

create index if not exists idx_members_status             on public.members(status);
create index if not exists idx_accounts_member            on public.accounts(member_id);
create index if not exists idx_transactions_member_posted on public.transactions(member_id, posted_at desc);
create index if not exists idx_loans_member_status        on public.loans(member_id, status);
create index if not exists idx_user_profiles_member       on public.user_profiles(member_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.members       enable row level security;
alter table public.accounts      enable row level security;
alter table public.transactions  enable row level security;
alter table public.loans         enable row level security;
alter table public.user_profiles enable row level security;

-- Drop all old policies
drop policy if exists "auth_all_members"       on public.members;
drop policy if exists "auth_all_accounts"      on public.accounts;
drop policy if exists "auth_all_transactions"  on public.transactions;
drop policy if exists "auth_all_loans"         on public.loans;
drop policy if exists "admin_all_members"      on public.members;
drop policy if exists "admin_all_accounts"     on public.accounts;
drop policy if exists "admin_all_transactions" on public.transactions;
drop policy if exists "admin_all_loans"        on public.loans;
drop policy if exists "member_own_profile"     on public.user_profiles;
drop policy if exists "admin_all_profiles"     on public.user_profiles;

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql security definer
as $$
  select coalesce(
    (select role = 'admin' from public.user_profiles where id = auth.uid()),
    false
  );
$$;

-- Helper: get member_id for current user
create or replace function public.my_member_id()
returns uuid
language sql security definer
as $$
  select member_id from public.user_profiles where id = auth.uid();
$$;

-- MEMBERS
create policy "admin_full_members" on public.members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "member_read_own" on public.members for select to authenticated
  using (id = public.my_member_id());

-- ACCOUNTS
create policy "admin_full_accounts" on public.accounts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "member_read_own_accounts" on public.accounts for select to authenticated
  using (member_id = public.my_member_id());

-- TRANSACTIONS
create policy "admin_full_transactions" on public.transactions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "member_read_own_transactions" on public.transactions for select to authenticated
  using (member_id = public.my_member_id());

-- LOANS
create policy "admin_full_loans" on public.loans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "member_read_own_loans" on public.loans for select to authenticated
  using (member_id = public.my_member_id());

create policy "member_insert_own_loan" on public.loans for insert to authenticated
  with check (member_id = public.my_member_id());

-- USER PROFILES
create policy "user_read_own_profile" on public.user_profiles for select to authenticated
  using (id = auth.uid());

create policy "admin_full_profiles" on public.user_profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- SEED DATA
-- =============================================================================

insert into public.members (full_name, phone, national_id) values
  ('Amina Nakuya',  '+256700000001', 'CM000001'),
  ('David Okello',  '+256700000002', 'CM000002'),
  ('Sarah Namuli',  '+256700000003', 'CM000003')
on conflict (phone) do nothing;

-- =============================================================================
-- SETUP CHECKLIST
-- =============================================================================
-- 1. Run supabase/fix-loans-table.sql first if loans table has missing columns
-- 2. Enable Email auth: Authentication > Providers > Email
-- 3. Set redirect URLs: Authentication > URL Configuration
--      Site URL:      http://localhost:3000
--      Redirect URLs: http://localhost:3000/auth-callback
--                     http://localhost:3000/reset-password
-- 4. Add keys to .env.local:
--      NEXT_PUBLIC_SUPABASE_URL=https://zouxakzclowsinofbnps.supabase.co
--      NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from API settings>
--      SUPABASE_SERVICE_ROLE_KEY=<service role key>
-- 5. Create first admin via: Supabase Dashboard > Authentication > Users > Add user
--    Then run: UPDATE public.user_profiles SET role = 'admin' WHERE id = '<user-uuid>';
-- 6. Members register at /register (get role=member by default)
--    Admin links them to a member record in the Users & Roles panel
