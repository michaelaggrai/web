-- AGG-14: image-upload foundation. Applied to prod 2026-07-25.
--   1. questions.image_count  — how many images were attached to an ask
--   2. attachments table      — one row per uploaded image
--   3. private Storage bucket  — image files, service-role + signed-URL only
--
-- Access model: uploads use a service-minted SIGNED UPLOAD URL; the backend
-- reads via a short-lived SIGNED READ URL it hands to OpenRouter. Both bypass
-- RLS (token-authorised), so the bucket needs NO storage.objects policies — it
-- stays fully locked to service-role + signed tokens. The only RLS here is
-- owner-read on the attachments *rows* so the browser can list a user's own
-- images (history/thread thumbnails).

-- 1. image_count on the ask
alter table public.questions
  add column if not exists image_count integer not null default 0;

-- 2. attachments — created at upload time (question_id null, status 'pending');
--    linked to the ask + marked 'attached' when /ask records the question row.
--    Owner = the uploading user (Pro+, always signed in). Cascades on BOTH user
--    delete (GDPR) and question delete.
create table if not exists public.attachments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  question_id   uuid references public.questions(id) on delete cascade,
  storage_path  text not null unique,
  mime_type     text,
  size_bytes    integer,
  width         integer,
  height        integer,
  status        text not null default 'pending',   -- 'pending' | 'attached'
  created_at    timestamptz not null default now()
);
create index if not exists attachments_user_idx      on public.attachments(user_id);
create index if not exists attachments_question_idx   on public.attachments(question_id);
create index if not exists attachments_orphan_idx     on public.attachments(created_at)
  where question_id is null;

alter table public.attachments enable row level security;
drop policy if exists attachments_owner_read on public.attachments;
create policy attachments_owner_read on public.attachments
  for select using (auth.uid() = user_id);
-- inserts/updates/deletes are service-role only (sign endpoint + backend) → bypass RLS.

-- 3. private bucket (10 MB/file, raster images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760,
        array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;
