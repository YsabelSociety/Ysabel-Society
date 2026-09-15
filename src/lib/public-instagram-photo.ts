import { providerPhotoURL } from '@/lib/profile-photo';

function decode(value: string) {
  return value.replace(/&#(x[0-9a-f]+|\d+);|&(amp|quot|apos|lt|gt);/gi, (match, code, name) => {
    if (code) { const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
    return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'} as Record<string,string>)[name.toLowerCase()] || match;
  });
}

// Public metadata only; never follow login redirects or use a visitor's cookies.
export function publicProfilePhoto(html: string, username: string) {
  const tags = [...html.matchAll(/<(?:meta|link)\b[^>]*>/gi)].map(([tag]) => {
    const attrs: Record<string,string> = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) attrs[m[1].toLowerCase()] = decode(m[3]);
    return attrs;
  });
  const canonical = tags.find(t => t.rel === 'canonical')?.href;
  const title = tags.find(t => t.property === 'og:title')?.content || '';
  try {
    const url = new URL(canonical || '');
    if (url.origin !== 'https://www.instagram.com' || url.pathname.toLowerCase() !== `/${username.toLowerCase()}/` || !title.toLowerCase().includes(`@${username.toLowerCase()})`)) return '';
  } catch { return ''; }
  return providerPhotoURL(tags.find(t => t.property === 'og:image')?.content);
}

export async function fetchPublicInstagramPhoto(username: string, timeoutMs = 5000) {
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) return '';
  try {
    const response = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      redirect:'manual', headers:{Accept:'text/html'}, signal:AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) return '';
    const reader = response.body?.getReader(); if (!reader) return '';
    const decoder = new TextDecoder(); let html = '', size = 0;
    try {
      while (size < 512000) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.length; if (size > 512000) break;
        html += decoder.decode(part.value, {stream:true});
        const photo = publicProfilePhoto(html, username); if (photo) return photo;
        if (html.includes('</head>')) break;
      }
    } finally { await reader.cancel().catch(() => {}); }
    return publicProfilePhoto(html, username);
  } catch { return ''; }
}
