import { test, expect } from '@playwright/test';

const song = { id: 1, trackName: 'Bài hát thử', artistName: 'Ca sĩ thử', albumName: 'Buổi diễn', duration: 200, plainLyrics: Array.from({length: 45}, (_, index) => `Dòng lời minh họa ${index + 1}`).join('\n'), syncedLyrics: null };
// Never touch the real Supabase catalog from tests: empty list, and inserts are swallowed.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/zing/**', route => route.fulfill({json: []}));
  await page.route('https://graph.nhaccuatui.com/**', route => route.fulfill({ json: { code: 0, data: { songs: [] } }, headers: {'access-control-allow-origin':'*'} }));
  await page.route('**/rest/v1/songs**', route => route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, json: [], headers: {'access-control-allow-origin':'*', 'access-control-allow-headers':'*', 'access-control-allow-methods':'*'} }));
});

test('Zing previews load before opening and reuse lyrics when opening and searching again', async ({page}) => {
  let lyricCalls=0;
  const zingSong={...song,id:3000000000001,zingId:'ZqfoKtrd1H7M',trackName:'Bài Zing thử',plainLyrics:null};
  await page.route('**/api/zing/search?**',route=>route.fulfill({json:[zingSong]}));
  await page.route('**/api/zing/lyrics?**',route=>{lyricCalls++;return route.fulfill({json:{plainLyrics:song.plainLyrics}});});
  await page.route('https://lrclib.net/api/search?**',route=>route.fulfill({json:[]}));
  await page.goto('/');await page.getByRole('searchbox').fill('Bài Zing');
  const result=page.getByRole('button',{name:/Bài Zing thử.*Zing MP3/});
  await expect(result.locator('.lyric-preview')).toContainText('Dòng lời minh họa 1');
  expect(lyricCalls).toBe(1);
  await page.getByRole('searchbox').fill('Bài Zing ');
  await expect(page.locator('#status')).toContainText('Đang nhập');
  await expect(result.locator('.lyric-preview')).toContainText('Dòng lời minh họa 1');
  expect(lyricCalls).toBe(1);
  await result.click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Thoát (Esc)'}).click();
  await expect(page.locator('.source-note')).toContainText('Zing MP3');
  await expect(page.locator('#lyrics')).toContainText('Dòng lời minh họa 1');
  await page.getByRole('button',{name:'♡ Lưu bài'}).click();await page.reload();
  await page.getByRole('button',{name:/Bài đã lưu/}).click();await result.click();
  await page.getByRole('button',{name:'Thoát (Esc)'}).click();
  await expect(page.locator('.source-note')).toContainText('Zing MP3');expect(lyricCalls).toBe(1);
});

test('Zing preview errors can retry on open and stale previews cannot overwrite a new query', async ({page}) => {
  const zingSong={...song,id:3000000000001,zingId:'ZqfoKtrd1H7M',trackName:'Bài Zing thử',plainLyrics:null};
  let fail=true, release;
  const pending=new Promise(resolve=>{release=resolve;});
  await page.route('https://lrclib.net/api/search?**',route=>route.fulfill({json:[]}));
  await page.route('**/api/zing/search?**',route=>route.fulfill({json:[zingSong]}));
  await page.route('**/api/zing/lyrics?**',async route=>{
    if(fail) return route.fulfill({status:502,json:{error:'Temporary error'}});
    await pending;return route.fulfill({json:{plainLyrics:song.plainLyrics}}).catch(()=>{});
  });
  await page.goto('/');await page.getByRole('searchbox').fill('Bài Zing');
  await expect(page.locator('.lyric-preview')).toContainText('Nhấn để thử lại');
  fail=false;
  await page.getByRole('searchbox').fill('Bài Zing mới');
  await expect(page.locator('.lyric-preview')).toContainText('Đang tải đoạn lời');
  await page.getByRole('button',{name:'Xóa từ khóa'}).click();release();
  await expect(page.locator('.result')).toHaveCount(0);
  await page.getByRole('searchbox').fill('Bài Zing');
  const result=page.getByRole('button',{name:/Bài Zing thử.*Zing MP3/});
  await expect(result.locator('.lyric-preview')).toContainText('Dòng lời minh họa');
});

