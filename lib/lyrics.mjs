export function plainText(track) {
  if (track.instrumental) return 'Bản nhạc không lời.';
  if (track.plainLyrics?.trim()) return track.plainLyrics.trim();
  return (track.syncedLyrics || '').replace(/^[ \t]*(?:\[\d+:\d+(?:\.\d+)?\])+[ \t]*/gm, '').replace(/^\[(?:ar|al|ti|by|offset|length):[^\]]*\][ \t]*$/gm, '').trim();
}
// One-line lyric snippet for result rows and the Supabase `preview` column (max 200 chars there).
export function lyricPreview(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 180);
}
// NhacCuaTui search rows as tracks. NCT keys are strings, so derive a stable numeric id above every LRCLIB id.
// shortcut: 31-hash mod 1e9 can collide in theory; switch to storing nctKey as the identity if saved songs ever clash.
export const NCT_ID_BASE = 2e12;
export const ZING_ID_BASE = 3e12;
export const isNct = track => track.id >= NCT_ID_BASE && track.id < ZING_ID_BASE;
export const isZing = track => track.id >= ZING_ID_BASE;
export function zingTrack(item) {
  if (!item || typeof item.encodeId !== 'string' || !/^[A-Za-z0-9]{6,20}$/.test(item.encodeId) || typeof item.title !== 'string' || typeof item.artistsNames !== 'string') return null;
  let hash = 0;
  for (const char of item.encodeId) hash = (hash * 31 + char.charCodeAt(0)) % 1e9;
  return { id: ZING_ID_BASE + hash, zingId: item.encodeId, trackName: item.title, artistName: item.artistsNames,
    albumName: typeof item.album?.title === 'string' ? item.album.title : null,
    duration: Number.isFinite(item.duration) && item.duration >= 0 ? item.duration : null };
}
export function zingLyricText(data) {
  if (!Array.isArray(data?.sentences)) return '';
  return data.sentences.map(sentence => Array.isArray(sentence?.words)
    ? sentence.words.filter(word => typeof word?.data === 'string').map(word => word.data).join(' ').trim() : '').filter(Boolean).join('\n');
}
export function nctTrack(item) {
  if (!item || typeof item.key !== 'string' || !/^[A-Za-z0-9]{6,20}$/.test(item.key) || typeof item.name !== 'string' || typeof item.artistName !== 'string') return null;
  let hash = 0;
  for (const char of item.key) hash = (hash * 31 + char.charCodeAt(0)) % 1e9;
  return { id: NCT_ID_BASE + hash, nctKey: item.key, trackName: item.name, artistName: item.artistName,
    albumName: typeof item.album?.name === 'string' ? item.album.name : null, duration: Number.isFinite(item.duration) && item.duration >= 0 ? item.duration : null };
}
export function cleanNctLyrics(text) {
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\r\n?/g, '\n').trim()
    // Uploaders often open with credit lines ("Bài hát: X - Y", "Ca sĩ: …"); they are not sung, so drop them.
    .replace(/^(?:(?:bài hát|ca sĩ|trình bày|sáng tác|nhạc sĩ|tác giả|nhạc|lời|album)\s*:[^\n]*\n+)+/iu, '').trim();
}

