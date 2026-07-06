const fs = require('fs');
const http = require('http');
const path = require('path');

const port = Number(process.argv[2] || 8080);
const root = path.join(__dirname, '..', 'build', 'host-upload');
const websiteAssets = path.join(__dirname, '..', '..', 'digitxllinkfinal', 'assets', 'signature');
const publicBase = 'https://thedigitxllink.com/assets/signature';
const localBase = `http://localhost:${port}/assets/signature`;

const types = {
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function resolveSafePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  const fullPath = path.normalize(path.join(root, cleanPath || 'signature-local.html'));
  return fullPath.startsWith(root) ? fullPath : null;
}

function resolveWebsiteAsset(urlPath) {
  if (!urlPath.startsWith('/assets/signature/')) return null;
  const rel = urlPath.slice('/assets/signature/'.length);
  const fullPath = path.normalize(path.join(websiteAssets, rel));
  return fullPath.startsWith(websiteAssets) ? fullPath : null;
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  if (urlPath === '/' || urlPath === '/signature-local.html') {
    send(res, 200, fs.readFileSync(path.join(root, 'signature-local-hq.html'), 'utf8'), types['.html']);
    return;
  }

  if (urlPath === '/signature-email-safe.html') {
    const html = fs.readFileSync(path.join(root, 'signature.html'), 'utf8')
      .split(publicBase)
      .join(localBase);
    send(res, 200, html, types['.html']);
    return;
  }

  const assetPath = resolveWebsiteAsset(urlPath);
  if (assetPath && fs.existsSync(assetPath) && !fs.statSync(assetPath).isDirectory()) {
    const ext = path.extname(assetPath).toLowerCase();
    send(res, 200, fs.readFileSync(assetPath), types[ext] || 'application/octet-stream');
    return;
  }

  const fullPath = resolveSafePath(urlPath);
  if (!fullPath || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    send(res, 404, 'Not found');
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  send(res, 200, fs.readFileSync(fullPath), types[ext] || 'application/octet-stream');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local signature server: http://localhost:${port}/signature-local.html`);
  console.log(`Email-safe preview:     http://localhost:${port}/signature-email-safe.html`);
});
