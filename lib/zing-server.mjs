import { createHash, createHmac } from 'node:crypto';

// Public web-client signing parameters, compatible with shin202/zingmp3-api-next (ISC).
// https://github.com/shin202/zingmp3-api-next/blob/main/src/index.ts
const WEB_API_KEY = "88265e23d4284f25963e6eedac8fbfa3";
const WEB_SIGNING_KEY = "2aa2d1c561e809b267f3638c4a307aab";
const VERSION = '1.6.40';

let cookieRequest, cookieExpires = 0;
async function webCookie(signal) {
  if (!cookieRequest || Date.now() >= cookieExpires) {
    cookieExpires = Date.now() + 10 * 60 * 1000;
    cookieRequest = fetch('https://zingmp3.vn/', { signal: AbortSignal.timeout(5000), cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('Zing MP3 chưa phản hồi.');
        return response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
      }).catch(error => { cookieRequest = undefined; throw error; });
  }
  signal.throwIfAborted();
  return cookieRequest;
}

export async function zingRequest(path, params, signal) {
  const ctime = String(Math.floor(Date.now() / 1000));
  const signed = { ctime, ...params.id && { id: params.id }, version: VERSION };
  const digest = createHash('sha256').update(Object.keys(signed).sort().map(key => `${key}=${signed[key]}`).join('')).digest('hex');
  const sig = createHmac('sha512', WEB_SIGNING_KEY).update(path + digest).digest('hex');
  const url = new URL(path, 'https://zingmp3.vn');
  url.search = new URLSearchParams({ ...params, ctime, version: VERSION, sig, apiKey: WEB_API_KEY });
  const cookie = await webCookie(signal);
  const response = await fetch(url, { signal, cache: 'no-store', headers: { Cookie: cookie } });
  if (!response.ok) throw new Error('Zing MP3 chưa phản hồi.');
  const body = await response.json();
  if (body?.err !== 0) throw new Error('Zing MP3 tạm thời không cung cấp dữ liệu.');
  return body.data;
}
