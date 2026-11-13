import test from 'node:test';
import assert from 'node:assert/strict';
import { plainText, durationLabel, validTrack, lyricSections, normalizeSearch, rankTracks, catalogSong, searchCatalog } from '../lib/lyrics.mjs';
test('LRC fallback removes multiple timestamps and metadata, preserves Vietnamese and stanza breaks', () => {
  assert.equal(plainText({syncedLyrics:'[ar:Ca sĩ]\n[00:01.20][00:20.500] Dòng một\n\n[01:02]Dòng hai'}), 'Dòng một\n\nDòng hai');
  assert.equal(plainText({plainLyrics:' Lời gốc ',syncedLyrics:'[00:01]Khác'}), 'Lời gốc');
  assert.equal(plainText({instrumental:true}), 'Bản nhạc không lời.');
});
test('validates untrusted persisted/API data', () => {
  assert.equal(validTrack({id:12,trackName:'Bài',artistName:'Ca sĩ',plainLyrics:'Lời'}),true);
  assert.ok(!validTrack(null));
  assert.ok(!validTrack({id:12,trackName:'Bài',artistName:'Ca sĩ',plainLyrics:{bad:1}}));
  assert.ok(!validTrack({id:12,trackName:'Bài',artistName:'Ca sĩ',albumName:{bad:1}}));
  assert.ok(!validTrack({id:12,trackName:'Bài',artistName:'Ca sĩ',duration:'200'}));
});
test('duration rounds before calculating minutes', () => {
  assert.equal(durationLabel(119.8),'2:00');
  assert.equal(durationLabel(null),'');
});

test('sections preserve stanzas and split continuous lyrics without losing words', () => {
  assert.deepEqual(lyricSections('Dòng một\r\nDòng hai\r\n\r\nDòng ba'), ['Dòng một\nDòng hai','Dòng ba']);
  assert.deepEqual(lyricSections('1\n2\n3\n4\n5'), ['1\n2\n3\n4','5']);
  const longText = Array.from({length:200}, (_, i) => `từ${i}`).join(' ');
  assert.equal(lyricSections(longText).join(' ').replace(/\s+/g,' '), longText);
  assert.deepEqual(lyricSections('  \n '), []);
});

test('search normalizes whitespace and Vietnamese combining marks for requests', () => {
  assert.equal(normalizeSearch('  Diễm\t  xưa  '), 'Diễm xưa');
  assert.equal(normalizeSearch('a'), 'a');
  assert.equal(normalizeSearch(' \n\t '), '');
  assert.equal(normalizeSearch('Diễm'.normalize('NFD')), 'Diễm');
});

test('Vietnamese priority keeps all results and preserves ordering for equal scores', () => {
  const foreign = {id:1,trackName:'Love',artistName:'Artist',plainLyrics:'I love you forever'};
  const vietnamese = {id:2,trackName:'Người yêu',artistName:'Ca sĩ',plainLyrics:'Anh yêu em trong lòng'};
  const noAccents = {id:3,trackName:'Tinh yeu',artistName:'Singer',plainLyrics:'Anh yeu em trong long'};
  const secondForeign = {...foreign,id:4,trackName:'Another song'};
  const input = [foreign, vietnamese, noAccents, secondForeign];
  assert.deepEqual(rankTracks(input).map(track=>track.id), [2,3,1,4]);
  assert.deepEqual(input.map(track=>track.id),[1,2,3,4]);
});

test('ranking puts exact title first, matches without accents, and removes duplicates', () => {
  const loi = {id:1,trackName:'Lời Tạm Biệt',artistName:'Ca sĩ',plainLyrics:'Anh yêu em trong lòng'};
  const aLoi = {id:2,trackName:'À Lôi',artistName:'Double2T',plainLyrics:'Lời'};
  const aLoiCopy = {id:3,trackName:'à lôi',artistName:'double2t'};
  const other = {id:4,trackName:'A Loi Remix',artistName:'DJ',plainLyrics:'x'};
  assert.deepEqual(rankTracks([loi, other, aLoiCopy, aLoi], 'À lôi').map(t=>t.id), [2,4,1]);
  assert.deepEqual(rankTracks([loi, other, aLoi], 'a loi').map(t=>t.id), [2,4,1]);
});

test('catalog matches initials and unaccented titles like "AL" -> À Lôi', () => {
  const songs = [catalogSong('À Lôi', 'Double2T'), catalogSong('Áo Lụa Hà Đông', 'Ngô Thụy Miên'), catalogSong('Diễm Xưa', 'Trịnh Công Sơn'), catalogSong('Đi Để Trở Về', 'Soobin')];
  assert.deepEqual(songs[0], { title:'À Lôi', artist:'Double2T', folded:'a loi', initials:'al', key:'a loi|double2t' });
  assert.deepEqual(searchCatalog(songs, 'AL').map(s=>s.title), ['À Lôi', 'Áo Lụa Hà Đông']);
  assert.deepEqual(searchCatalog(songs, 'diem').map(s=>s.title), ['Diễm Xưa']);
  assert.deepEqual(searchCatalog(songs, 'đi để').map(s=>s.title), ['Đi Để Trở Về']);
  assert.deepEqual(searchCatalog(songs, 'trinh').map(s=>s.title), ['Diễm Xưa']);
  assert.deepEqual(searchCatalog(songs, '  '), []);
});
