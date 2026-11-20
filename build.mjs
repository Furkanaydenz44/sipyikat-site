// Copies the site into public/ for Cloudflare Workers static assets.
// sipyikat-web.html is the home page, so it is also served as index.html.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";

const out = "public";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

cpSync("sipyikat-web.html", `${out}/index.html`);
cpSync("sipyikat-web.html", `${out}/sipyikat-web.html`);
cpSync("blog.html", `${out}/blog.html`);

// Asset folders the pages link to (images, icons, intro video and its captions).
for (const dir of ["img", "video"]) {
  if (existsSync(dir)) cpSync(dir, `${out}/${dir}`, { recursive: true });
}

// Root-level web files: favicon, apple-touch-icon, web manifest, robots.txt, sitemap.xml...
const rootExts = [".ico", ".png", ".svg", ".webp", ".jpg", ".webmanifest", ".txt", ".xml"];
const rootFiles = readdirSync(".").filter(
  (f) => statSync(f).isFile() && rootExts.some((ext) => f.toLowerCase().endsWith(ext)),
);
for (const f of rootFiles) cpSync(f, `${out}/${f}`);

console.log(`Built public/ (pages + img/ + video/ + ${rootFiles.join(", ") || "no root files"})`);
