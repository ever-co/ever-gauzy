import { createServer } from 'http';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import { gzipSync } from 'zlib';
import { fetchOverNodeHttp } from './fetch-over-node-http';
import { SsrfBlockedError, createSsrfSafeLookup } from './ssrf-safe-fetch';

/**
 * `fetchOverNodeHttp` replaces the global `fetch` for every request to a tenant-supplied AI provider
 * endpoint — including the AI SDK's chat and embedding calls — so it has to behave like fetch for
 * those callers, and it must connect ONLY through the `lookup` it is given, on every hop.
 *
 * Everything here runs against a real HTTP server on 127.0.0.1. Requests to `127.0.0.1` itself never
 * reach a `lookup` (Node connects to an IP literal directly); hostnames under `.test` reach the server
 * only through the address an injected resolver hands the `lookup`.
 */
describe('fetchOverNodeHttp', () => {
	interface IRecordedRequest {
		method: string;
		url: string;
		headers: IncomingHttpHeaders;
		body: Buffer;
	}

	interface ILocalServer {
		origin: string;
		port: number;
		requests: IRecordedRequest[];
		/** Resolves once the server has received `count` requests. */
		received: (count: number) => Promise<void>;
		close: () => Promise<void>;
	}

	let server: ILocalServer | undefined;

	/** Start a server that records each request (body included) before handing it to `handler`. */
	const startServer = async (
		handler: (req: IncomingMessage, res: ServerResponse, body: Buffer) => unknown
	): Promise<ILocalServer> => {
		const requests: IRecordedRequest[] = [];
		const waiters: Array<{ count: number; resolve: () => void }> = [];
		const http = createServer((req, res) => {
			const chunks: Buffer[] = [];
			req.on('data', (chunk: Buffer) => chunks.push(chunk));
			req.on('end', () => {
				const body = Buffer.concat(chunks);
				requests.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
				for (const waiter of waiters.filter((entry) => requests.length >= entry.count)) waiter.resolve();
				void handler(req, res, body);
			});
		});
		await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
		const port = (http.address() as AddressInfo).port;
		server = {
			origin: `http://127.0.0.1:${port}`,
			port,
			requests,
			received: (count) =>
				requests.length >= count
					? Promise.resolve()
					: new Promise<void>((resolve) => waiters.push({ count, resolve })),
			close: () =>
				new Promise<void>((resolve) => {
					http.closeAllConnections();
					http.close(() => resolve());
				})
		};
		return server;
	};

	/** The operator-provenance lookup: resolves, refuses nothing. */
	const permissive = { lookup: createSsrfSafeLookup(true) };

	afterEach(async () => {
		await server?.close();
		server = undefined;
	});

	describe('request', () => {
		it('sends a JSON POST with its headers, a content-length and the defaults fetch adds', async () => {
			const { origin, requests } = await startServer((_req, res, body) => {
				res.writeHead(200, { 'content-type': 'application/json' });
				res.end(JSON.stringify({ echoed: JSON.parse(body.toString()) }));
			});

			const response = await fetchOverNodeHttp(
				`${origin}/v1/chat/completions?stream=false`,
				{
					method: 'POST',
					headers: { 'content-type': 'application/json', authorization: 'Bearer k' },
					body: JSON.stringify({ model: 'm', messages: [] })
				},
				permissive
			);

			expect(response).toBeInstanceOf(Response);
			expect(response.ok).toBe(true);
			await expect(response.json()).resolves.toEqual({ echoed: { model: 'm', messages: [] } });

			const [request] = requests;
			expect(request.method).toBe('POST');
			expect(request.url).toBe('/v1/chat/completions?stream=false');
			expect(request.headers).toMatchObject({
				'content-type': 'application/json',
				authorization: 'Bearer k',
				'content-length': String(request.body.length),
				accept: '*/*',
				'user-agent': 'node',
				'accept-encoding': 'gzip, deflate'
			});
		});

		it('sends a FormData body as multipart with the boundary it was encoded with', async () => {
			const { origin, requests } = await startServer((_req, res) => res.end('{"text":"hi"}'));
			const form = new FormData();
			form.append('file', new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' }), 'dictation.webm');
			form.append('model', 'whisper-1');

			await (
				await fetchOverNodeHttp(`${origin}/v1/audio/transcriptions`, { method: 'POST', body: form }, permissive)
			).text();

			const [request] = requests;
			const boundary = /^multipart\/form-data; boundary=(.+)$/.exec(request.headers['content-type'] ?? '')?.[1];
			expect(boundary).toBeTruthy();
			const text = request.body.toString('latin1');
			expect(text).toContain(`--${boundary}`);
			expect(text).toContain('name="file"; filename="dictation.webm"');
			expect(text).toContain('name="model"');
			expect(request.body.includes(Buffer.from([1, 2, 3, 4]))).toBe(true);
			expect(request.headers['content-length']).toBe(String(request.body.length));
		});

		it.each([
			['a string', () => 'plain text', 'plain text', 'text/plain;charset=UTF-8'],
			['an ArrayBuffer', () => new TextEncoder().encode('array buffer').buffer, 'array buffer', undefined],
			['a typed array', () => new TextEncoder().encode('typed array'), 'typed array', undefined],
			['a Blob', () => new Blob(['blob body'], { type: 'text/csv' }), 'blob body', 'text/csv'],
			[
				'URLSearchParams',
				() => new URLSearchParams({ a: '1', b: 'two' }),
				'a=1&b=two',
				'application/x-www-form-urlencoded;charset=UTF-8'
			]
		])('sends %s body byte for byte', async (_label, makeBody, expected, contentType) => {
			const { origin, requests } = await startServer((_req, res) => res.end());

			await fetchOverNodeHttp(`${origin}/echo`, { method: 'PUT', body: makeBody() as BodyInit }, permissive);

			expect(requests[0].body.toString()).toBe(expected);
			expect(requests[0].headers['content-type']).toBe(contentType);
			expect(requests[0].headers['content-length']).toBe(String(Buffer.byteLength(expected)));
		});

		it('streams a ReadableStream body chunked', async () => {
			const { origin, requests } = await startServer((_req, res) => res.end());
			const encoder = new TextEncoder();
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(encoder.encode('part one, '));
					controller.enqueue(encoder.encode('part two'));
					controller.close();
				}
			});

			await fetchOverNodeHttp(
				`${origin}/upload`,
				{ method: 'POST', body: stream, duplex: 'half' } as RequestInit,
				permissive
			);

			expect(requests[0].body.toString()).toBe('part one, part two');
			expect(requests[0].headers['transfer-encoding']).toBe('chunked');
		});

		it('sends content-length 0 for a body-less POST, as fetch does', async () => {
			const { origin, requests } = await startServer((_req, res) => res.end());
			await fetchOverNodeHttp(`${origin}/empty`, { method: 'POST' }, permissive);
			expect(requests[0].headers['content-length']).toBe('0');
		});

		it('takes the URL, method, headers and body of a Request input', async () => {
			const { origin, requests } = await startServer((_req, res) => res.end());
			const request = new Request(`${origin}/from-request`, {
				method: 'POST',
				headers: { 'x-custom': 'yes' },
				body: '{"input":1}'
			});

			await fetchOverNodeHttp(request, undefined, permissive);

			expect(requests[0]).toMatchObject({ method: 'POST', url: '/from-request' });
			expect(requests[0].headers['x-custom']).toBe('yes');
			expect(requests[0].body.toString()).toBe('{"input":1}');
		});
	});

	describe('response', () => {
		it('streams the body as it arrives, before the server has finished', async () => {
			const chunks = ['data: one\n\n', 'data: two\n\n', 'data: three\n\n'];
			const released: Array<() => void> = [];
			let ended = false;
			const { origin } = await startServer(async (_req, res) => {
				res.writeHead(200, { 'content-type': 'text/event-stream' });
				for (const chunk of chunks) {
					res.write(chunk);
					// The next chunk is written only once this one was read on the client side.
					await new Promise<void>((resolve) => released.push(resolve));
					await new Promise((resolve) => setTimeout(resolve, 20));
				}
				ended = true;
				res.end();
			});

			const response = await fetchOverNodeHttp(`${origin}/sse`, undefined, permissive);
			const reader = response.body!.getReader();
			const decoder = new TextDecoder();
			for (const chunk of chunks) {
				const { value } = await reader.read();
				expect(decoder.decode(value)).toBe(chunk);
				expect(ended).toBe(false);
				released.shift()!();
			}
			await expect(reader.read()).resolves.toMatchObject({ done: true });
		});

		it('keeps the status, status text and repeated headers', async () => {
			const { origin } = await startServer((_req, res) => {
				res.setHeader('set-cookie', ['a=1', 'b=2']);
				res.setHeader('x-multi', ['one', 'two']);
				res.writeHead(418, 'I am a teapot');
				res.end('short and stout');
			});

			const response = await fetchOverNodeHttp(`${origin}/teapot`, undefined, permissive);

			expect(response.status).toBe(418);
			expect(response.ok).toBe(false);
			expect(response.statusText).toBe('I am a teapot');
			expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2']);
			expect(response.headers.get('x-multi')).toBe('one, two');
			await expect(response.text()).resolves.toBe('short and stout');
			expect(response.url).toBe(`${origin}/teapot`);
			expect(response.redirected).toBe(false);
		});

		it('decodes a gzip body, as fetch does', async () => {
			const { origin } = await startServer((_req, res) => {
				res.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'gzip' });
				res.end(gzipSync(JSON.stringify({ data: [{ id: 'gpt' }] })));
			});

			const response = await fetchOverNodeHttp(`${origin}/models`, undefined, permissive);
			await expect(response.json()).resolves.toEqual({ data: [{ id: 'gpt' }] });
		});

		it('gives a 204 and a HEAD response no body', async () => {
			const { origin } = await startServer((req, res) => {
				res.writeHead(req.method === 'HEAD' ? 200 : 204, { 'content-length': '0' });
				res.end();
			});

			expect((await fetchOverNodeHttp(`${origin}/none`, undefined, permissive)).body).toBeNull();
			expect((await fetchOverNodeHttp(`${origin}/none`, { method: 'HEAD' }, permissive)).body).toBeNull();
		});

		it('rejects with TypeError: fetch failed when nothing is listening', async () => {
			const { origin, close } = await startServer((_req, res) => res.end());
			await close();
			server = undefined;

			await expect(fetchOverNodeHttp(`${origin}/gone`, undefined, permissive)).rejects.toMatchObject({
				name: 'TypeError',
				message: 'fetch failed',
				cause: expect.objectContaining({ code: 'ECONNREFUSED' })
			});
		});
	});

	describe('abort', () => {
		it('aborts a request that is waiting for its response, rejecting with the AbortError fetch would', async () => {
			const { origin, received } = await startServer(() => undefined /* never answers */);
			const controller = new AbortController();

			const pending = fetchOverNodeHttp(`${origin}/slow`, { signal: controller.signal }, permissive);
			await received(1);
			controller.abort();

			await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
		});

		it('rejects with the signal reason, so a timeout still reads as a TimeoutError', async () => {
			const { origin, received } = await startServer(() => undefined);
			const controller = new AbortController();
			const reason = Object.assign(new Error('The operation was aborted due to timeout'), {
				name: 'TimeoutError'
			});

			const pending = fetchOverNodeHttp(`${origin}/slow`, { signal: controller.signal }, permissive);
			await received(1);
			controller.abort(reason);

			await expect(pending).rejects.toBe(reason);
		});

		it('errors the body stream when aborted mid-body', async () => {
			const { origin } = await startServer((_req, res) => {
				res.writeHead(200, { 'content-type': 'text/event-stream' });
				res.write('data: first\n\n');
			});
			const controller = new AbortController();

			const response = await fetchOverNodeHttp(`${origin}/stream`, { signal: controller.signal }, permissive);
			const reader = response.body!.getReader();
			await reader.read();
			controller.abort();

			await expect(reader.read()).rejects.toMatchObject({ name: 'AbortError' });
		});

		it('does not start a request whose signal is already aborted', async () => {
			const { origin, requests } = await startServer((_req, res) => res.end());

			await expect(
				fetchOverNodeHttp(`${origin}/never`, { signal: AbortSignal.abort() }, permissive)
			).rejects.toMatchObject({ name: 'AbortError' });
			expect(requests).toEqual([]);
		});
	});

	describe('redirects', () => {
		/** A server whose `/redirect` answers `status` pointing at `location(port)`. */
		const redirectingServer = (status: number, location: (port: number) => string) => {
			let port = 0;
			return startServer((req, res, body) => {
				if (req.url === '/redirect') {
					res.writeHead(status, { location: location(port) });
					res.end();
					return;
				}
				res.writeHead(200, { 'content-type': 'application/json' });
				res.end(
					JSON.stringify({
						method: req.method,
						body: body.toString(),
						type: req.headers['content-type'] ?? null
					})
				);
			}).then((started) => {
				port = started.port;
				return started;
			});
		};

		it('refuses a hop whose host resolves to a private address, at connection time', async () => {
			const { origin, requests } = await redirectingServer(
				302,
				(port) => `http://metadata.gateway.test:${port}/secret`
			);
			const resolver = jest.fn(async (_hostname: string) => ['127.0.0.1']);

			const error = await fetchOverNodeHttp(`${origin}/redirect`, undefined, {
				lookup: createSsrfSafeLookup(false, resolver)
			}).catch((caught: unknown) => caught);

			expect(error).toMatchObject({ name: 'TypeError', message: 'fetch failed' });
			expect((error as { cause?: unknown }).cause).toBeInstanceOf(SsrfBlockedError);
			expect(resolver).toHaveBeenCalledWith('metadata.gateway.test');
			expect(requests.map((request) => request.url)).toEqual(['/redirect']);
		});

		it('passes every hop to beforeRedirect first, and a refusal there stops the hop', async () => {
			const { origin, requests } = await redirectingServer(302, () => 'http://169.254.169.254/latest/meta-data/');
			const refusal = new SsrfBlockedError('refused');
			const beforeRedirect = jest.fn().mockRejectedValue(refusal);

			await expect(
				fetchOverNodeHttp(`${origin}/redirect`, undefined, { ...permissive, beforeRedirect })
			).rejects.toBe(refusal);

			expect(beforeRedirect).toHaveBeenCalledWith('http://169.254.169.254/latest/meta-data/', expect.anything());
			expect(requests.map((request) => request.url)).toEqual(['/redirect']);
		});

		it('returns the 3xx itself with redirect: manual', async () => {
			const { origin, requests } = await redirectingServer(302, () => '/elsewhere');

			const response = await fetchOverNodeHttp(`${origin}/redirect`, { redirect: 'manual' }, permissive);

			expect(response.status).toBe(302);
			expect(response.headers.get('location')).toBe('/elsewhere');
			expect(requests).toHaveLength(1);
		});

		it('rejects with redirect: error', async () => {
			const { origin, requests } = await redirectingServer(307, () => '/elsewhere');

			await expect(
				fetchOverNodeHttp(`${origin}/redirect`, { redirect: 'error' }, permissive)
			).rejects.toMatchObject({ name: 'TypeError', message: 'fetch failed' });
			expect(requests).toHaveLength(1);
		});

		it('follows a 303 from a POST as a body-less GET', async () => {
			const { origin } = await redirectingServer(303, () => '/landing');

			const response = await fetchOverNodeHttp(
				`${origin}/redirect`,
				{ method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' },
				permissive
			);

			await expect(response.json()).resolves.toEqual({ method: 'GET', body: '', type: null });
			expect(response.redirected).toBe(true);
			expect(response.url).toBe(`${origin}/landing`);
		});

		it('follows a 307 with the method and body intact', async () => {
			const { origin } = await redirectingServer(307, () => '/landing');

			const response = await fetchOverNodeHttp(
				`${origin}/redirect`,
				{ method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' },
				permissive
			);

			await expect(response.json()).resolves.toEqual({
				method: 'POST',
				body: '{"a":1}',
				type: 'application/json'
			});
		});

		it('drops the credential when a redirect leaves the origin', async () => {
			const { origin, requests } = await redirectingServer(302, (port) => `http://localhost:${port}/landing`);

			await fetchOverNodeHttp(
				`${origin}/redirect`,
				{ headers: { authorization: 'Bearer secret' } },
				{ lookup: createSsrfSafeLookup(true, async () => ['127.0.0.1']) }
			);

			expect(requests[0].headers.authorization).toBe('Bearer secret');
			expect(requests[1].headers.authorization).toBeUndefined();
		});

		it('gives up after 20 redirects', async () => {
			const { origin, requests } = await redirectingServer(302, () => '/redirect');

			await expect(fetchOverNodeHttp(`${origin}/redirect`, undefined, permissive)).rejects.toMatchObject({
				name: 'TypeError',
				message: 'fetch failed'
			});
			expect(requests).toHaveLength(21);
		});
	});
});
