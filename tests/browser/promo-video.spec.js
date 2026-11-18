import { test, expect } from '@playwright/test';

test('advert video requests fullscreen, plays the original local file, and unloads when closed', async ({ page }) => {
  await page.addInitScript(() => {
    window.promoFullscreenRequests = 0;
    Element.prototype.requestFullscreen = function () {
      window.promoFullscreenRequests++;
      return Promise.reject(new Error('Fullscreen unavailable in test'));
    };
  });
  await page.route('**/rest/v1/songs**', route => route.fulfill({ json: [] }));
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Phát video quảng cáo' });
  await expect(page.locator('.promo-dialog video')).toHaveCount(0);
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Video quảng cáo Hồng Lâm' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('video')).toHaveAttribute('src', '/video/gemini_generated_video_8991f96f.mp4');
  await expect.poll(() => dialog.locator('video').evaluate(video => !video.paused && video.videoWidth > 0)).toBe(true);
  expect(await page.evaluate(() => window.promoFullscreenRequests)).toBe(1);
  await expect(dialog.locator('video')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng video quảng cáo' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.promo-dialog video')).toHaveCount(0);
  await expect(button).toBeFocused();
  await button.click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.promo-dialog video')).toHaveCount(0);
});
