-- Run once in Supabase SQL Editor after songs.sql. Safe to re-run.
-- Adds hand-entered lyrics and lets only the admin email edit/delete songs via /admin.
-- Replace ADMIN_EMAIL (twice) with the admin's login email before running.
alter table public.songs add column if not exists lyrics text check (char_length(lyrics) <= 20000);

-- Anonymous auto-collect may only add title/artist rows, never lyrics.
drop policy if exists "Anyone can add songs" on public.songs;
create policy "Anyone can add songs" on public.songs for insert to anon, authenticated with check (lyrics is null);

drop policy if exists "Admin manages songs" on public.songs;
create policy "Admin manages songs" on public.songs for all to authenticated
  using (auth.jwt() ->> 'email' = 'ADMIN_EMAIL')
  with check (auth.jwt() ->> 'email' = 'ADMIN_EMAIL');

grant select, insert, update, delete on public.songs to authenticated;
