// Builds supabase/seed-songs.sql from LRCLIB: for each artist in vn-artists.txt, search LRCLIB,
// keep clean Vietnamese titles that have lyrics, dedupe, and emit an idempotent insert.
// Usage: node scripts/harvest-songs.mjs <cache.json> [maxArtists]
// The cache lets an interrupted run resume without re-querying LRCLIB.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { catalogSong, fold, vietnameseScore } from '../lib/lyrics.mjs';

const UA = 'HongLamLyrics/1.0 (song catalog seeding; https://github.com/doananhdung03/nhacsong)';
// LRCLIB returns at most 20 rows per query, so saturated artists get extra keyword queries.
const WORDS = ['anh', 'em', 'yêu', 'tình', 'người', 'nhớ', 'mưa', 'buồn', 'đêm', 'ngày', 'không', 'mùa'];
const [cachePath = 'harvest-cache.json', maxArtists = 'Infinity'] = process.argv.slice(2);
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let fresh = 0;

async function search(params) {
  const qs = new URLSearchParams(params).toString();
  if (cache[qs]) return cache[qs];
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`https://lrclib.net/api/v2/search?${qs}`, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (response && (response.status === 429 || response.status === 503)) {
      const wait = (Number(response.headers.get('retry-after')) || 30) * 1000 * (1 + Math.random() * 0.3);
      console.error(`rate limited, waiting ${Math.round(wait / 1000)}s`); await sleep(wait); continue;
    }
    // Transient network/5xx errors: back off and retry, then skip this one query rather than abort the whole run.
    if (!response || response.status >= 500) {
      if (attempt < 4) { console.error(`${response?.status ?? 'network error'} for ${qs}, retry ${attempt}`); await sleep(5000 * attempt); continue; }
      console.error(`skipping ${qs}`); return [];
    }
    if (!response.ok) throw new Error(`${response.status} for ${qs}`);
    const rows = await response.json();
    cache[qs] = Array.isArray(rows) ? rows.map(row => [row.trackName, row.artistName, row.hasPlainLyrics || row.hasSyncedLyrics ? 1 : 0]) : [];
    if (++fresh % 25 === 0) writeFileSync(cachePath, JSON.stringify(cache));
    await sleep(700); // ~85 requests/min, under the identified-client allowance
    return cache[qs];
  }
}

const junk = /\||official|music video|\bm\/?v\b|lyric|karaoke|\bkara\b|\.(flac|mp3|m4a|wav)\b|\bcover\b|remix|\bbeat\b|instrumental|\blive\b|acoustic|version|\bver\b|tiktok|\bfull\b|#|https?:|\.com|\bep\b|album/i;
const titleCase = text => text.toLocaleLowerCase('vi').replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toLocaleUpperCase('vi'));

export function cleanTitle(title, artist) {
  let text = title.normalize('NFC').replace(/[([【][^)\]】]*[)\]】]/g, ' ').replace(/^\s*\d{1,3}[\s.\-_]+/, '').replace(/\s+(ft|feat)\.?\s.*$/i, '');
  const parts = text.split(/\s+[-–—]\s+/);
  if (parts.length > 1) text = parts.find(part => !fold(part).includes(fold(artist))) || parts[0];
  text = text.replace(/\s+/g, ' ').trim();
  return text === text.toLocaleUpperCase('vi') ? titleCase(text) : text;
}

export function accept(rawTitle, rawArtist, hasLyrics, artist) {
  if (!hasLyrics || junk.test(rawTitle) || !fold(rawArtist).includes(fold(artist))) return null;
  const title = cleanTitle(rawTitle, artist);
  if (title.length < 2 || title.length > 80 || junk.test(title)) return null;
  if (vietnameseScore({ trackName: title, artistName: '', plainLyrics: '' }) < 3) return null; // title must carry Vietnamese marks
  const song = catalogSong(title, artist);
  return song.initials ? song : null;
}

async function main() {
  const artists = [...new Map(readFileSync(new URL('vn-artists.txt', import.meta.url), 'utf8').split(/\r?\n/)
    .map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(name => [fold(name), name])).values()].slice(0, Number(maxArtists));
  const songs = new Map();
  for (const [index, artist] of artists.entries()) {
    const rows = [...await search({ q: artist })];
    if (rows.length >= 20) for (const word of WORDS) rows.push(...await search({ track_name: word, artist_name: artist }));
    let added = 0;
    for (const [title, rowArtist, hasLyrics] of rows) {
      const song = accept(title, rowArtist, hasLyrics, artist);
      if (song && !songs.has(song.key)) { songs.set(song.key, song); added++; }
    }
    console.error(`${index + 1}/${artists.length} ${artist}: +${added} (total ${songs.size})`);
  }
  writeFileSync(cachePath, JSON.stringify(cache));
  const quote = text => `'${text.replace(/'/g, "''")}'`;
  const rows = [...songs.values()].map(song => `(${[song.title, song.artist, song.initials, song.folded, song.key].map(quote).join(', ')})`);
  const batches = [];
  for (let index = 0; index < rows.length; index += 500) batches.push(`insert into public.songs (title, artist, initials, folded, key) values\n${rows.slice(index, index + 500).join(',\n')}\non conflict (key) do nothing;`);
  writeFileSync(new URL('../supabase/seed-songs.sql', import.meta.url), `-- ${rows.length} Vietnamese songs harvested from LRCLIB by scripts/harvest-songs.mjs. Safe to re-run.\n${batches.join('\n\n')}\n`);
  console.error(`wrote ${rows.length} songs to supabase/seed-songs.sql`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
