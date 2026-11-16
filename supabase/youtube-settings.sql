-- Run in the Hồng Lâm project's SQL Editor. No browser roles can read keys.
create table if not exists public.youtube_settings (
  id boolean primary key default true check (id),
  api_key text not null check (char_length(api_key) between 20 and 200),
  updated_at timestamptz not null default now()
);
alter table public.youtube_settings enable row level security;
-- Existing single key is preserved; admin imports it into the list on first change.
alter table public.youtube_settings add column if not exists keyring jsonb not null default '[]'::jsonb
  check (jsonb_typeof(keyring) = 'array' and jsonb_array_length(keyring) <= 20);
revoke all on public.youtube_settings from public, anon, authenticated;
grant select, insert, update on public.youtube_settings to service_role;
