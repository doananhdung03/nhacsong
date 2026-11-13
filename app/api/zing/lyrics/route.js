import { zingLyricText } from '../../../../lib/lyrics.mjs';
import { zingRequest } from '../../../../lib/zing-server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[A-Za-z0-9]{6,20}$/.test(id)) return Response.json({ error: 'Mã bài hát không hợp lệ.' }, { status: 400 });
  try {
    const data = await zingRequest('/api/v2/lyric/get/lyric', { id }, AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
    const plainLyrics = zingLyricText(data);
    if (!plainLyrics) return Response.json({ error: 'Chưa có lời cho bài hát này trên Zing MP3.' }, { status: 404 });
    return Response.json({ plainLyrics }, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
  } catch {
    return Response.json({ error: 'Zing MP3 tạm thời chưa phản hồi. Vui lòng thử lại.' }, { status: 502 });
  }
}
