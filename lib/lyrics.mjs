export function plainText(track) {
  if (track.instrumental) return 'Bản nhạc không lời.';
  if (track.plainLyrics?.trim()) return track.plainLyrics.trim();
  return (track.syncedLyrics || '').replace(/^[ \t]*(?:\[\d+:\d+(?:\.\d+)?\])+[ \t]*/gm, '').replace(/^\[(?:ar|al|ti|by|offset|length):[^\]]*\][ \t]*$/gm, '').trim();
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

export function prioritizeVietnamese(tracks) {
  // API has no language field; these text signals prioritize likely Vietnamese songs without excluding others.
  const vietnameseMarks = /[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉọỏốồổỗộớờởỡợụủứừửữựỳỷỹỵ]/iu;
  function score(track) {
    const lyrics = plainText(track).normalize('NFC');
    const words = new Set(lyrics.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').match(/[a-z]+/g) || []);
    const commonWords = ['anh', 'em', 'toi', 'yeu', 'khong', 'nguoi', 'nhung', 'mot', 'duoc', 'trong', 'long', 'tinh'];
    return (vietnameseMarks.test(track.trackName.normalize('NFC')) ? 3 : 0)
      + (vietnameseMarks.test(track.artistName.normalize('NFC')) ? 1 : 0)
      + (vietnameseMarks.test(lyrics) ? 5 : 0)
      + (commonWords.filter(word => words.has(word)).length >= 3 ? 5 : 0);
  }
  return tracks.map((track, index) => ({ track, index, score: score(track) }))
    .sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.track);
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
