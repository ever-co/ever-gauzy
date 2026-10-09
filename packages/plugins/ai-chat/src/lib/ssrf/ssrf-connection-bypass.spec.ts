import { lookup } from 'dns';
import { createServer } from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import { getDefaultAutoSelectFamily } from 'net';
import type { AddressInfo, LookupFunction } from 'net';
import { fetchOverNodeHttp } from './fetch-over-node-http';
import { SsrfBlockedError, createSsrfSafeLookup, ssrfSafeFetch } from './ssrf-safe-fetch';

// The production path resolves through `dns.lookup`, not an injected resolver. Replacing it here lets
// a spec hand the pre-flight and the connection different answers on that path; every other case
// passes straight through to the real `dns.lookup`.
jest.mock('dns', () => ({ ...jest.requireActual('dns'), lookup: jest.fn() }));
const lookupMock = lookup as unknown as jest.Mock;
const realLookup = jest.requireActual<typeof import('dns')>('dns').lookup;
type LookupCallback = (error: NodeJS.ErrnoException | null, addresses?: { address: string; family: number }[]) => void;

/**
 * Attempts to reach an internal address around the connection-time check, each against a real HTTP
 * server on 127.0.0.1 that a bypass would actually reach:
 *
 * - the default `dns.lookup` path (no injected resolver) rebinding after the pre-flight;
 * - IP-literal spellings, which Node connects to without ever calling `lookup`;
 * - HTTPS, where the `lookup` has to travel through the TLS agent;
 * - Happy Eyeballs answer sets that hide one private address among public ones;
 * - a keep-alive socket that could be reused without a second `lookup`.
 *
 * The last group checks that a hostile upstream cannot raise an unhandled error: in the API process
 * that would take the pod down, and jest fails a case on any error that escapes while it runs.
 */
