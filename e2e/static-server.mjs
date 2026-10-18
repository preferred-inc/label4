// GitHub Pages（https://preferred-inc.github.io/label4/）と同じく、リポジトリ直下を /label4/ 配下で配信する e2e 専用サーバー。
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4174);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".bcmap": "application/octet-stream",
};

async function resolve(urlPath) {
  const path = decodeURIComponent(urlPath.split("?")[0]);
  if (!path.startsWith("/label4/") && path !== "/label4") return null;
  const rel = normalize(path.slice("/label4".length) || "/").replace(/^(\.\.[/\\])+/, "");
  for (const p of [join(root, rel), join(root, rel, "index.html")]) {
    try {
      if ((await stat(p)).isFile()) return p;
    } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolve(req.url || "/");
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  res.end(await readFile(file));
}).listen(port, "127.0.0.1", () => console.log(`serving on http://127.0.0.1:${port}/label4/`));