test('Zing failure does not hide LRCLIB results',async({page})=>{
  await page.route('**/api/zing/search?**',route=>route.fulfill({status:502,json:{error:'Unavailable'}}));
  await page.goto('/');await searchSong(page);
  await expect(page.locator('#lyrics')).toContainText('Dòng lời minh họa');
});
test('voice search fills the box and searches with the final phrase', async ({ page }) => {
  // Fake Web Speech API: speaks an interim then a final result.
  await page.addInitScript(() => {
    window.webkitSpeechRecognition = class {
      start() { setTimeout(() => {
        const result = (text, isFinal) => Object.assign([{ transcript: text }], { isFinal });
        this.onresult({ results: [result('Bài hát', false)] });
        this.onresult({ results: [result('Bài hát thử.', true)] }); // recognisers add punctuation
        this.onend();
      }, 50); }
      stop() { this.onend(); } abort() {}
    };
  });
  await page.route('https://lrclib.net/api/search?**', route => route.fulfill({ json: [song], headers: {'access-control-allow-origin':'*'} }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Tìm bằng giọng nói' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('Bài hát thử');
  await expect(page.getByRole('button', { name: /Bài hát thử.*Ca sĩ thử/ })).toBeVisible();
});

async function searchSong(page, closePresentation = true) {
  await page.route('https://lrclib.net/api/search?**', route => route.fulfill({ json: [song], headers: {'access-control-allow-origin':'*'} }));
  await page.getByRole('searchbox').fill('Bài hát thử');
  await page.getByRole('button', { name: 'Tìm bài' }).click();
  await page.getByRole('button', { name: /Bài hát thử.*Ca sĩ thử/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  if (closePresentation) await page.getByRole('button', {name:'Thoát (Esc)'}).click();
}
test('search, read, save and restore after reload', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await searchSong(page);
  await expect(page.getByLabel('Nội dung lời bài hát')).toContainText('Dòng lời minh họa 1');
  await page.getByRole('button', { name: '♡ Lưu bài' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Bài đã lưu/ }).click();
  await page.getByRole('button', { name: /Bài hát thử.*Ca sĩ thử/ }).click();
  await page.getByRole('button', {name:'Thoát (Esc)'}).click();
  await expect(page.getByRole('button', { name: /Đã lưu · Bỏ lưu/ })).toBeVisible();
  expect(errors).toEqual([]);
});
test('click opens fullscreen with sections, light/dark theme and keyboard navigation', async ({ page }) => {
  await page.goto('/'); await searchSong(page, false);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expect(page.getByLabel('Trang trình chiếu')).toHaveText('1/13');
  await expect(dialog).toHaveAttribute('data-theme','light');
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Trang trình chiếu')).toHaveText('2/13');
  await expect(page.locator('#present-lyrics')).toHaveText('Dòng lời minh họa 1\nDòng lời minh họa 2\nDòng lời minh họa 3\nDòng lời minh họa 4');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByLabel('Trang trình chiếu')).toHaveText('3/13');
  await dialog.getByLabel('Nền tối').check();
  await expect(dialog).toHaveAttribute('data-theme','dark');
  await dialog.getByRole('button', {name:'Đoạn 1',exact:true}).click();
  await expect.poll(() => page.locator('#present-lyrics').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThan(40);
  await page.screenshot({path:'test-results/presentation-dark.png'});
  await dialog.getByLabel('Nền sáng').check();
  await page.screenshot({path:'test-results/presentation-light.png'});
  await dialog.getByLabel('Nền tối').check();
  await page.getByLabel('Lời trình chiếu', {exact:true}).focus();
  await page.keyboard.press('End');
  await expect(page.getByLabel('Trang trình chiếu')).toHaveText('13/13');
  await expect(dialog.getByRole('button', {name:'Đoạn tiếp',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await page.getByRole('button', { name: '⛶ Trình chiếu' }).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('data-theme','dark');
});

test('presentation works without browser fullscreen and fits mobile sections', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error('Not supported')); });
  await page.goto('/'); await searchSong(page, false);
  await page.getByRole('button', {name:'Đoạn 1',exact:true}).click();
  const stage = page.getByLabel('Lời trình chiếu', {exact:true});
  await expect(stage).toBeVisible();
  await expect.poll(() => page.locator('#present-lyrics').evaluate(node => node.scrollHeight <= node.parentElement.clientHeight && node.scrollWidth <= node.parentElement.clientWidth)).toBe(true);
  await page.getByRole('button', {name:'Toàn màn hình',exact:true}).click();
  await expect(page.locator('.slide-notice')).toContainText('Chưa bật được toàn màn hình');
  await page.screenshot({path:'test-results/presentation-mobile.png'});
  await page.getByRole('button', {name:'Thoát (Esc)'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
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
  await page.getByRole('button', {name:'Thoát (Esc)'}).click();
  await expect(page.getByLabel('Nội dung lời bài hát')).toContainText('Dòng lời minh họa 1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('live search starts at one character and debounces rapid typing', async ({ page }) => {
  const queries = [];
  await page.route('https://lrclib.net/api/search?**', route => {
    queries.push(new URL(route.request().url()).searchParams.get('q'));
    return route.fulfill({json: [song]});
  });
  await page.goto('/');
  const input = page.getByRole('searchbox');
  await input.fill('   '); await page.waitForTimeout(450);
  expect(queries).toEqual([]);
  await input.fill('a'); await expect(page.locator('#status')).toContainText('1 bản thu');
  expect(queries).toEqual(['a']);
  await input.fill('ab'); await input.fill('abc'); await input.fill('abcd');
  await expect(page.locator('#status')).toContainText('1 bản thu');
  expect(queries).toEqual(['a','abcd']);
  await input.fill(''); await page.waitForTimeout(450);
  await expect(page.locator('#status')).toContainText('Nhập từ 1 ký tự');
  await expect(page.locator('.result')).toHaveCount(0);
  expect(queries).toEqual(['a','abcd']);
});

test('submit cancels pending debounce and Vietnamese composition waits until finished', async ({ page }) => {
  const queries = [];
  await page.route('https://lrclib.net/api/search?**', route => {
    queries.push(new URL(route.request().url()).searchParams.get('q'));
    return route.fulfill({json: [song]});
  });
  await page.goto('/'); const input = page.getByRole('searchbox');
  await input.fill('Diem'); await input.press('Enter');
  await expect(page.locator('#status')).toContainText('1 bản thu');
  await page.waitForTimeout(450); expect(queries).toEqual(['Diem']);
  await input.dispatchEvent('compositionstart'); await input.fill('Diễm');
  await page.waitForTimeout(450); expect(queries).toEqual(['Diem']);
  await input.dispatchEvent('compositionend');
  await expect.poll(() => queries).toEqual(['Diem', 'Diễm']);
});

test('editing cancels in-flight request before the next debounce runs', async ({ page }) => {
  let releaseOld;
  const oldResponse = new Promise(resolve => { releaseOld = resolve; });
  await page.route('https://lrclib.net/api/search?**', async route => {
    if (new URL(route.request().url()).searchParams.get('q') === 'cu') {
      await oldResponse;
      await route.fulfill({json: [song]}).catch(() => {});
    } else await route.fulfill({json: []});
  });
  await page.goto('/'); const input = page.getByRole('searchbox');
  await input.fill('cu'); await expect(page.locator('#status')).toContainText('Đang tìm');
  await input.fill(''); releaseOld(); await page.waitForTimeout(450);
  await expect(page.locator('#status')).toContainText('Nhập từ 1 ký tự');
  await expect(page.locator('.result')).toHaveCount(0);
  await input.fill('moi'); await expect(page.locator('#status')).toContainText('Chưa tìm thấy');
});

test('simple search layout clears results and returns focus to the input', async ({ page }) => {
  const queries = [];
  await page.route('https://lrclib.net/api/search?**', route => {
    queries.push(new URL(route.request().url()).searchParams.get('q'));
    return route.fulfill({json: [song]});
  });
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'ÂM THANH NHẠC SỐNG HỒNG LÂM', exact:true})).toBeVisible();
  await expect(page.getByRole('region', {name:'Lời bài hát', exact:true})).toHaveCount(0);
  await page.getByRole('searchbox').fill('Bài');
  await expect(page.locator('.result')).toHaveCount(1);
  await expect(page.locator('.lyric-preview')).toContainText('Dòng lời minh họa');
  await page.screenshot({path:'test-results/simple-desktop.png', fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/simple-mobile.png', fullPage:true});
  await page.getByRole('button', {name:'Xóa từ khóa'}).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await expect(page.locator('.result')).toHaveCount(0);
  await page.waitForTimeout(450);
  expect(queries).toEqual(['Bài']);
});

test('search preserves typed spaces and prioritizes Vietnamese results', async ({ page }) => {
  const queries = [];
  await page.route('https://lrclib.net/api/search?**', route => {
    queries.push(new URL(route.request().url()).searchParams.get('q'));
    return route.fulfill({json:[{...song,id:10,trackName:'Foreign song',artistName:'Artist',plainLyrics:'A song in English'},song]});
  });
  await page.goto('/'); const input = page.getByRole('searchbox');
  await input.fill('Diễm ');
  await expect(page.locator('#status')).toContainText('2 bản thu');
  await expect(input).toHaveValue('Diễm ');
  await input.pressSequentially('xưa');
  await expect(page.locator('#status')).toContainText('2 bản thu cho “Diễm xưa”');
  await expect(input).toHaveValue('Diễm xưa');
  expect(queries).toEqual(['Diễm','Diễm xưa']);
  await expect(page.locator('.result strong').first()).toContainText('Bài hát thử');
  await input.fill('  Diễm   xưa  ');
  await expect.poll(()=>queries.length).toBe(3);
  expect(queries[2]).toBe('Diễm xưa');
  await expect(input).toHaveValue('  Diễm   xưa  ');
});
