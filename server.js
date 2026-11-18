/*
  2027 El Reno Spring Classic - tiny static file server
  No dependencies. Works on Render as a Web Service.
  Render sets the PORT environment variable. Default is 10000.
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    return send(res, 400, 'Bad request');
  }

  if (urlPath === '/') urlPath = '/index.html';

  // Resolve inside ROOT only. Blocks path traversal.
  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'Forbidden');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Serve a friendly 404 that points back to the schedule.
      const notFound = '<!doctype html><html><head><meta charset="utf-8">'
        + '<title>Page not found</title>'
        + '<style>body{font-family:Segoe UI,Arial,sans-serif;background:#0e0d19;color:#eae8f5;'
        + 'display:grid;place-items:center;height:100vh;margin:0;text-align:center}'
        + 'a{color:#a49df5}</style></head><body><div>'
        + '<h1>Page not found</h1>'
        + '<p><a href="/">Go to the schedule</a></p>'
        + '</div></body></html>';
      return send(res, 404, notFound, 'text/html; charset=utf-8');
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('El Reno Spring Classic site running on port ' + PORT);
});
