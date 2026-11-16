import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/youtube/search/route.js';

test('YouTube validates input, keeps key server-side, paginates and handles quota failures', async () => {
  const originalFetch = globalThis.fetch, originalKey = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = 'private-test-key';
  try {
    assert.equal((await GET(new Request('http://localhost/api/youtube/search?q='))).status, 400);
    globalThis.fetch = async url => {
      assert.equal(url.searchParams.get('key'), 'private-test-key');
      assert.equal(url.searchParams.get('q'), 'Nàng thơ karaoke');
      assert.equal(url.searchParams.get('pageToken'), 'page2');
      assert.equal(url.searchParams.get('videoEmbeddable'), 'true');
      return Response.json({ items: [{ id: { videoId: 'abcdefghijk' }, snippet: { title: 'Karaoke', channelTitle: 'Kênh thử' } }], nextPageToken: 'page3' });
    };
    const response = await GET(new Request('http://localhost/api/youtube/search?q=N%C3%A0ng%20th%C6%A1&page=page2'));
    const data = await response.json();
    assert.equal(data.items[0].id, 'abcdefghijk');
    assert.equal(data.nextPage, 'page3');
    assert.ok(!JSON.stringify(data).includes('private-test-key'));
    globalThis.fetch = async () => Response.json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, { status: 403 });
    assert.equal((await GET(new Request('http://localhost/api/youtube/search?q=test'))).status, 429);
    delete process.env.YOUTUBE_API_KEY;
    assert.equal((await GET(new Request('http://localhost/api/youtube/search?q=test'))).status, 503);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = originalKey;
  }
});

test('search reserves a database key and stops before calling Google if all keys are exhausted', async () => {
  const fetchOriginal = globalThis.fetch;
  const names = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-secret';
  let exhausted = false, googleCalls = 0;
  globalThis.fetch = async (url, options) => {
    if (typeof url === 'string' && url.includes('/rpc/reserve_youtube_key')) {
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.apikey, 'server-secret');
      return Response.json(exhausted ? { exhausted: true } : { key: 'selected-database-key', used: 100 });
    }
    googleCalls++;
    assert.equal(url.searchParams.get('key'), 'selected-database-key');
    return Response.json({ items: [] });
  };
  try {
    const request = () => new Request('http://localhost/api/youtube/search?q=test');
    assert.equal((await GET(request())).status, 200);
    assert.equal(googleCalls, 1);
    exhausted = true;
    const response = await GET(request());
    assert.equal(response.status, 429);
    assert.equal(googleCalls, 1);
    assert.ok(!(await response.text()).includes('selected-database-key'));
  } finally {
    globalThis.fetch = fetchOriginal;
    for (const name of names) { if (original[name] === undefined) delete process.env[name]; else process.env[name] = original[name]; }
  }
});
