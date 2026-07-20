create schema if not exists better_auth;

create table if not exists better_auth."user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  role text default 'user',
  banned boolean default false,
  "banReason" text,
  "banExpires" timestamptz,
  "twoFactorEnabled" boolean default false
);

create table if not exists better_auth.session (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references better_auth."user"(id) on delete cascade,
  "impersonatedBy" text,
  "activeOrganizationId" text
);

create index if not exists auth_session_user_idx on better_auth.session("userId");

create table if not exists better_auth.account (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references better_auth."user"(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists auth_account_user_idx on better_auth.account("userId");

create table if not exists better_auth.verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists auth_verification_identifier_idx on better_auth.verification(identifier);

create table if not exists better_auth.organization (
  id text primary key,
  name text not null,
  slug text not null unique,
  logo text,
  "createdAt" timestamptz not null,
  metadata text
);

create index if not exists auth_organization_slug_idx on better_auth.organization(slug);

create table if not exists better_auth.member (
  id text primary key,
  "organizationId" text not null references better_auth.organization(id) on delete cascade,
  "userId" text not null references better_auth."user"(id) on delete cascade,
  role text not null default 'member',
  "createdAt" timestamptz not null,
  unique ("organizationId", "userId")
);

create index if not exists auth_member_org_idx on better_auth.member("organizationId");
create index if not exists auth_member_user_idx on better_auth.member("userId");

create table if not exists better_auth.invitation (
  id text primary key,
  "organizationId" text not null references better_auth.organization(id) on delete cascade,
  email text not null,
  role text,
  status text not null default 'pending',
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "inviterId" text not null references better_auth."user"(id) on delete cascade
);

create index if not exists auth_invitation_org_idx on better_auth.invitation("organizationId");
create index if not exists auth_invitation_email_idx on better_auth.invitation(email);

create table if not exists better_auth."twoFactor" (
  id text primary key,
  secret text not null,
  "backupCodes" text not null,
  "userId" text not null references better_auth."user"(id) on delete cascade,
  verified boolean default true,
  "failedVerificationCount" integer default 0,
  "lockedUntil" timestamptz
);

create index if not exists auth_two_factor_user_idx on better_auth."twoFactor"("userId");
create index if not exists auth_two_factor_secret_idx on better_auth."twoFactor"(secret);

create table if not exists better_auth."rateLimit" (
  id text primary key,
  key text not null unique,
  count integer not null,
  "lastRequest" bigint not null
);

create table if not exists public.teacher_profiles (
  user_id text primary key references better_auth."user"(id) on delete cascade,
  display_name text not null,
  title text not null default '',
  subjects text[] not null default '{}',
  grade_bands text[] not null default '{}',
  timezone text not null default 'UTC',
  terms_version text not null default '2026-07-20',
  terms_accepted_at timestamptz not null default now(),
  school_authority_confirmed_at timestamptz not null default now(),
  onboarding_completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_settings (
  organization_id text primary key references better_auth.organization(id) on delete cascade,
  school_type text not null default 'secondary-school',
  country text not null default '',
  timezone text not null default 'UTC',
  default_ai_provider text not null default 'vertex-gemini' check (default_ai_provider in ('vertex-gemini','openai')),
  shared_credential_id uuid,
  retention_days integer not null default 90 check (retention_days between 30 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id text references better_auth.organization(id) on delete cascade,
  owner_user_id text references better_auth."user"(id) on delete cascade,
  scope text not null check (scope in ('organization','personal')),
  provider text not null default 'openai' check (provider = 'openai'),
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version integer not null default 1,
  last_four text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'organization' and organization_id is not null) or (scope = 'personal' and owner_user_id is not null))
);

alter table public.organization_settings
  drop constraint if exists organization_settings_shared_credential_id_fkey;
alter table public.organization_settings
  add constraint organization_settings_shared_credential_id_fkey foreign key (shared_credential_id) references public.ai_credentials(id) on delete set null;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id text references better_auth."user"(id) on delete set null,
  organization_id text references better_auth.organization(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  network_hash text,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_org_created_idx on public.audit_events(organization_id, created_at desc);

create table if not exists public.rate_limit_counters (
  key text primary key,
  count integer not null default 1,
  window_started_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.mfa_session_grants (
  session_id text primary key references better_auth.session(id) on delete cascade,
  user_id text not null references better_auth."user"(id) on delete cascade,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.sessions alter column teacher_token drop not null;
alter table public.sessions add column if not exists owner_user_id text references better_auth."user"(id) on delete set null;
alter table public.sessions add column if not exists organization_id text references better_auth.organization(id) on delete set null;
alter table public.sessions add column if not exists ai_provider text not null default 'vertex-gemini' check (ai_provider in ('vertex-gemini','openai'));
alter table public.sessions add column if not exists credential_id uuid references public.ai_credentials(id) on delete set null;
alter table public.sessions add column if not exists updated_at timestamptz not null default now();
alter table public.sessions add column if not exists last_activity_at timestamptz not null default now();
alter table public.sessions add column if not exists ended_at timestamptz;
alter table public.sessions add column if not exists archived_at timestamptz;
alter table public.sessions add column if not exists purge_at timestamptz;
alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check check (status in ('collecting','generating','world-ready','launched','revealed','archived'));
create index if not exists sessions_owner_created_idx on public.sessions(owner_user_id, created_at desc);
create index if not exists sessions_org_created_idx on public.sessions(organization_id, created_at desc);
create index if not exists sessions_purge_idx on public.sessions(purge_at) where purge_at is not null;

alter table public.memberships alter column access_token drop not null;
alter table public.memberships add column if not exists access_token_hash text;
alter table public.memberships add column if not exists notice_version text not null default 'student-privacy-2026-07-20';
alter table public.memberships add column if not exists notice_acknowledged_at timestamptz;
create unique index if not exists memberships_access_token_hash_idx on public.memberships(access_token_hash) where access_token_hash is not null;

alter table public.generation_jobs add column if not exists provider text not null default 'vertex-gemini';
alter table public.generation_jobs add column if not exists model text not null default 'gemini-2.5-flash';
alter table public.generation_jobs add column if not exists credential_scope text not null default 'platform';
alter table public.generation_jobs add column if not exists prompt_contract_version text not null default 'cw-world-v2';
alter table public.generation_jobs add column if not exists idempotency_key text;
alter table public.generation_jobs add column if not exists attempts integer not null default 0;
alter table public.generation_jobs add column if not exists started_at timestamptz;
alter table public.generation_jobs add column if not exists completed_at timestamptz;
alter table public.generation_jobs add column if not exists failure_category text;
create unique index if not exists generation_jobs_idempotency_idx on public.generation_jobs(idempotency_key) where idempotency_key is not null;

alter table public.worlds add column if not exists provider text not null default 'vertex-gemini';
alter table public.worlds add column if not exists contract_version text not null default 'cw-world-v2';

alter table public.teacher_profiles enable row level security;
alter table public.organization_settings enable row level security;
alter table public.ai_credentials enable row level security;
alter table public.audit_events enable row level security;
alter table public.rate_limit_counters enable row level security;
alter table public.mfa_session_grants enable row level security;

revoke all on public.teacher_profiles, public.organization_settings, public.ai_credentials, public.audit_events, public.rate_limit_counters, public.mfa_session_grants from anon, authenticated;
grant all on public.teacher_profiles, public.organization_settings, public.ai_credentials, public.audit_events, public.rate_limit_counters, public.mfa_session_grants to service_role;
grant usage on schema better_auth to service_role;
grant all on all tables in schema better_auth to service_role;

create or replace function public.consume_rate_limit(counter_key text, maximum integer, window_seconds integer)
returns table(allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.rate_limit_counters%rowtype;
  current_time timestamptz := now();
begin
  insert into public.rate_limit_counters(key, count, window_started_at, expires_at)
  values (counter_key, 1, current_time, current_time + make_interval(secs => window_seconds))
  on conflict (key) do update set
    count = case when rate_limit_counters.expires_at <= current_time then 1 else rate_limit_counters.count + 1 end,
    window_started_at = case when rate_limit_counters.expires_at <= current_time then current_time else rate_limit_counters.window_started_at end,
    expires_at = case when rate_limit_counters.expires_at <= current_time then current_time + make_interval(secs => window_seconds) else rate_limit_counters.expires_at end
  returning * into current_row;

  allowed := current_row.count <= maximum;
  retry_after := greatest(1, ceil(extract(epoch from current_row.expires_at - current_time))::integer);
  return next;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
