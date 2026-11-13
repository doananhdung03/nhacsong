// Supabase REST (PostgREST) via fetch; table schema in supabase/songs.sql.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const headers = { apikey: key, 'Content-Type': 'application/json' };
const isString = (value, max) => typeof value === 'string' && value.length <= max;
const validSong = song => song && isString(song.title, 200) && isString(song.artist, 200) && isString(song.initials, 100) && isString(song.folded, 200) && isString(song.key, 401) && (song.preview == null || isString(song.preview, 200));

export const songsEnabled = Boolean(url && key);

export async function loadSongs(columns = 'title,artist,initials,folded,key,preview') {
  if (!songsEnabled) return [];
  const songs = [], page = 1000; // Supabase caps rows per request at 1000 by default
  for (let from = 0; ; from += page) {
    const response = await fetch(`${url}/rest/v1/songs?select=${columns}&order=id`, { headers: { ...headers, Range: `${from}-${from + page - 1}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Supabase ${response.status}`);
    const rows = await response.json();
    songs.push(...(Array.isArray(rows) ? rows.filter(validSong) : []));
    if (!Array.isArray(rows) || rows.length < page) return songs;
  }
}

// Hand-entered lyrics from /admin, or null so the caller falls back to LRCLIB.
export async function songLyrics(key) {
  if (!songsEnabled) return null;
  const response = await fetch(`${url}/rest/v1/songs?select=id,lyrics&key=eq.${encodeURIComponent(key)}`, { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok) return null;
  const [row] = await response.json();
  return row && Number.isSafeInteger(row.id) && typeof row.lyrics === 'string' && row.lyrics.trim() ? row : null;
}

// Fill a missing preview; the `preview=is.null` filter plus RLS (supabase/preview-fill.sql) never overwrite one.
export async function fillPreview(key, preview) {
  if (!songsEnabled) return;
  const response = await fetch(`${url}/rest/v1/songs?key=eq.${encodeURIComponent(key)}&preview=is.null`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ preview }) });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
}

export async function addSong(song) {
  if (!songsEnabled) return;
  // Duplicate key returns 409, which is fine: the song is already in the list.
  const response = await fetch(`${url}/rest/v1/songs`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(song) });
  if (!response.ok && response.status !== 409) throw new Error(`Supabase ${response.status}`);
}
