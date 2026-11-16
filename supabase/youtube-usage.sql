-- Run after youtube-settings.sql. Existing keys are preserved.
alter table public.youtube_settings add column if not exists usage_day date;
alter table public.youtube_settings add column if not exists usage_counts jsonb not null default '{}'::jsonb;

-- Row lock makes reservations atomic across tabs, users and server instances.
create or replace function public.reserve_youtube_key()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  config public.youtube_settings%rowtype;
  today date := (now() at time zone 'America/Los_Angeles')::date;
  keys jsonb;
  entry jsonb;
  counts jsonb;
  fingerprint text;
  used integer;
begin
  select * into config from public.youtube_settings where id = true for update;
  if not found then return jsonb_build_object('missing', true); end if;
  counts := case when config.usage_day = today then config.usage_counts else '{}'::jsonb end;
  keys := config.keyring;
  if not exists (select 1 from jsonb_array_elements(keys) k where k->>'key' = config.api_key) then
    keys := jsonb_build_array(jsonb_build_object('id', 'original', 'name', 'Key hiện tại', 'key', config.api_key)) || keys;
  end if;
  for entry in
    select k from jsonb_array_elements(keys) with ordinality as entries(k, position)
    order by (k->>'key' = config.api_key) desc, position
  loop
    fingerprint := md5(entry->>'key');
    used := coalesce((counts->>fingerprint)::integer, 0);
    if used < 100 then
      counts := jsonb_set(counts, array[fingerprint], to_jsonb(used + 1));
      update public.youtube_settings set api_key = entry->>'key', usage_day = today, usage_counts = counts where id = true;
      return jsonb_build_object('key', entry->>'key', 'used', used + 1);
    end if;
  end loop;
  return jsonb_build_object('exhausted', true);
end;
$$;
revoke all on function public.reserve_youtube_key() from public, anon, authenticated;
grant execute on function public.reserve_youtube_key() to service_role;
