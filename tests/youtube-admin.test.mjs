import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../app/api/admin/youtube/route.js';
import { youtubeKey } from '../lib/youtube-settings.mjs';

test('YouTube settings require verified admin and never return stored secrets', async () => {
  const originalFetch = globalThis.fetch;
  const names = ['ADMIN_EMAIL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'YOUTUBE_API_KEY'];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { ADMIN_EMAIL: 'admin@example.com', NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-key', SUPABASE_SERVICE_ROLE_KEY: 'server-secret', YOUTUBE_API_KEY: 'environment-secret' });
  let email = 'other@example.com', stored = null, writes = 0;
  const request = body => new Request('http://localhost/api/admin/youtube', { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  globalThis.fetch = async (url, options) => {
    if (url.includes('/auth/v1/user')) return Response.json({ id: 'user-id', email, email_confirmed_at: '2026-01-01' });
    assert.equal(options.headers.apikey, 'server-secret');
    if (options.method === 'POST') { stored = JSON.parse(options.body); writes++; return new Response(null, { status: 201 }); }
    return Response.json(stored ? [stored] : []);
  };
  try {
    assert.equal((await GET(new Request('http://localhost/api/admin/youtube'))).status, 403);
    assert.equal((await POST(request({ importEnvironment: true }))).status, 403);
    assert.equal(writes, 0);
    assert.equal((await POST(request({ action: 'reveal', id: 'original' }))).status, 403);
    email = 'admin@example.com';
    assert.equal((await POST(request({ key: 'bad' }))).status, 400);
    // Import uses the existing environment key; use a realistic length.
    process.env.YOUTUBE_API_KEY = 'AIza-test-environment-key-1234567890';
    assert.equal((await POST(request({ importEnvironment: true }))).status, 200);
    assert.equal(writes, 1);
    const response = await GET(request());
    const body = await response.text();
    assert.equal(JSON.parse(body).configured, true);
    assert.ok(!body.includes(process.env.YOUTUBE_API_KEY));
    assert.ok(!body.includes('server-secret'));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await youtubeKey(), process.env.YOUTUBE_API_KEY);
    const duplicate = await POST(request({ key: process.env.YOUTUBE_API_KEY }));
    assert.equal(duplicate.status, 409);
    await POST(request({ action: 'add', name: 'Dự phòng', key: 'AIza-replacement-key-123456789012345' }));
    assert.equal(await youtubeKey(), process.env.YOUTUBE_API_KEY);
    const list = await (await GET(request())).json();
    assert.equal(list.keys.length, 2);
    assert.ok(list.keys.every(item => !('key' in item)));
    const spare = list.keys.find(item => item.name === 'Dự phòng');
    const revealed = await POST(request({ action: 'reveal', id: spare.id }));
    assert.equal(revealed.headers.get('cache-control'), 'no-store');
    assert.equal((await revealed.json()).key, 'AIza-replacement-key-123456789012345');
    assert.equal((await POST(request({ action: 'reveal', id: 'missing' }))).status, 404);
    assert.equal((await POST(request({ action: 'activate', id: 'missing' }))).status, 404);
    assert.equal((await POST(request({ action: 'activate', id: spare.id }))).status, 200);
    assert.equal(await youtubeKey(), 'AIza-replacement-key-123456789012345');
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) { if (original[name] === undefined) delete process.env[name]; else process.env[name] = original[name]; }
  }
});
