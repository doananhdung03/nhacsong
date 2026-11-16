import { reserveYoutubeKey } from '../../../../lib/youtube-settings.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get('q') || '').replace(/\s+/g, ' ').trim();
  const page = params.get('page') || '';
  if (!query || query.length > 150 || page.length > 500 || !/^[\w-]*$/.test(page)) {
    return Response.json({ error: 'Từ khóa cần từ 1 đến 150 ký tự.' }, { status: 400 });
  }
  let key;
  try {
    const reservation = await reserveYoutubeKey();
    if (reservation.exhausted) return Response.json({ error: 'Tất cả key đã đạt 100 lượt gọi từ website hôm nay. Thử lại sau khi đặt lại bộ đếm.' }, { status: 429 });
    key = reservation.key;
  } catch { return Response.json({ error: 'Không đọc được bộ đếm YouTube. Kiểm tra cấu hình và chạy supabase/youtube-usage.sql.' }, { status: 503 }); }
  if (!key) return Response.json({ error: 'Chưa cấu hình khóa YouTube trên máy chủ.' }, { status: 503 });
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({ key, part: 'snippet', type: 'video', maxResults: '10',
    q: /\bkaraoke\b/i.test(query) ? query : `${query} karaoke`,
    relevanceLanguage: 'vi', regionCode: 'VN', videoEmbeddable: 'true', videoSyndicated: 'true',
    ...(page ? { pageToken: page } : {}) }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]), cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      const quota = data.error?.errors?.some(item => ['quotaExceeded', 'dailyLimitExceeded'].includes(item.reason));
      return Response.json({ error: quota ? 'YouTube đã hết hạn mức tìm kiếm hôm nay. Vui lòng thử lại sau.' : 'Không tìm được trên YouTube. Kiểm tra cấu hình API hoặc thử lại sau.' }, { status: quota ? 429 : 502 });
    }
    const items = (data.items || []).filter(item => /^[\w-]{11}$/.test(item.id?.videoId) && item.snippet).map(item => ({
      id: item.id.videoId, title: item.snippet.title, channel: item.snippet.channelTitle,
      thumbnail: `https://i.ytimg.com/vi/${item.id.videoId}/mqdefault.jpg`,
    }));
    return Response.json({ items, nextPage: data.nextPageToken || '' }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
  } catch {
    return Response.json({ error: 'YouTube chưa phản hồi. Vui lòng thử lại.' }, { status: 502 });
  }
}
