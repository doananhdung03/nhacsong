-- Run once in Supabase SQL Editor before deploying the preview feature. Safe to re-run.
-- Short lyric preview (first ~180 characters) shown under catalog search results.
alter table public.songs add column if not exists preview text check (char_length(preview) <= 200);
