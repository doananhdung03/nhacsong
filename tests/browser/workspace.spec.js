import { test, expect } from '@playwright/test';

const song = { id: 1, trackName: 'Bài hát thử', artistName: 'Ca sĩ thử', albumName: 'Buổi diễn', duration: 200, plainLyrics: Array.from({length: 45}, (_, index) => `Dòng lời minh họa ${index + 1}`).join('\n'), syncedLyrics: null };
async function searchSong(page) {
  await page.route('https://lrclib.net/api/search?**', route => route.fulfill({ json: [song], headers: {'access-control-allow-origin':'*'} }));
  await page.getByRole('searchbox').fill('Bài hát thử');
  await page.getByRole('button', { name: 'Tìm bài' }).click();
  await page.getByRole('button', { name: /Bài hát thử.*Ca sĩ thử/ }).click();
}
test('search, read, save and restore after reload', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await searchSong(page);
  await expect(page.getByLabel('Nội dung lời bài hát')).toContainText('Dòng lời minh họa 1');
  await page.getByRole('button', { name: '♡ Lưu bài' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Bài đã lưu/ }).click();
  await page.getByRole('button', { name: /Bài hát thử.*Ca sĩ thử/ }).click();
  await expect(page.getByRole('button', { name: /Đã lưu · Bỏ lưu/ })).toBeVisible();
  expect(errors).toEqual([]);
});
test('presentation scroll, keyboard close and reopen', async ({ page }) => {
  await page.goto('/'); await searchSong(page);
  await page.getByRole('button', { name: '⛶ Trình chiếu' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Space');
  await expect(dialog.getByRole('button', { name: 'Ⅱ Dừng cuộn' })).toHaveAttribute('aria-pressed','true');
  await expect.poll(() => page.getByLabel('Lời trình chiếu', {exact:true}).evaluate(node => node.scrollTop)).toBeGreaterThan(5);
  await page.keyboard.press('ArrowDown');
  await expect(dialog.getByRole('button', { name: '▷ Tự cuộn' })).toHaveAttribute('aria-pressed','false');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: '⛶ Trình chiếu' }).click(); await expect(page.getByRole('dialog')).toBeVisible();
});
test('empty results and rate limit allow searching again', async ({ page }) => {
  let limited = true;
  await page.route('https://lrclib.net/api/search?**', route => route.fulfill({ status: limited ? 429 : 200, json: [], headers: {'access-control-allow-origin':'*'} }));
  await page.goto('/'); await page.getByRole('searchbox').fill('Không tìm thấy');
  await page.getByRole('button', { name: 'Tìm bài' }).click();
  await expect(page.locator('#status')).toContainText('giới hạn lượt tìm');
  limited = false; await page.getByRole('button', { name: 'Tìm bài' }).click();
  await expect(page.locator('#status')).toContainText('Chưa tìm thấy');
});
test('old saved songs survive migration, mobile page has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(data => localStorage.setItem('loi.saved.v1', JSON.stringify([data])), song);
  await page.goto('/'); await page.getByRole('button', { name: /Bài đã lưu/ }).click();
  await page.getByRole('button', { name: /Bài hát thử.*Ca sĩ thử/ }).click();
  await expect(page.getByLabel('Nội dung lời bài hát')).toContainText('Dòng lời minh họa 1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
