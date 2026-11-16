import { randomUUID } from 'node:crypto';
import { isYoutubeAdmin, settingsRequest, storedKeys, keyUsage } from '../../../../lib/youtube-settings.mjs';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request) {
  if (!await isYoutubeAdmin(request)) return json({ error: 'Bạn không có quyền quản lý key YouTube.' }, 403);
  try {
    const row = await settingsRequest();
    return json({ configured: Boolean(row), environmentKey: Boolean(process.env.YOUTUBE_API_KEY), updatedAt: row?.updated_at || null,
      keys: storedKeys(row).map(item => ({ id: item.id, name: item.name, active: item.key === row?.api_key, used: keyUsage(row, item.key) })) });
  } catch (error) { return json({ error: error.message }, 503); }
}

export async function POST(request) {
  if (!await isYoutubeAdmin(request)) return json({ error: 'Bạn không có quyền quản lý key YouTube.' }, 403);
  if (Number(request.headers.get('content-length')) > 2048) return json({ error: 'Dữ liệu quá lớn.' }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Dữ liệu không hợp lệ.' }, 400); }
  try {
    const row = await settingsRequest(), keys = storedKeys(row);
    if (body?.action === 'reveal') {
      const selected = keys.find(item => item.id === body.id);
      if (!selected) return json({ error: 'Không tìm thấy key.' }, 404);
      return json({ key: selected.key });
    }
    if (body?.action === 'activate') {
      const selected = keys.find(item => item.id === body.id);
      if (!selected) return json({ error: 'Không tìm thấy key.' }, 404);
      await settingsRequest('POST', selected.key, keys);
    } else {
      if (body?.action && body.action !== 'add') return json({ error: 'Thao tác không hợp lệ.' }, 400);
      const key = body?.importEnvironment === true ? process.env.YOUTUBE_API_KEY : body?.key;
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{20,200}$/.test(key.trim())) return json({ error: 'Key YouTube không hợp lệ.' }, 400);
      const name = typeof body.name === 'string' ? body.name.trim() : `Key ${keys.length + 1}`;
      if (!name || name.length > 80) return json({ error: 'Tên key cần từ 1 đến 80 ký tự.' }, 400);
      if (keys.some(item => item.key === key.trim())) return json({ error: 'Key này đã có trong danh sách.' }, 409);
      if (keys.length >= 20) return json({ error: 'Danh sách tối đa 20 key.' }, 400);
      keys.push({ id: randomUUID(), name, key: key.trim() });
      await settingsRequest('POST', row?.api_key || key.trim(), keys);
    }
    return json({ saved: true });
  } catch (error) { return json({ error: error.message }, 503); }
}
