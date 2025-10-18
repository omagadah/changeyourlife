export default async function handler(req, res) {
  try {
    const target = req.query.target || req.query.url;
    if (!target) return res.status(400).send('missing target');

    // Basic allowlist: only allow v0.app domain for now
    const url = new URL(target);
    const host = url.hostname;
    const allowed = ['v0.app'];
    if (!allowed.includes(host)) {
      return res.status(403).send('host not allowed');
    }

    // Fetch remote HTML
    const resp = await fetch(target, { headers: { 'User-Agent': 'changeyourlife-proxy/1.0' } });
    let html = await resp.text();

    // Remove any <meta http-equiv="Content-Security-Policy" ...> to avoid the remote CSP blocking embedding
    html = html.replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');

    // Inject a <base> tag so relative URLs resolve against the remote origin
    const baseTag = `<base href="${url.origin}/">`;
    html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);

    // Rewrite <script src="/..."> or link href relative paths could be left as-is (base handles it)

    // Return sanitized HTML and clear restrictive response headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Remove framing restrictions on our response
    res.setHeader('X-Frame-Options', '');
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval'; img-src * data:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; frame-ancestors *;");

    return res.status(200).send(html);
  } catch (err) {
    console.error('proxy error', err);
    res.status(500).send('proxy error');
  }
}
