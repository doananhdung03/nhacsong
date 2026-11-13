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
  const words = [catalogSong('Khoảnh Khắc', 'Đông Hùng'), catalogSong('Anh Khác Hay Em Khác', 'Khắc Việt'), catalogSong('Em Của Ngày Hôm Qua', 'Sơn Tùng')];
  assert.deepEqual(searchCatalog(words, 'anh khác').map(s=>s.title), ['Anh Khác Hay Em Khác']); // no mid-word match
  assert.deepEqual(searchCatalog(words, 'hôm qua').map(s=>s.title), ['Em Của Ngày Hôm Qua']); // word inside title still matches
});

test('NhacCuaTui rows map to stable non-colliding ids and clean lyrics', async () => {
  const { nctTrack, isNct, cleanNctLyrics } = await import('../lib/lyrics.mjs');
  const row = { key: 'Kx3Kbih0rS5z', name: 'Nàng Thơ', artistName: 'Hoàng Dũng', duration: 254 };
  const track = nctTrack(row);
  assert.ok(isNct(track)); assert.ok(validTrack(track)); assert.ok(track.id > 1e12);
  assert.equal(nctTrack(row).id, track.id); // stable across searches, so saved songs stay selected
  assert.notEqual(nctTrack({ ...row, key: 'GTEtM6oYgUpG' }).id, track.id);
  assert.equal(track.nctKey, 'Kx3Kbih0rS5z');
  assert.equal(nctTrack({ ...row, key: '../x' }), null);
  assert.equal(nctTrack({ key: 'Kx3Kbih0rS5z', name: 'A' }), null);
  assert.equal(cleanNctLyrics('Dòng 1<br>Dòng 2<br/><b>Dòng 3</b>\r\n'), 'Dòng 1\nDòng 2\nDòng 3');
  assert.equal(cleanNctLyrics('Bài hát: Hoa Nở Không Màu - Hoài Lâm\nSáng tác: Nguyễn Minh Cường\n\nChỉ là nỗi nhớ\nLời: vẫn là lời hát'), 'Chỉ là nỗi nhớ\nLời: vẫn là lời hát');
});

test('same title + same lyrics collapse into one result listing the other singers', async () => {
  const { collapseSameLyrics } = await import('../lib/lyrics.mjs');
  const lyric = 'Sao không ôm anh như lần đầu tiên em đến';
  const rows = [
    { t: 'Ngày mai em đi', a: 'Hồ Ngọc Hà', l: lyric }, { t: 'Ngày Mai Em Đi', a: 'Soobin Hoàng Sơn', l: lyric },
    { t: 'Ngày mai em đi', a: 'Lê Hiếu', l: lyric + '  ' }, { t: 'Ngày Mai Em Đi Mất', a: 'Đạt G', l: lyric },
    { t: 'Ngày mai em đi', a: 'Ca sĩ khác', l: 'Lời hoàn toàn khác' }, { t: 'Ngày mai em đi', a: 'Không lời', l: '' },
  ];
  const seen = new Map();
  const kept = collapseSameLyrics(rows, r => r.t, r => r.a, r => r.l, seen);
  assert.deepEqual(kept.map(k => k.item.a), ['Hồ Ngọc Hà', 'Đạt G', 'Ca sĩ khác', 'Không lời']);
  assert.deepEqual(kept[0].others, ['Soobin Hoàng Sơn', 'Lê Hiếu']);
  // a later group (e.g. LRCLIB) sharing the map folds into the earlier one
  assert.equal(collapseSameLyrics([{ t: 'NGÀY MAI EM ĐI', a: 'Ngọc Hạ', l: lyric }], r => r.t, r => r.a, r => r.l, seen).length, 0);
  assert.deepEqual(kept[0].others, ['Soobin Hoàng Sơn', 'Lê Hiếu', 'Ngọc Hạ']);
});

test('splitArtists separates co-singers but keeps dashed names', async () => {
  const { splitArtists } = await import('../lib/lyrics.mjs');
  assert.deepEqual(splitArtists('Thu Phương, Huyền Baby, Trang Pháp'), ['Thu Phương', 'Huyền Baby', 'Trang Pháp']);
  assert.deepEqual(splitArtists('Lê Hiếu feat. SOOBIN & Touliver'), ['Lê Hiếu', 'SOOBIN', 'Touliver']);
  assert.deepEqual(splitArtists('Lê Hiếu/Soobin Hoàng Sơn; Touliver'), ['Lê Hiếu', 'Soobin Hoàng Sơn', 'Touliver']);
  assert.deepEqual(splitArtists('Masew x Khoi Vu ft. Đạt G'), ['Masew', 'Khoi Vu', 'Đạt G']);
  assert.deepEqual(splitArtists('Jack - J97'), ['Jack - J97']);
  assert.deepEqual(splitArtists('Xuân Mai'), ['Xuân Mai']);
});

test('same-lyrics merge counts each extra singer once, ignoring accents and the row own singers', async () => {
  const { collapseSameLyrics } = await import('../lib/lyrics.mjs');
  const l = 'Chỉ là nỗi nhớ mãi đứng sau cuộc tình đã lỡ';
  const rows = [{ a: 'Quang Hà', l }, { a: 'Quang Ha', l }, { a: 'Hoài Lâm, Quang Hà', l }, { a: 'ThienHi', l }, { a: 'Hoai Lam', l }];
  const [kept] = collapseSameLyrics(rows, () => 'Hoa Nở Không Màu', r => r.a, r => r.l);
  assert.deepEqual(kept.others, ['Hoài Lâm', 'ThienHi']);
});
