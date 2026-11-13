import test from 'node:test';
import assert from 'node:assert/strict';
import { plainText, durationLabel, validTrack } from '../public/lyrics.mjs';
test('LRC fallback removes multiple timestamps and metadata, preserves Vietnamese and stanza breaks', () => {
  assert.equal(plainText({syncedLyrics:'[ar:Ca sĩ]\n[00:01.20][00:20.500] Dòng một\n\n[01:02]Dòng hai'}), 'Dòng một\n\nDòng hai');
  assert.equal(plainText({plainLyrics:' Lời gốc ',syncedLyrics:'[00:01]Khác'}), 'Lời gốc');
  assert.equal(plainText({instrumental:true}), 'Bản nhạc không lời.');
});
test('validates untrusted persisted/API data', () => {
  assert.equal(validTrack({id:12,trackName:'Bài',artistName:'Ca sĩ',plainLyrics:'Lời'}),true);
  assert.ok(!validTrack(null));
  assert.ok(!validTrack({id:12,trackName:'Bài',artistName:'Ca sĩ',plainLyrics:{bad:1}}));
});
test('duration rounds before calculating minutes', () => {
  assert.equal(durationLabel(119.8),'2:00');
  assert.equal(durationLabel(null),'');
});
