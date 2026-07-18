create extension if not exists pgcrypto;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  teacher_token text not null,
  question text not null,
  learning_objective text not null,
  canonical_model text not null,
  domain text not null default 'Physics',
  status text not null default 'collecting' check (status in ('collecting','generating','world-ready','launched','revealed')),
  world_slug text,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  alias text not null,
  access_token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  alias text not null,
  answer text not null,
  cluster_key text not null default 'unclassified',
  created_at timestamptz not null default now(),
  unique (session_id, alias)
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  alias text not null,
  selected_world text not null check (selected_world in ('A','B')),
  evidence text not null default '',
  created_at timestamptz not null default now(),
  unique (session_id, alias)
);

create table if not exists public.revisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  alias text not null,
  before_belief text not null,
  after_belief text not null,
  changed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, alias)
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','analyzing','generating','validating','ready','failed','fallback')),
  stage text not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  world_slug text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worlds (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  session_id uuid references public.sessions(id) on delete set null,
  manifest jsonb not null,
  artifact_key text,
  source_model text not null,
  validation_status text not null default 'verified',
  created_at timestamptz not null default now()
);

create index if not exists memberships_session_idx on public.memberships(session_id);
create index if not exists responses_session_idx on public.responses(session_id);
create index if not exists predictions_session_idx on public.predictions(session_id);
create index if not exists revisions_session_idx on public.revisions(session_id);
create index if not exists generation_jobs_status_idx on public.generation_jobs(status, created_at);

alter table public.sessions enable row level security;
alter table public.memberships enable row level security;
alter table public.responses enable row level security;
alter table public.predictions enable row level security;
alter table public.revisions enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.worlds enable row level security;

revoke all on public.sessions, public.memberships, public.responses, public.predictions, public.revisions, public.generation_jobs, public.worlds from anon, authenticated;
grant all on public.sessions, public.memberships, public.responses, public.predictions, public.revisions, public.generation_jobs, public.worlds to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('counterworlds', 'counterworlds', false, 204800, array['text/html'])
on conflict (id) do update set public = false, file_size_limit = 204800, allowed_mime_types = array['text/html'];

drop policy if exists "No direct world reads" on storage.objects;
create policy "No direct world reads" on storage.objects for select to anon, authenticated using (false);