export function validTrack(track) {
  return track && Number.isSafeInteger(track.id) && typeof track.trackName === 'string' && typeof track.artistName === 'string' &&
    (track.plainLyrics == null || typeof track.plainLyrics === 'string') &&
    (track.syncedLyrics == null || typeof track.syncedLyrics === 'string') &&
    (track.albumName == null || typeof track.albumName === 'string') &&
    (track.instrumental == null || typeof track.instrumental === 'boolean') &&
    (track.duration == null || (Number.isFinite(track.duration) && track.duration >= 0));
}
export function durationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export function normalizeSearch(text) {
  return text.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

const fold = text => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase();
const lower = text => normalizeSearch(text).toLowerCase();
export { fold };
export const songKey = (title, artist) => `${fold(lower(title))}|${fold(lower(artist))}`;

function titleMatch(title, query) {
  if (!query) return 0;
  if (title === query) return 4;
  if (title.startsWith(query)) return 3;
  const words = title.split(/[^\p{L}\p{N}]+/u);
  if (query.split(' ').every(word => words.includes(word))) return 2;
  return title.includes(query) ? 1 : 0;
}

// API has no language field; these text signals prioritize likely Vietnamese songs without excluding others.
const vietnameseMarks = /[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉọỏốồổỗộớờởỡợụủứừửữựỳỷỹỵ]/iu;
const commonWords = ['anh', 'em', 'toi', 'yeu', 'khong', 'nguoi', 'nhung', 'mot', 'duoc', 'trong', 'long', 'tinh'];
export function vietnameseScore(track, text = plainText(track)) {
  const lyrics = text.normalize('NFC');
  const words = new Set(fold(lyrics).match(/[a-z]+/g) || []);
  return (vietnameseMarks.test(track.trackName.normalize('NFC')) ? 3 : 0)
    + (vietnameseMarks.test(track.artistName.normalize('NFC')) ? 1 : 0)
    + (vietnameseMarks.test(lyrics) ? 5 : 0)
    + (commonWords.filter(word => words.has(word)).length >= 3 ? 5 : 0);
}

export function rankTracks(tracks, query = '') {
  const q = lower(query), fq = fold(q);
  // Exact (accented) title match beats accent-insensitive match, which beats Vietnamese signals: "À lôi" ranks above "...lời...".
  const match = track => { const title = lower(track.trackName); return Math.max(titleMatch(title, q) * 2, titleMatch(fold(title), fq) * 2 - 1); };
  const seen = new Set();
  return tracks.map((track, index) => { const text = plainText(track); return { track, index, match: match(track), score: vietnameseScore(track, text) + (text ? 1 : 0) }; })
    .sort((a, b) => b.match - a.match || b.score - a.score || a.index - b.index)
    .filter(({ track }) => { const key = songKey(track.trackName, track.artistName); return !seen.has(key) && seen.add(key); })
    .map(item => item.track);
}

// Catalog row for Supabase `songs`: initials/folded are computed here so DB needs no unaccent extension.
export function catalogSong(title, artist) {
  title = normalizeSearch(title); artist = normalizeSearch(artist);
  const folded = fold(title);
  return { title, artist, folded, initials: (folded.match(/[a-z0-9]+/g) || []).map(word => word[0]).join(''), key: songKey(title, artist) };
}

export function searchCatalog(songs, query, limit = 30) {
  const q = fold(lower(query)), compact = q.replace(/ /g, '');
  if (!q) return [];
  const score = song => song.initials === compact ? 4 : song.initials.startsWith(compact) ? 3
    // Contains-matches must start at a word, so "anh khac" does not hit "khoanh khac". key holds the folded artist.
    : song.folded.startsWith(q) ? 2 : ` ${song.folded}`.includes(` ${q}`) || ` ${song.key.slice(song.key.indexOf('|') + 1)}`.includes(` ${q}`) ? 1 : 0;
  return songs.map(song => ({ song, score: score(song) })).filter(item => item.score)
    .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title, 'vi')).slice(0, limit).map(item => item.song);
}

// Collapse results that share title and lyrics (one song sung by several singers): keeps the first item of each
// group in order and returns it with `others`, the other singers' names. Items without lyrics are never merged.
export function collapseSameLyrics(items, title, artist, lyrics, seen = new Map()) {
  const kept = [];
  for (const item of items) {
    const text = lyrics(item);
    const key = text && `${fold(lower(title(item)))}|${fold(lyricPreview(text)).slice(0, 80)}`;
    const first = key && seen.get(key);
    if (first) {
      // Count each extra singer once, ignoring accents/case ("Quang Ha" = "Quang Hà") and the kept row's own singers.
      for (const name of splitArtists(artist(item))) {
        const id = fold(lower(name));
        if (!first.known.has(id)) { first.known.add(id); first.others.push(name); }
      }
      continue;
    }
    const entry = { item, others: [], known: new Set(splitArtists(artist(item)).map(name => fold(lower(name)))) };
    if (key) seen.set(key, entry);
    kept.push(entry);
  }
  return kept;
}

// "A, B & C feat. D" -> ["A", "B", "C", "D"]; names with a dash such as "Jack - J97" stay whole.
export function splitArtists(name) {
  return name.split(/\s*(?:,|;|\/|&|\bfeat\.?(?=\s)|\bft\.?(?=\s)|\bx\b)\s*/iu).map(part => part.trim()).filter(Boolean);
}

export function lyricSections(text) {
  const sections = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').trim().split(/\n[ \t]*\n+/)) {
    const lines = [];
    for (const line of paragraph.split('\n')) {
      let row = '';
      for (const word of line.trim().split(/\s+/).filter(Boolean)) {
        if (row && row.length + word.length + 1 > 75) { lines.push(row); row = ''; }
        row += (row ? ' ' : '') + word;
      }
      if (row) lines.push(row);
    }
    for (let index = 0; index < lines.length; index += 4) sections.push(lines.slice(index, index + 4).join('\n'));
  }
  return sections;
}