describe('AI provider SSRF guard — bypass attempts on the connection', () => {
	interface ILocalServer {
		port: number;
		/** Paths the server was asked for, in order. */
		hits: string[];
		/** Client port of each request, one per connection when nothing is reused. */
		clientPorts: number[];
		/** Connections the server has seen close. */
		closedConnections: () => number;
		close: () => Promise<void>;
	}

	let server: ILocalServer | undefined;

	const startServer = async (
		handler: (req: IncomingMessage, res: ServerResponse) => unknown
	): Promise<ILocalServer> => {
		const hits: string[] = [];
		const clientPorts: number[] = [];
		let closed = 0;
		const http = createServer((req, res) => {
			hits.push(req.url ?? '');
			clientPorts.push(req.socket.remotePort ?? 0);
			void handler(req, res);
		});
		http.on('connection', (socket) => socket.on('close', () => closed++));
		await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
		server = {
			port: (http.address() as AddressInfo).port,
			hits,
			clientPorts,
			closedConnections: () => closed,
			close: () =>
				new Promise<void>((resolve) => {
					http.closeAllConnections();
					http.close(() => resolve());
				})
		};
		return server;
	};

	/** Give late socket and stream events time to fire inside the case that caused them. */
	const settle = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

	const causeOf = (error: unknown) => (error as { cause?: unknown } | null)?.cause;

	beforeEach(() => {
		lookupMock.mockReset();
		lookupMock.mockImplementation(realLookup);
	});

	afterEach(async () => {
		await server?.close();
		server = undefined;
	});

	describe('the default dns.lookup path', () => {
		it.each([
			[
				'a public address',
				(callback: LookupCallback) => callback(null, [{ address: '93.184.216.34', family: 4 }])
			],
			[
				'"no such host" (let through by the pre-flight)',
				(callback: LookupCallback) =>
					callback(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }))
			]
		])('refuses a name that answered %s to the pre-flight and loopback at connect', async (_label, first) => {
			const { port, hits } = await startServer((_req, res) => res.end('internal secret'));
			let calls = 0;
			lookupMock.mockImplementation((_hostname: string, _options: unknown, callback: LookupCallback) => {
				if (calls++ === 0) return setImmediate(() => first(callback));
				setImmediate(() => callback(null, [{ address: '127.0.0.1', family: 4 }]));
			});

			await expect(ssrfSafeFetch(`http://rebind.gateway.test:${port}/v1/models`)).rejects.toThrow(
				SsrfBlockedError
			);

			expect(calls).toBe(2);
			expect(hits).toEqual([]);
		});

		it('refuses `localhost` as the operating system resolves it', async () => {
			const { port, hits } = await startServer((_req, res) => res.end('internal secret'));

			const error = await fetchOverNodeHttp(`http://localhost:${port}/`, undefined, {
				lookup: createSsrfSafeLookup(false)
			}).catch((caught: unknown) => caught);

			expect(causeOf(error)).toBeInstanceOf(SsrfBlockedError);
			expect(hits).toEqual([]);
		});

		it('still connects an operator endpoint on localhost, whichever address family answers', async () => {
			const { port } = await startServer((_req, res) => res.end('ok'));

			const response = await ssrfSafeFetch(`http://localhost:${port}/v1/models`, undefined, {
				allowPrivateHost: true
			});

			expect(response.status).toBe(200);
			expect(await response.text()).toBe('ok');
		});
	});

	it.each([
		['a decimal', (port: number) => `http://2130706433:${port}/`],
		['a hexadecimal', (port: number) => `http://0x7f000001:${port}/`],
		['an octal', (port: number) => `http://0177.0.0.1:${port}/`],
		['a shortened', (port: number) => `http://127.1:${port}/`],
		['an IPv4-mapped IPv6', (port: number) => `http://[::ffff:127.0.0.1]:${port}/`],
		['the unspecified IPv6', (port: number) => `http://[::]:${port}/`],
		['a "this" network', (port: number) => `http://0.0.0.0:${port}/`]
	])('refuses %s literal, which reaches no lookup, before connecting', async (_label, url) => {
		const { port, hits } = await startServer((_req, res) => res.end('internal secret'));
		const resolver = jest.fn(async (_hostname: string) => ['93.184.216.34']);

		await expect(ssrfSafeFetch(url(port), undefined, { resolver })).rejects.toThrow(SsrfBlockedError);

		expect(resolver).not.toHaveBeenCalled();
		expect(hits).toEqual([]);
	});

	it('resolves an HTTPS connection through the lookup as well', async () => {
		const { port, hits } = await startServer((_req, res) => res.end('internal secret'));
		const resolver = jest.fn(async (_hostname: string) => ['127.0.0.1']);

		const error = await fetchOverNodeHttp(`https://rebind.gateway.test:${port}/`, undefined, {
			lookup: createSsrfSafeLookup(false, resolver)
		}).catch((caught: unknown) => caught);

		expect(causeOf(error)).toBeInstanceOf(SsrfBlockedError);
		expect(resolver).toHaveBeenCalledWith('rebind.gateway.test');
		expect(hits).toEqual([]);
	});

	it.each([
		['a loopback IPv6 address after a public IPv4 one', ['93.184.216.34', '::1']],
		['an IPv4-mapped loopback address after a public IPv6 one', ['2606:4700::1111', '::ffff:127.0.0.1']],
		['the metadata address after several public ones', ['93.184.216.34', '1.1.1.1', '8.8.8.8', '169.254.169.254']]
	])('refuses the whole answer set when Happy Eyeballs is handed %s', async (_label, answer) => {
		const { port, hits } = await startServer((_req, res) => res.end('internal secret'));
		const requested: Array<{ all?: boolean }> = [];
		const guarded = createSsrfSafeLookup(false, async () => answer);
		const recording: LookupFunction = (hostname, options, callback) => {
			requested.push({ all: options.all });
			guarded(hostname, options, callback);
		};

		const error = await fetchOverNodeHttp(`http://mixed.gateway.test:${port}/`, undefined, {
			lookup: recording
		}).catch((caught: unknown) => caught);

		expect(causeOf(error)).toBeInstanceOf(SsrfBlockedError);
		expect(hits).toEqual([]);
		// With address-family auto-selection on (Node's default), Node asks for every address and may try each.
		expect(requested).toEqual([{ all: getDefaultAutoSelectFamily() ? true : undefined }]);
	});

	it('opens a new connection, through the lookup, for every request to a keep-alive server', async () => {
		const { port, clientPorts } = await startServer((_req, res) => {
			res.writeHead(200, { connection: 'keep-alive', 'keep-alive': 'timeout=60', 'content-length': '2' });
			res.end('ok');
		});
		const resolver = jest.fn(async (_hostname: string) => ['127.0.0.1']);
		const options = { lookup: createSsrfSafeLookup(true, resolver) };

		for (let i = 0; i < 3; i++) {
			const response = await fetchOverNodeHttp(`http://pool.gateway.test:${port}/`, undefined, options);
			await response.text();
		}

		expect(resolver).toHaveBeenCalledTimes(3);
		expect(new Set(clientPorts).size).toBe(3);
	});

	describe('a hostile upstream raises no unhandled error', () => {
		const permissive = { lookup: createSsrfSafeLookup(true) };

		it('errors the body stream when the connection resets mid-body', async () => {
			const { port } = await startServer((_req, res) => {
				res.writeHead(200, { 'content-type': 'text/event-stream' });
				res.write('data: first\n\n');
				setTimeout(() => res.socket?.destroy(), 20);
			});

			const response = await fetchOverNodeHttp(`http://127.0.0.1:${port}/`, undefined, permissive);
			const reader = response.body!.getReader();
			await reader.read();

			await expect(reader.read()).rejects.toBeDefined();
			await settle();
		});

		it('tolerates a reset of a response body nobody reads', async () => {
			const { port } = await startServer((_req, res) => {
				res.writeHead(500, { 'content-type': 'text/plain' });
				res.write('partial');
				setTimeout(() => res.socket?.destroy(), 20);
			});

			const response = await fetchOverNodeHttp(`http://127.0.0.1:${port}/`, undefined, permissive);

			expect(response.status).toBe(500);
			await settle();
		});

		it('rejects with TypeError: fetch failed when the connection resets before the headers', async () => {
			const { port } = await startServer((req) => req.socket.destroy());

			await expect(fetchOverNodeHttp(`http://127.0.0.1:${port}/`, undefined, permissive)).rejects.toMatchObject({
				name: 'TypeError',
				message: 'fetch failed'
			});
			await settle();
		});

		it('errors the body of a corrupt gzip response, whether it is read or not', async () => {
			const { port } = await startServer((_req, res) => {
				res.writeHead(200, { 'content-encoding': 'gzip' });
				res.end(Buffer.from('not a gzip stream'));
			});

			const unread = await fetchOverNodeHttp(`http://127.0.0.1:${port}/`, undefined, permissive);
			const read = await fetchOverNodeHttp(`http://127.0.0.1:${port}/`, undefined, permissive);

			await expect(read.text()).rejects.toBeDefined();
			expect(unread.status).toBe(200);
			await settle();
		});

		it('closes the connection when aborted after the headers with the body unread', async () => {
			const { port, closedConnections } = await startServer((_req, res) => {
				res.writeHead(200, { 'content-type': 'text/event-stream', 'content-encoding': 'gzip' });
				res.flushHeaders();
			});
			const controller = new AbortController();

			const response = await fetchOverNodeHttp(
				`http://127.0.0.1:${port}/`,
				{ signal: controller.signal },
				permissive
			);
			controller.abort();
			await settle();

			expect(response.status).toBe(200);
			expect(closedConnections()).toBe(1);
		});

		it('refuses a streamed request body at connection time without leaking the stream error', async () => {
			const { port, hits } = await startServer((_req, res) => res.end('internal secret'));
			let pulls = 0;
			const body = new ReadableStream<Uint8Array>({
				pull(controller) {
					if (pulls++ > 3) controller.close();
					else controller.enqueue(new TextEncoder().encode('chunk'));
				}
			});

			const error = await fetchOverNodeHttp(
				`http://blocked.gateway.test:${port}/`,
				{ method: 'POST', body, duplex: 'half' } as RequestInit,
				{ lookup: createSsrfSafeLookup(false, async () => ['10.0.0.1']) }
			).catch((caught: unknown) => caught);

			expect(causeOf(error)).toBeInstanceOf(SsrfBlockedError);
			expect(hits).toEqual([]);
			await settle();
		});
	});
});
