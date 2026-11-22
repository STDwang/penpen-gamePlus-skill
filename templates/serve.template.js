// penpen-gamePlus · 零依赖本地开发服务器模板
// 用法：node build.js && node tools/serve.js [port]
// / 与 /index.html 返回压缩版 dist/index.html；/dev 返回未压缩调试版 dist/dev.html 并触发开发者模式。
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = +process.argv[2] || +process.env.PORT || 3000;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (/(?:^|\/)dev\/?$/.test(p)) p = '/dist/dev.html';
  else if (p === '/' || p === '/index.html') p = '/dist/index.html';

  const f = path.join(root, path.normalize(p));
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (f !== root && !f.startsWith(rootPrefix)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(f, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end(p.startsWith('/dist/') ? 'Not built yet: run `node build.js`' : 'Not found');
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(f)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}).listen(port, '0.0.0.0', () => {
  console.log(`Game server running on http://0.0.0.0:${port}/ (dev: /dev)`);
});
