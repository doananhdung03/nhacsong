import { test, expect } from '@playwright/test';

test('YouTube searches after typing, paginates and closes the embedded player', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() { window.testVoice = this; }
      stop() { this.onend?.(); }
      abort() {}
    };
  });
  await page.route('**/rest/v1/songs**', route => route.fulfill({ json: [] }));
  await page.route('https://www.youtube.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Player</p>' }));
  let calls = 0;
  await page.route('**/api/youtube/search?**', route => {
    calls++;
    return route.fulfill({ json: { items: [{ id: calls === 1 ? 'abcdefghijk' : 'lmnopqrstuv', title: `Karaoke ${calls}`, channel: 'Kênh thử', thumbnail: '' }], nextPage: calls === 1 ? 'page2' : '' } });
  });
  const violations = [];
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.cspViolations.push(event.blockedURI));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'YouTube Karaoke', exact: true }).click();
  await page.clock.install();
  await page.getByRole('searchbox').fill('Nàng');
  await page.clock.fastForward(200);
  await page.getByRole('searchbox').fill('Nàng thơ');
  await page.clock.fastForward(999);
  expect(calls).toBe(0);
  await page.clock.fastForward(1);
  await page.getByRole('button', { name: /Karaoke 1.*Chọn video/ }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://www.youtube.com/embed/abcdefghijk');
  await expect(page.frameLocator('iframe').getByText('Player', { exact: true })).toBeVisible();
  violations.push(...await page.evaluate(() => window.cspViolations));
  expect(violations.filter(url => /youtube\.com|ytimg\.com/.test(url))).toEqual([]);
  await page.getByRole('button', { name: 'Xem thêm video' }).click();
  await expect(page.locator('.youtube-result')).toHaveCount(2);
  await page.getByRole('button', { name: 'Đóng video' }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tìm bằng giọng nói', exact: true }).click();
  await page.evaluate(() => {
    window.testVoice.onresult({ results: [[{ transcript: 'Sóng gió.' }]] });
    window.testVoice.onend();
  });
  await expect(page.getByRole('searchbox')).toHaveValue('Sóng gió');
  await expect(page.getByRole('status').filter({ hasText: 'Karaoke cho' })).toContainText('Sóng gió');
  expect(calls).toBe(3);
  await page.getByRole('searchbox').fill('Từ khóa chưa gửi');
  await page.getByRole('button', { name: 'Xóa từ khóa' }).click();
  await page.clock.fastForward(1000);
  expect(calls).toBe(3);
  await page.getByRole('button', { name: 'Lời bài hát', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveAttribute('id', 'query');
});
