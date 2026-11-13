// Supabase REST (PostgREST) via fetch; table schema in supabase/songs.sql.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const headers = { apikey: key, 'Content-Type': 'application/json' };
const isString = (value, max) => typeof value === 'string' && value.length <= max;
const validSong = song => song && isString(song.title, 200) && isString(song.artist, 200) && isString(song.initials, 100) && isString(song.folded, 200) && isString(song.key, 401);

export const songsEnabled = Boolean(url && key);

export async function loadSongs() {
  if (!songsEnabled) return [];
  const songs = [], page = 1000; // Supabase caps rows per request at 1000 by default
  for (let from = 0; ; from += page) {
    const response = await fetch(`${url}/rest/v1/songs?select=title,artist,initials,folded,key&order=id`, { headers: { ...headers, Range: `${from}-${from + page - 1}` } });
    if (!response.ok) throw new Error(`Supabase ${response.status}`);
    const rows = await response.json();
    songs.push(...(Array.isArray(rows) ? rows.filter(validSong) : []));
    if (!Array.isArray(rows) || rows.length < page) return songs;
  }
}

export async function addSong(song) {
  if (!songsEnabled) return;
  // Duplicate key returns 409, which is fine: the song is already in the list.
  const response = await fetch(`${url}/rest/v1/songs`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(song) });
  if (!response.ok && response.status !== 409) throw new Error(`Supabase ${response.status}`);
}
