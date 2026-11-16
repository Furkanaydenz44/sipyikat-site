// Copies the site into public/ for Cloudflare Workers static assets.
// sipyikat-web.html is the home page, so it is also served as index.html.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";

const out = "public";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

cpSync("sipyikat-web.html", `${out}/index.html`);
cpSync("sipyikat-web.html", `${out}/sipyikat-web.html`);
cpSync("blog.html", `${out}/blog.html`);

// Asset folders the pages link to (images, intro video and its captions).
for (const dir of ["img", "video"]) {
  if (existsSync(dir)) cpSync(dir, `${out}/${dir}`, { recursive: true });
}

console.log("Built public/ (pages + img/ + video/)");
