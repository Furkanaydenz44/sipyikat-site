// Serves the static site from public/ (ASSETS binding).
// Only /video/* requests reach this code (see run_worker_first in wrangler.jsonc):
// Workers static assets ignore the Range header, but Safari/iOS will not play an
// MP4 unless the server answers Range requests with 206 Partial Content.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const range = request.headers.get("Range");

    if (!url.pathname.startsWith("/video/") || request.method !== "GET" || !range) {
      const res = await env.ASSETS.fetch(request);
      if (!url.pathname.startsWith("/video/") || !res.ok) return res;
      const out = new Response(res.body, res);
      out.headers.set("Accept-Ranges", "bytes");
      return out;
    }

    const asset = await env.ASSETS.fetch(new Request(url, { method: "GET" }));
    if (!asset.ok || !asset.body) return asset;

    const baseHeaders = new Headers(asset.headers);
    baseHeaders.set("Accept-Ranges", "bytes");

    // Edge cache keyed by ETag, so a new video upload never serves stale bytes.
    // (The Cache API is a no-op on workers.dev; there we just slice every time.)
    const etag = asset.headers.get("ETag") || "";
    const cacheKey = new Request(`${url.origin}${url.pathname}?v=${encodeURIComponent(etag)}`);
    const cache = caches.default;

    const hit = await cache.match(new Request(cacheKey, { headers: { Range: range } }));
    if (hit) {
      asset.body.cancel();
      const out = new Response(hit.body, hit);
      out.headers.set("Cache-Control", baseHeaders.get("Cache-Control") || "public, max-age=0, must-revalidate");
      return out;
    }

    const buf = await asset.arrayBuffer();
    const cacheHeaders = new Headers(baseHeaders);
    cacheHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
    ctx.waitUntil(cache.put(cacheKey, new Response(buf, { headers: cacheHeaders })));

    return sliceRange(buf, range, baseHeaders);
  },
};

function sliceRange(buf, rangeHeader, headers) {
  const size = buf.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());

  // Multi-range or malformed: answer with the whole file.
  if (!m || (m[1] === "" && m[2] === "")) {
    return new Response(buf, { status: 200, headers });
  }

  let start, end;
  if (m[1] === "") {
    // bytes=-N : last N bytes
    const n = Number(m[2]);
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }

  if (start >= size || start > end) {
    const h = new Headers(headers);
    h.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers: h });
  }

  const h = new Headers(headers);
  h.set("Content-Range", `bytes ${start}-${end}/${size}`);
  h.set("Content-Length", String(end - start + 1));
  return new Response(buf.slice(start, end + 1), { status: 206, headers: h });
}
