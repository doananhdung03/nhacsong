-- Run once in Supabase SQL Editor after preview.sql. Safe to re-run.
-- Guests may fill a song's preview only while it is empty; they can never change title, artist, lyrics or an existing preview.
-- Supabase grants table-wide UPDATE to anon by default, so narrow it to the preview column first.
revoke update on public.songs from anon;
grant update (preview) on public.songs to anon;

drop policy if exists "Anyone can fill empty preview" on public.songs;
create policy "Anyone can fill empty preview" on public.songs for update to anon
  using (preview is null)
  with check (preview is not null and char_length(preview) <= 200);
