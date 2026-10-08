/**
 * GitHub Pages serves a plain static tree with no rewrite rules, so any URL
 * that is not a real file returns 404. Copying the built index.html to
 * 404.html makes Pages hand the app back instead, which keeps refreshes and
 * shared deep links working. Harmless on hosts that do have rewrites.
 */
import { copyFileSync, existsSync } from "node:fs";

const from = "dist/index.html";
const to = "dist/404.html";

if (!existsSync(from)) {
  console.error("spa-fallback: dist/index.html not found — did the build run?");
  process.exit(1);
}

copyFileSync(from, to);
console.log("spa-fallback: wrote dist/404.html");
