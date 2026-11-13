import test from 'node:test';
import assert from 'node:assert/strict';
import { accept, cleanTitle } from '../scripts/harvest-songs.mjs';

test('harvest cleans LRCLIB titles and rejects junk', () => {
  assert.equal(cleanTitle('01 Anh Sai Rồi - Son Tung M-TP.flac', 'Sơn Tùng M-TP'), 'Anh Sai Rồi');
  assert.equal(cleanTitle('Nắng Ấm Xa Dần - Sơn Tùng M-TP', 'Sơn Tùng M-TP'), 'Nắng Ấm Xa Dần');
  assert.equal(cleanTitle('NGÀY EM ĐI (Remastered)', 'Đan Nguyên'), 'Ngày Em Đi');
  assert.equal(cleanTitle('Hơn Cả Yêu ft. Ai Đó', 'Đức Phúc'), 'Hơn Cả Yêu');
  assert.equal(accept('Nếu một ngày', 'Đan Nguyên', 1, 'Đan Nguyên').key, 'neu mot ngay|dan nguyen');
  assert.equal(accept('Ngay Em Di', 'Đan Nguyên', 1, 'Đan Nguyên'), null); // no Vietnamese marks
  assert.equal(accept('Nếu một ngày', 'Đan Nguyên', 0, 'Đan Nguyên'), null); // no lyrics
  assert.equal(accept('SƠN TÙNG M-TP | ĐỪNG LÀM TRÁI TIM ANH ĐAU | OFFICIAL MUSIC VIDEO', 'Sơn Tùng M-TP', 1, 'Sơn Tùng M-TP'), null);
  assert.equal(accept('Loi Nguyen Cau Tinh Yeu', 'Đan Trường', 1, 'Đan Nguyên'), null); // other artist
});

test('preview picks the same artist, skips instrumental and caps length', async () => {
  const { pickPreview } = await import('../scripts/fetch-previews.mjs');
  const long = 'Dòng   lời\n'.repeat(40);
  const rows = [
    { id: 1, trackName: 'Nàng Thơ', artistName: 'Ca sĩ khác', plainLyrics: 'Sai bài' },
    { id: 2, trackName: 'Nàng Thơ', artistName: 'Hoàng Dũng', instrumental: true },
    { id: 3, trackName: 'Nàng Thơ', artistName: 'Hoàng Dũng', plainLyrics: long },
  ];
  const preview = pickPreview(rows, { title: 'Nàng Thơ', artist: 'Hoàng Dũng' });
  assert.ok(preview.startsWith('Dòng lời Dòng lời'));
  assert.equal(preview.length, 180);
  assert.equal(pickPreview(rows.slice(0, 1), { title: 'Nàng Thơ', artist: 'Hoàng Dũng' }), '');
});
