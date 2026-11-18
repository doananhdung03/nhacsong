import { site, indexable } from '../lib/site.mjs';

export default function sitemap() {
  return indexable ? [{ url: site.url.href }] : [];
}
