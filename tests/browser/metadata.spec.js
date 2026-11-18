import { test, expect } from '@playwright/test';

test('deployment metadata and brand assets are served correctly', async ({ request }) => {
  const home = await request.get('/');
  const html = await home.text();
  expect(home.ok()).toBe(true);
  expect(html).toContain('name="description"');
  expect(html).toContain('property="og:image"');
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  expect(new URL(html.match(/rel="canonical" href="([^"]+)"/)[1]).href).toBe('https://nhacsong.vercel.app/');
  expect(html).toContain('rel="apple-touch-icon"');
  expect(html).toContain('application/ld+json');
  const admin = await request.get('/admin');
  expect(await admin.text()).toContain('noindex, nofollow');
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /admin');
  const sitemap = await request.get('/sitemap.xml');
  expect(await sitemap.text()).toContain('<loc>https://nhacsong.vercel.app/</loc>');
  expect(await sitemap.text()).not.toContain('/admin');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.lang).toBe('vi');
  for (const path of ['/favicon.ico', '/icon.svg', '/apple-icon.png', '/social-card.png', ...manifest.icons.map(icon => icon.src)]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    expect(response.headers()['content-type'], path).toMatch(/image\//);
    expect((await response.body()).length, path).toBeGreaterThan(100);
  }
});
