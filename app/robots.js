import { site, indexable } from '../lib/site.mjs';

export default function robots() {
  return {
    rules: { userAgent: '*', ...(indexable ? { allow: '/', disallow: ['/admin', '/api/'] } : { disallow: '/' }) },
    ...(indexable ? { sitemap: new URL('/sitemap.xml', site.url).href, host: site.url.origin } : {}),
  };
}
