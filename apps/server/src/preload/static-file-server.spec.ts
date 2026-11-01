/**
 * @jest-environment node
 */
import * as fs from 'node:fs';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { createStaticFileHandler, StaticFileHandlerOptions } from './static-file-server';

interface Reply {
	status: number;
	headers: http.IncomingHttpHeaders;
	body: string;
}

/** Sends the path exactly as given (Node's client does not normalise `..` or percent-escapes). */
function send(port: number, rawPath: string, method = 'GET'): Promise<Reply> {
	return new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port, path: rawPath, method, agent: false }, (res) => {
			let body = '';
			res.setEncoding('utf8');
			res.on('data', (chunk: string) => (body += chunk));
			res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
		});
		req.on('error', reject);
		req.end();
	});
}

/** Starts the UI server's handler for `root` on a free loopback port. */
async function listen(
	root: string,
	options?: StaticFileHandlerOptions
): Promise<{ server: http.Server; port: number }> {
	const server = http.createServer(createStaticFileHandler(root, options));
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
	return { server, port: (server.address() as AddressInfo).port };
}

const close = (server: http.Server) => new Promise<void>((resolve) => server.close(() => resolve()));

/**
 * The UI server of the Gauzy Server desktop app (it listens on `0.0.0.0` when the server is shared on the LAN).
 * node-static 0.7.11 crashed on `GET /%00` and served `/../ui<x>/…` from a sibling `ui*` directory; serve-static must
 * refuse both and otherwise answer as node-static did.
 */
