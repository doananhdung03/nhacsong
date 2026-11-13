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
