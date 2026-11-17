import { test, expect } from '@playwright/test';

test('admin signs in with password, reports bad credentials, and can set a new password', async ({ page }) => {
  const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', email_confirmed_at: '2026-01-01', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {} };
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url'), 'mock-signature'].join('.');
  let attempts = 0, passwordUpdates = 0;
  await page.route('**/auth/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
    if (url.pathname.endsWith('/token')) {
      expect(url.searchParams.get('grant_type')).toBe('password');
      const body = request.postDataJSON();
      expect(body.email).toBe('admin@example.com');
      attempts++;
      if (body.password !== 'test-correct-password') return route.fulfill({ status: 400, headers, json: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } });
      return route.fulfill({ headers, json: { access_token: jwt, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user } });
    }
    if (url.pathname.endsWith('/user') && request.method() === 'PUT') {
      expect(request.postDataJSON().password).toBe('test-new-password');
      passwordUpdates++;
    }
    return route.fulfill({ headers, json: user });
  });
  await page.route('**/rest/v1/songs**', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: [] }));
  await page.route('**/api/admin/youtube', route => route.fulfill({ json: { configured: true, keys: [] } }));
  await page.goto('/admin');
  await page.getByLabel('Email quản trị').fill('admin@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Email hoặc mật khẩu không đúng');
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toHaveCount(0);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('test-correct-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
  expect(attempts).toBe(2);
  await page.getByText('Đặt / đổi mật khẩu đăng nhập', { exact: true }).click();
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('test-new-password');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('different-password');
  await page.getByRole('button', { name: 'Lưu mật khẩu' }).click();
  await expect(page.locator('#status')).toContainText('không khớp');
  expect(passwordUpdates).toBe(0);
  await page.getByLabel('Nhập lại mật khẩu mới').fill('test-new-password');
  await page.getByRole('button', { name: 'Lưu mật khẩu' }).click();
  await expect(page.locator('#status')).toContainText('Đã lưu mật khẩu mới');
  expect(passwordUpdates).toBe(1);
});
