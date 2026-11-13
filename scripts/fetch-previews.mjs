// Builds supabase/seed-previews.sql: for every catalog song, fetch its lyrics from LRCLIB once
// and store only a short preview (lyricPreview) so search results can show it without extra calls.
// Usage: node --env-file=.env.local scripts/fetch-previews.mjs <cache.json>
// The cache lets an interrupted run resume without re-querying LRCLIB.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fold, lyricPreview, plainText, rankTracks, validTrack } from '../lib/lyrics.mjs';
import { loadSongs } from '../lib/songs-db.mjs';

const UA = 'HongLamLyrics/1.0 (song catalog previews; https://github.com/doananhdung03/nhacsong)';
const [cachePath = 'previews-cache.json'] = process.argv.slice(2);
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}; // song key -> preview | ''
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function lrclib(params) {
  const qs = new URLSearchParams(params).toString();
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`https://lrclib.net/api/search?${qs}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (response && (response.status === 429 || response.status === 503)) {
      const wait = (Number(response.headers.get('retry-after')) || 30) * 1000 * (1 + Math.random() * 0.3);
      console.error(`rate limited, waiting ${Math.round(wait / 1000)}s`); await sleep(wait); continue;
    }
    if (!response || response.status >= 500) {
      if (attempt < 4) { await sleep(5000 * attempt); continue; }
      return null; // give up on this song for now; a rerun retries it
    }
    if (!response.ok) return null;
    const rows = await response.json();
    return Array.isArray(rows) ? rows.filter(validTrack) : [];
  }
}

// Preview from the best LRCLIB match by the same artist; '' when LRCLIB has no usable lyrics.
export function pickPreview(rows, song) {
  const artist = fold(song.artist);
  // Filter before ranking: rankTracks dedupes same title|artist and could keep an instrumental copy.
  const [track] = rankTracks(rows.filter(item => !item.instrumental && fold(item.artistName).includes(artist) && plainText(item)), song.title);
  return track ? lyricPreview(plainText(track)) : '';
}

async function main() {
  const songs = await loadSongs('title,artist,initials,folded,key'); // works before preview.sql has run
  let done = 0;
  for (const song of songs) {
    done++;
    if (song.key in cache) continue;
    const rows = await lrclib({ track_name: song.title, artist_name: song.artist });
    await sleep(700); // ~85 requests/min, under the identified-client allowance
    if (rows === null) continue;
    cache[song.key] = pickPreview(rows, song);
    if (done % 25 === 0 || done < 4) { writeFileSync(cachePath, JSON.stringify(cache)); console.error(`${done}/${songs.length}`); }
  }
  writeFileSync(cachePath, JSON.stringify(cache));
  const quote = text => `'${text.replace(/'/g, "''")}'`;
  const rows = Object.entries(cache).filter(([, preview]) => preview).map(([key, preview]) => `(${quote(key)}, ${quote(preview)})`);
  const batches = [];
  for (let index = 0; index < rows.length; index += 500) batches.push(`update public.songs set preview = v.preview from (values\n${rows.slice(index, index + 500).join(',\n')}\n) as v(key, preview) where songs.key = v.key and songs.preview is null;`);
  writeFileSync(new URL('../supabase/seed-previews.sql', import.meta.url), `-- ${rows.length} lyric previews from LRCLIB (scripts/fetch-previews.mjs). Safe to re-run; never overwrites an existing preview.\nalter table public.songs add column if not exists preview text check (char_length(preview) <= 200);\n\n${batches.join('\n\n')}\n`);
  console.error(`wrote ${rows.length} previews (${songs.length - rows.length} songs without usable lyrics or not yet fetched)`);
}

if (process.argv[1]?.endsWith('fetch-previews.mjs')) await main();
