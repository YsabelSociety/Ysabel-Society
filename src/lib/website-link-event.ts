// Keep contact information, query parameters and fragments out of click events.
// Outbound links and file downloads remain covered by GA4 enhanced measurement.
export function internalLinkEvent(href: string, currentUrl: string) {
  try {
    const page = new URL(currentUrl), target = new URL(href, page);
    if (!/^https?:$/.test(target.protocol) || target.origin !== page.origin ||
        (target.pathname === page.pathname && target.search === page.search)) return null;
    return { link_url: target.origin + target.pathname, link_domain: target.hostname, outbound: false };
  } catch { return null; }
}
