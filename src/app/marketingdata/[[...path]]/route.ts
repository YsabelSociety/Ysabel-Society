// The website serves the complete dashboard through this route. Its existing
// Worker owns encrypted connections, storage and authentication. A server route
// is used because Netlify's ordinary proxy redirects time out after 26 seconds.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const upstreamOrigin = "https://ysabel-society-intelligence.arberhalili1.chatgpt.site";
const forwardedHeaders = ["accept", "accept-language", "content-type", "origin", "user-agent", "range", "if-range", "rsc", "next-router-state-tree", "next-router-prefetch", "next-url"];

async function proxy(request: Request) {
  const incoming = new URL(request.url);
  if (incoming.pathname !== "/marketingdata" && !incoming.pathname.startsWith("/marketingdata/")) return new Response(null, { status: 404 });
  const upstream = new URL(upstreamOrigin);
  upstream.pathname = incoming.pathname;
  upstream.search = incoming.search;
  const headers = new Headers();
  for (const key of forwardedHeaders) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  const cookies = (request.headers.get("cookie") || "").split(";").map(v => v.trim()).filter(v => /^(ys_marketing_session|ys_oauth_(google|meta|tiktok))=/.test(v));
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  try {
    const result = await fetch(upstream, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      duplex: "half",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    } as RequestInit);
    const responseHeaders = new Headers(result.headers);
    for (const name of ["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive", "alt-svc"]) responseHeaders.delete(name);
    responseHeaders.set("Cache-Control", "private, no-store");
    responseHeaders.set("X-Robots-Tag", "noindex, nofollow");
    const location = responseHeaders.get("location");
    if (location) {
      const redirect = new URL(location, upstream);
      if (redirect.origin === upstreamOrigin && (redirect.pathname === "/marketingdata" || redirect.pathname.startsWith("/marketingdata/"))) responseHeaders.set("location", redirect.pathname + redirect.search + redirect.hash);
    }
    return new Response(result.body, { status: result.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: "This refresh is taking longer than expected. Reopen the connection status before trying again; an import may still be finishing." }, { status: 504, headers: { "Cache-Control": "private, no-store" } });
  }
}
export { proxy as GET, proxy as HEAD, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS };
