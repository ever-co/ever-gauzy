/**
 * Minimal static file server for the built gauzy web app, used by the Playwright e2e CI.
 *
 * Why not the Angular dev server? `nx serve gauzy` (webpack dev server, watch + HMR) grows its
 * heap over time and OOMs during a long e2e run. Serving a one-time production-of-`local` build
 * statically is stable and lightweight. The app uses hash routing (`/#/...`) and an absolute API
 * URL (http://localhost:3000), so no SPA-proxy is needed — `/` always returns index.html.
 *
 * Usage: node tools/serve-web.js [root=dist/apps/gauzy] [port=4200]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || 'dist/apps/gauzy');
const port = Number(process.argv[3] || 4200);

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.eot': 'application/vnd.ms-fontobject',
	'.map': 'application/json',
	'.txt': 'text/plain; charset=utf-8',
	'.wasm': 'application/wasm'
};

const indexHtml = path.join(root, 'index.html');

function sendIndex(res) {
	fs.readFile(indexHtml, (err, data) => {
		if (err) {
			res.writeHead(500);
			res.end('index.html not found in ' + root);
			return;
		}
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
		res.end(data);
	});
}

const server = http.createServer((req, res) => {
	let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
	if (urlPath === '/' || urlPath === '') {
		sendIndex(res);
		return;
	}
	const filePath = path.join(root, urlPath);
	// Block path traversal; fall back to index.html for anything outside root.
	if (!filePath.startsWith(root)) {
		sendIndex(res);
		return;
	}
	fs.readFile(filePath, (err, data) => {
		if (err) {
			// Unknown path -> SPA fallback (hash routing rarely needs it, but harmless).
			sendIndex(res);
			return;
		}
		const ext = path.extname(filePath).toLowerCase();
		res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
		res.end(data);
	});
});

server.listen(port, '0.0.0.0', () => {
	console.log(`[serve-web] serving ${root} at http://localhost:${port}`);
});
