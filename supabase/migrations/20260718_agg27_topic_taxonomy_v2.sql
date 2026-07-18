-- AGG-27: topic taxonomy v2 — two-level, versioned. Applied to
-- kmkuajbtygqwbipcgxxa 2026-07-18. `questions.topics` stays the dashboard-facing
-- DOMAIN array (re-tagged cleaner — no "News & Current Events", recency lives in
-- questions.web_search); this adds the finer subtopic level + a version marker
-- that drives the one-time re-tag (api/scripts/tag-topics.mjs, ops repo).
alter table questions add column if not exists subtopics text[];
alter table questions add column if not exists topics_version smallint;

create index if not exists questions_topics_gin on questions using gin (topics);
create index if not exists questions_subtopics_gin on questions using gin (subtopics);
create index if not exists questions_topics_version_idx on questions (topics_version);
