-- Phase 5a (AGG-29): evolve the flat conversations table into a thread header,
-- add a messages child + user_memory, and stamp conversation context on
-- questions. All additive + nullable → safe on the live app (current code
-- ignores the new shapes). Applied to prod 2026-07-14.

-- conversations → thread header (keep text id + question/models/result as the
-- turn-1 cache so history.ts + instant turn-1 render keep working unchanged).
alter table public.conversations
  add column if not exists last_message_at timestamptz not null default now(),
  add column if not exists turn_count int not null default 1;

-- messages: one row per turn (user turn OR assistant turn).
create table if not exists public.messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   text not null references public.conversations(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  turn              int  not null,
  role              text not null check (role in ('user','assistant_single','assistant_comparison')),
  model_id          text,
  question_id       uuid references public.questions(id) on delete set null,
  content           text,
  result            jsonb,
  prompt_tokens     int,
  completion_tokens int,
  cost_usd          numeric(10,6),
  latency_ms        int,
  created_at        timestamptz not null default now()
);
create unique index if not exists messages_conv_turn_role on public.messages (conversation_id, turn, role);
create index if not exists messages_user on public.messages (user_id);
alter table public.messages enable row level security;
create policy messages_owner on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_memory: per-user explicit + implicit memory (Settings UI lands in 5c).
create table if not exists public.user_memory (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  explicit          jsonb   not null default '{}',
  implicit          jsonb   not null default '{}',
  enabled           boolean not null default true,
  implicit_enabled  boolean not null default false,
  updated_at        timestamptz not null default now()
);
alter table public.user_memory enable row level security;
create policy user_memory_owner on public.user_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- questions: stamp conversation context for internal analytics (depth, cost/turn).
alter table public.questions
  add column if not exists conversation_id text,
  add column if not exists turn int;

-- Backfill existing conversations → turn-0 user + turn-1 assistant_comparison.
insert into public.messages (conversation_id, user_id, turn, role, content)
  select id, user_id, 0, 'user', question from public.conversations
  on conflict (conversation_id, turn, role) do nothing;
insert into public.messages (conversation_id, user_id, turn, role, result)
  select id, user_id, 1, 'assistant_comparison', result from public.conversations where result is not null
  on conflict (conversation_id, turn, role) do nothing;
