/**
 * @jest-environment node
 */
import * as fs from 'node:fs';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { createStaticFileHandler } from './static-file-server';

interface Reply {
	status: number;
	headers: http.IncomingHttpHeaders;
	body: string;
}

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

		server = http.createServer(createStaticFileHandler(root));
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
		port = (server.address() as AddressInfo).port;
	});

	afterAll(async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		fs.rmSync(base, { recursive: true, force: true });
		jest.restoreAllMocks();
	});

	/** Sends the path exactly as given (Node's client does not normalise `..` or percent-escapes). */
	function request(rawPath: string): Promise<Reply> {
		return new Promise((resolve, reject) => {
			const req = http.request({ host: '127.0.0.1', port, path: rawPath, method: 'GET', agent: false }, (res) => {
				let body = '';
				res.setEncoding('utf8');
				res.on('data', (chunk: string) => (body += chunk));
				res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
			});
			req.on('error', reject);
			req.end();
		});
	}

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
