/**
 * Extract registrable-style host for metadata (not full URL path/query).
 */
export function domainFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname || '';
  } catch {
    return '';
  }
}
