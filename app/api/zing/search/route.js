import { normalizeSearch, zingTrack } from '../../../../lib/lyrics.mjs';
import { zingRequest } from '../../../../lib/zing-server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET(request) {
  const query = normalizeSearch(new URL(request.url).searchParams.get('q') || '');
  if (!query || query.length > 150) return Response.json({ error: 'Từ khóa cần từ 1 đến 150 ký tự.' }, { status: 400 });
  try {
    const data = await zingRequest('/api/v2/search/multi', { q: query }, AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
    const tracks = (Array.isArray(data?.songs) ? data.songs : []).map(zingTrack).filter(Boolean);
    return Response.json(tracks, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch {
    return Response.json({ error: 'Zing MP3 tạm thời chưa phản hồi. Vui lòng thử lại.' }, { status: 502 });
  }
}
