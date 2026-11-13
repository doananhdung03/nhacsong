export function plainText(track) {
  if (track.instrumental) return 'Bản nhạc không lời.';
  if (track.plainLyrics?.trim()) return track.plainLyrics.trim();
  return (track.syncedLyrics || '').replace(/^[ \t]*(?:\[\d+:\d+(?:\.\d+)?\])+[ \t]*/gm, '').replace(/^\[(?:ar|al|ti|by|offset|length):[^\]]*\][ \t]*$/gm, '').trim();
}
// One-line lyric snippet for result rows and the Supabase `preview` column (max 200 chars there).
export function lyricPreview(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 180);
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
