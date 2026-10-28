jest.mock('@gauzy/config', () => ({
	environment: { jitsu: { serverHost: '', serverWriteKey: '' } }
}));
jest.mock('@jitsu/js', () => ({ jitsuAnalytics: jest.fn() }));

import { createServer, Server, ServerResponse } from 'node:http';
import { AddressInfo, Socket } from 'node:net';
import { fetchWithTimeout } from './jitsu-helper';

/**
 * `fetchWithTimeout` against a real HTTP server and the real `node-fetch` (jitsu-helper.spec.ts mocks it): a
 * Jitsu server that stops answering, before or during the response, must not hold a queue slot for good.
 */
describe('fetchWithTimeout over a real connection', () => {
	const TIMEOUT_MS = 150;
	let server: Server;
	let base: string;
	const sockets = new Set<Socket>();
	const stalled: ServerResponse[] = [];

	beforeAll(async () => {
		server = createServer((request, response) => {
			if (request.url === '/stall-before-headers') {
				stalled.push(response);
				return;
			}
			if (request.url === '/stall-in-body') {
				response.writeHead(200, { 'content-type': 'application/json' });
				response.write('{"partial":');
				stalled.push(response);
				return;
			}
			response.writeHead(200, { 'content-type': 'application/json' });
			response.end('{"ok":true}');
		});
		server.on('connection', (socket) => {
			sockets.add(socket);
			socket.on('close', () => sockets.delete(socket));
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	afterAll(async () => {
		for (const socket of sockets) socket.destroy();
		await new Promise((resolve) => server.close(resolve));
	});

	it('answers normally when the server answers', async () => {
		const response = await fetchWithTimeout(`${base}/ok`, { method: 'POST', body: '{}' }, TIMEOUT_MS);

		await expect(response.json()).resolves.toEqual({ ok: true });
	});

	it('gives up on a server that never sends the response headers', async () => {
		const started = Date.now();

		await expect(fetchWithTimeout(`${base}/stall-before-headers`, {}, TIMEOUT_MS)).rejects.toThrow(/abort/i);
		expect(Date.now() - started).toBeLessThan(5_000);
	});

	it('gives up on a response body that stops arriving, which the Jitsu client awaits too', async () => {
		const response = await fetchWithTimeout(`${base}/stall-in-body`, {}, TIMEOUT_MS);
		const started = Date.now();

		await expect(response.text()).rejects.toThrow(/abort/i);
		expect(Date.now() - started).toBeLessThan(5_000);
	});
});