describe('createStaticFileHandler (Gauzy Server UI)', () => {
	let base: string;
	let root: string;
	let server: http.Server;
	let port: number;

	beforeAll(async () => {
		base = fs.mkdtempSync(path.join(os.tmpdir(), 'gauzy-ui-server-'));
		root = path.join(base, 'ui');
		fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
		fs.writeFileSync(path.join(root, 'index.html'), '<html>gauzy ui</html>');
		fs.writeFileSync(path.join(root, 'main.js'), 'console.log("ui");');
		fs.writeFileSync(path.join(root, 'assets', 'index.html'), '<html>assets</html>');
		// A sibling whose name starts with the root's name: node-static's prefix check let it through.
		fs.mkdirSync(path.join(base, 'ui-secret'));
		fs.writeFileSync(path.join(base, 'ui-secret', 'secret.txt'), 'top secret');

		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		({ server, port } = await listen(root));
	});

	afterAll(async () => {
		await close(server);
		fs.rmSync(base, { recursive: true, force: true });
		jest.restoreAllMocks();
	});

	const request = (rawPath: string) => send(port, rawPath);

	it('serves index.html for the root and the UI files with a one-hour cache', async () => {
		const index = await request('/');
		expect(index.status).toBe(200);
		expect(index.body).toBe('<html>gauzy ui</html>');

		const script = await request('/main.js');
		expect(script.status).toBe(200);
		expect(script.body).toBe('console.log("ui");');
		expect(script.headers['cache-control']).toContain('max-age=3600');
	});

	it('redirects a directory asked without its trailing slash, then serves its index.html', async () => {
		const redirect = await request('/assets');
		expect(redirect.status).toBe(301);
		expect(redirect.headers.location).toBe('/assets/');

		const index = await request('/assets/');
		expect(index.status).toBe(200);
		expect(index.body).toBe('<html>assets</html>');
	});

	it('answers 404 for a missing file, without a stack trace or the directory on disk', async () => {
		const reply = await request('/missing.js');
		expect(reply.status).toBe(404);
		expect(reply.body).not.toContain(base);
		expect(reply.body).not.toMatch(/\bat \S+ \(/);
	});

	it('answers 400 to a NUL byte and keeps serving (node-static crashed on GET /%00)', async () => {
		expect((await request('/%00')).status).toBe(400);
		expect((await request('/index.html%00.js')).status).toBe(400);
		expect((await request('/')).status).toBe(200);
	});

	it.each([
		'/../ui-secret/secret.txt',
		'/%2e%2e/ui-secret/secret.txt',
		'/..%2fui-secret%2fsecret.txt',
		'/..%5cui-secret%5csecret.txt',
		'/assets/../../ui-secret/secret.txt'
	])('never serves a file outside the UI directory: %s', async (rawPath) => {
		const reply = await request(rawPath);
		expect(reply.status).toBe(403);
		expect(reply.body).not.toContain('top secret');
	});
});

/**
 * Gauzy Server points its web UI at the API with a script in index.html. Writing that script into the install
 * directory failed the setup where the directory is read-only (a .deb under /opt, an AppImage: #7735), so the UI server
 * inserts the script it is given as it serves the start page, and leaves the file as it is.
 */
describe('createStaticFileHandler with the runtime config script (Gauzy Server UI)', () => {
	const INDEX = '<html><body><ga-app></ga-app><script src="main.js" type="module"></script></body></html>';
	const SNIPPET = `<script>window._env = { api: "http://127.0.0.1:3000" }; if (typeof global === 'undefined') { var global = window; }</script>`;
	const SERVED = INDEX.replace('</body>', `${SNIPPET}\n</body>`);

	let base: string;
	let root: string;
	let server: http.Server;
	let port: number;

	beforeAll(async () => {
		base = fs.mkdtempSync(path.join(os.tmpdir(), 'gauzy-ui-runtime-'));
		root = path.join(base, 'ui');
		fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
		fs.writeFileSync(path.join(root, 'index.html'), INDEX);
		fs.writeFileSync(path.join(root, 'main.js'), 'console.log("ui");');
		fs.writeFileSync(path.join(root, 'assets', 'index.html'), '<html><body>assets</body></html>');

		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		({ server, port } = await listen(root, { indexHtmlSnippet: SNIPPET }));
	});

	afterAll(async () => {
		await close(server);
		fs.rmSync(base, { recursive: true, force: true });
		jest.restoreAllMocks();
	});

	it.each(['/', '/index.html', '/?lang=fr'])(
		'serves %s with the script, never cached without asking',
		async (url) => {
			const reply = await send(port, url);

			expect(reply.status).toBe(200);
			expect(reply.body).toBe(SERVED);
			expect(reply.headers['content-type']).toBe('text/html; charset=utf-8');
			expect(reply.headers['cache-control']).toBe('no-cache');
		}
	);

	it('answers HEAD with the headers of that page and no body', async () => {
		const reply = await send(port, '/', 'HEAD');

		expect(reply.status).toBe(200);
		expect(reply.headers['content-length']).toBe(String(Buffer.byteLength(SERVED)));
		expect(reply.body).toBe('');
	});

	it('leaves the file on disk as it is', async () => {
		await send(port, '/');

		expect(fs.readFileSync(path.join(root, 'index.html'), 'utf8')).toBe(INDEX);
	});

	it('CONTROL: serves every other file as before, an index.html below the root included', async () => {
		const script = await send(port, '/main.js');
		expect(script.body).toBe('console.log("ui");');
		expect(script.headers['cache-control']).toContain('max-age=3600');

		const assets = await send(port, '/assets/');
		expect(assets.body).toBe('<html><body>assets</body></html>');
	});

	it('still refuses a path out of the UI directory or a NUL byte', async () => {
		expect((await send(port, '/%2e%2e/index.html')).status).toBe(403);
		expect((await send(port, '/index.html%00')).status).toBe(400);
	});

	it('answers 404 as before when the start page is missing', async () => {
		const empty = path.join(base, 'empty');
		fs.mkdirSync(empty);
		const other = await listen(empty, { indexHtmlSnippet: SNIPPET });
		try {
			const reply = await send(other.port, '/index.html');

			expect(reply.status).toBe(404);
			expect(reply.body).not.toContain('window._env');
		} finally {
			await close(other.server);
		}
	});
});
