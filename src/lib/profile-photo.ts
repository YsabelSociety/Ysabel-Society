// Only provider image hosts are eligible for the authenticated photo proxy.
export function providerPhotoURL(value: unknown) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') &&
      ['fbcdn.net','fbsbx.com','cdninstagram.com'].some(h=>u.hostname === h || u.hostname.endsWith('.'+h)) ? u.href : '';
  } catch { return ''; }
}
