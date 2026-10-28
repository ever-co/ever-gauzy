jest.mock('@gauzy/config', () => ({
	environment: { jitsu: { serverHost: '', serverWriteKey: '' } }
}));

import { createServer, Server } from 'node:http';
import { AddressInfo, Socket } from 'node:net';
import { createJitsu, jitsuRequestTimeoutMs, JITSU_REQUEST_TIMEOUT_MS } from './jitsu-helper';
import { BoundedEventQueue } from './jitsu-event-queue';

/**
 * The whole send path the entity subscriber uses — the real `@jitsu/js` client from `createJitsu`, its
 * `config.fetch`, and `BoundedEventQueue` — against a real HTTP server whose first request never gets an
 * answer. The queue must not stay blocked behind it.
 */
describe('a stalled Jitsu server does not block the entity-event queue', () => {
	let server: Server;
	let base: string;
	const sockets = new Set<Socket>();
	const received: string[] = [];
	let savedTimeout: string | undefined;

	beforeAll(async () => {
		server = createServer((request, response) => {
			let body = '';
			request.on('data', (chunk) => (body += chunk));
			request.on('end', () => {
				received.push(body);
				if (received.length === 1) return; // the first request never gets an answer
				response.writeHead(200, { 'content-type': 'application/json' });
				response.end('{}');
			});
		});
		server.on('connection', (socket) => {
			sockets.add(socket);
			socket.on('close', () => sockets.delete(socket));
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
		savedTimeout = process.env.JITSU_REQUEST_TIMEOUT_MS;
		process.env.JITSU_REQUEST_TIMEOUT_MS = '200';
	});

	afterAll(async () => {
		if (savedTimeout === undefined) delete process.env.JITSU_REQUEST_TIMEOUT_MS;
		else process.env.JITSU_REQUEST_TIMEOUT_MS = savedTimeout;
		for (const socket of sockets) socket.destroy();
		await new Promise((resolve) => server.close(resolve));
	});

	beforeEach(() => {
		for (const level of ['log', 'warn', 'error'] as const) {
			jest.spyOn(console, level).mockImplementation(() => undefined);
		}
	});

	afterEach(() => jest.restoreAllMocks());

	it('sends the next event once the stalled request times out', async () => {
		const client = createJitsu({ host: base, writeKey: 'key:secret' } as any);
		const queue = new BoundedEventQueue(
			(properties: Record<string, unknown>) => client.track('afterEntityCreate', properties),
			{
				concurrency: 1,
				maxQueued: 10
			}
		);

		queue.offer(() => ({ data: { id: 'first' } }));
		queue.offer(() => ({ data: { id: 'second' } }));

		const started = Date.now();
		while (queue.pending > 0 && Date.now() - started < 5_000) {
			await new Promise((resolve) => setTimeout(resolve, 20));
		}

		expect(queue.pending).toBe(0);
		expect(received).toHaveLength(2);
		expect(received[0]).toContain('"first"');
		expect(received[1]).toContain('"second"');
	});
});

describe('jitsuRequestTimeoutMs', () => {
	it.each([
		[undefined, JITSU_REQUEST_TIMEOUT_MS],
		['5000', 5000],
		['0', JITSU_REQUEST_TIMEOUT_MS],
		['-1', JITSU_REQUEST_TIMEOUT_MS],
		['2147483647', 2147483647],
		['2147483648', JITSU_REQUEST_TIMEOUT_MS],
		['4294967296', JITSU_REQUEST_TIMEOUT_MS],
		['abc', JITSU_REQUEST_TIMEOUT_MS]
	])('reads %p as %p', (value, expected) => {
		const env = value === undefined ? {} : { JITSU_REQUEST_TIMEOUT_MS: value };
		expect(jitsuRequestTimeoutMs(env)).toBe(expected);
	});
});
