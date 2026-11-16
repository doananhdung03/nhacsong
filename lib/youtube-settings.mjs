// Server-only: never import this module into a client component.
import { createHash } from 'node:crypto';
export const settingsReady = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function settingsRequest(method = 'GET', key, keyring) {
  if (!settingsReady()) throw new Error('Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trên máy chủ.');
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/youtube_settings?${method === 'GET' ? 'select=*&id=eq.true' : 'on_conflict=id'}`, {
    method, cache: 'no-store', signal: AbortSignal.timeout(8000),
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(method === 'POST' ? { Prefer: 'resolution=merge-duplicates,return=minimal' } : {}) },
    ...(method === 'POST' ? { body: JSON.stringify({ id: true, api_key: key, ...(keyring ? { keyring } : {}), updated_at: new Date().toISOString() }) } : {}),
  });
  if (!response.ok) throw new Error('Không truy cập được cấu hình YouTube. Kiểm tra kết nối và chạy supabase/youtube-settings.sql.');
  return method === 'GET' ? (await response.json())[0] || null : null;
}

export function storedKeys(row) {
  const keys = Array.isArray(row?.keyring) ? row.keyring : [];
  if (row?.api_key && !keys.some(item => item.key === row.api_key)) return [{ id: 'original', name: 'Key hiện tại', key: row.api_key }, ...keys];
  return keys;
}

export async function youtubeKey() {
  const row = settingsReady() ? await settingsRequest() : null;
  return row?.api_key || process.env.YOUTUBE_API_KEY;
}

export async function reserveYoutubeKey() {
  if (!settingsReady()) return { key: process.env.YOUTUBE_API_KEY };
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/reserve_youtube_key`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(8000),
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!response.ok) throw new Error('Chưa cấu hình bộ đếm. Chạy supabase/youtube-usage.sql.');
  const data = await response.json();
  return data.missing ? { key: process.env.YOUTUBE_API_KEY } : data;
}

export function keyUsage(row, key) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return row?.usage_day === today ? Number(row.usage_counts?.[createHash('md5').update(key).digest('hex')] || 0) : 0;
}

export async function isYoutubeAdmin(request) {
  const token = request.headers.get('authorization');
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !/^Bearer \S+$/i.test(token || '') || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return false;
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: token }, cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const user = await response.json();
    return Boolean(user.id && user.email_confirmed_at && user.email?.toLowerCase() === email && !user.is_anonymous);
  } catch { return false; }
}
