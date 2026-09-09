// Online-only workspace: never persist reports, messages, sessions or API responses.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode !== 'navigate' || url.origin !== self.location.origin || !url.pathname.startsWith('/marketingdata/')) return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ysabel Society</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#fff;color:#1d3428;font:16px system-ui"><main style="text-align:center;padding:32px"><h1>Ysabel Society</h1><p>Connect to the internet to open your marketing data.</p><a style="color:inherit" href="/marketingdata/">Try again</a></main></body></html>',
    {status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}
  )));
});
