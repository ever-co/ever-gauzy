import { createServer } from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import { ALLOW_PRIVATE_BASE_URLS_ENV, SsrfBlockedError, createAiProviderSdkFetch, ssrfSafeFetch } from './index';

/**
 * The egress guard's verdict has to hold for the connection that is actually made, not only for a
 * lookup made beforehand. A tenant admin who controls a DNS name with TTL 0 can answer a public
 * address to the pre-flight and `127.0.0.1` a moment later, when the request connects; a guard that
 * resolves, checks and then lets the transport resolve again reaches whatever the second answer names.
 *
 * These specs use a real HTTP server on 127.0.0.1 and an injected resolver, so the "internal service"
 * is real and nothing leaves the machine. The hostnames sit under `.test` (RFC 6761), which no real
 * resolver answers: a request reaches the server only through the address the guard handed out.
 */
describe('AI provider SSRF guard — the check is bound to the connection', () => {
	interface ILocalServer {
		port: number;
		/** Paths the server was asked for, in order. */
		hits: string[];
		close: () => Promise<void>;
	}

	let server: ILocalServer | undefined;
	const originalFlag = process.env[ALLOW_PRIVATE_BASE_URLS_ENV];

	/** Start the stand-in for an internal service. */
	const startServer = async (
		handler: (req: IncomingMessage, res: ServerResponse) => unknown
	): Promise<ILocalServer> => {
		const hits: string[] = [];
		const http = createServer((req, res) => {
			hits.push(req.url ?? '');
			void handler(req, res);
		});
		await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
		server = {
			port: (http.address() as AddressInfo).port,
			hits,
			close: () =>
				new Promise<void>((resolve) => {
					http.closeAllConnections();
					http.close(() => resolve());
				})
		};
		return server;
	};

	/** A TTL-0 rebinding name: `first` for the first lookup, `later` for every lookup after it. */
	const rebinding = (first: string[], later: string[]) => {
		let calls = 0;
		return jest.fn(async (_hostname: string) => (calls++ === 0 ? first : later));
	};

	beforeEach(() => {
		delete process.env[ALLOW_PRIVATE_BASE_URLS_ENV];
	});

	afterEach(async () => {
		await server?.close();
		server = undefined;
		if (originalFlag === undefined) {
			delete process.env[ALLOW_PRIVATE_BASE_URLS_ENV];
		} else {
			process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = originalFlag;
		}
	});

	describe('ssrfSafeFetch (catalogue and dictation)', () => {
		it.each([
			['loopback', ['127.0.0.1']],
			['a public address alongside loopback', ['93.184.216.34', '127.0.0.1']]
		])(
			'refuses, at connection time, a name that answered public to the pre-flight and then %s',
			async (_label, connectAnswer) => {
				const { port, hits } = await startServer((_req, res) => res.end('internal secret'));
				const resolver = rebinding(['93.184.216.34'], connectAnswer);

				await expect(
					ssrfSafeFetch(`http://rebind.gateway.test:${port}/v1/models`, undefined, { resolver })
				).rejects.toThrow(SsrfBlockedError);

				// Asked twice — the pre-flight, then the connection — and refused on the second answer.
				expect(resolver).toHaveBeenCalledTimes(2);
				expect(hits).toEqual([]);
			}
		);

		it('refuses a public-looking name whose lookup returns a private address', async () => {
			const { port, hits } = await startServer((_req, res) => res.end('internal secret'));
			const resolver = jest.fn(async (_hostname: string) => ['127.0.0.1']);

			await expect(
				ssrfSafeFetch(`http://internal.gateway.test:${port}/v1/models`, undefined, { resolver })
			).rejects.toThrow(SsrfBlockedError);
			expect(hits).toEqual([]);
		});

		it('connects to a private address the OPERATOR chose (allowPrivateHost)', async () => {
			const { port, hits } = await startServer((_req, res) => {
				res.writeHead(200, { 'content-type': 'application/json' });
				res.end('{"data":[{"id":"llama3"}]}');
			});
			const resolver = jest.fn(async (_hostname: string) => ['127.0.0.1']);

			const response = await ssrfSafeFetch(
				`http://ollama.gateway.test:${port}/v1/models`,
				{ headers: { accept: 'application/json' } },
				{ allowPrivateHost: true, resolver }
			);

			expect(response.status).toBe(200);
			await expect(response.json()).resolves.toEqual({ data: [{ id: 'llama3' }] });
			expect(hits).toEqual(['/v1/models']);
		});

		it('still refuses to follow a redirect, even to a permitted target', async () => {
			const { port, hits } = await startServer((req, res) => {
				if (req.url === '/v1/models') {
					res.writeHead(302, { location: `http://127.0.0.1:${port}/latest/meta-data/` });
					res.end();
					return;
				}
				res.end('internal secret');
			});

			await expect(
				ssrfSafeFetch(`http://127.0.0.1:${port}/v1/models`, undefined, { allowPrivateHost: true })
			).rejects.toMatchObject({ name: 'TypeError', message: 'fetch failed' });
			expect(hits).toEqual(['/v1/models']);
		});
	});

	describe('createAiProviderSdkFetch (chat and embeddings)', () => {
		const tenant = (port: number) =>
			({ apiKey: 'k', baseUrl: `http://llm.gateway.test:${port}/v1`, source: 'tenant' }) as const;

		it('refuses a chat request whose host rebinds to loopback between the pre-flight and the connection', async () => {
			const { port, hits } = await startServer((_req, res) => res.end('internal secret'));
			const resolver = rebinding(['93.184.216.34'], ['127.0.0.1']);
			const sdkFetch = createAiProviderSdkFetch(tenant(port), { resolver });

			await expect(
				sdkFetch!(`http://llm.gateway.test:${port}/v1/chat/completions`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: '{"stream":true}'
				})
			).rejects.toThrow(SsrfBlockedError);

			expect(resolver).toHaveBeenCalledTimes(2);
			expect(hits).toEqual([]);
		});

		it('streams a chat completion from a private endpoint on a deployment that opted in', async () => {
			// Server-sent events must reach the SDK chunk by chunk: each event is released by the server
			// only after the previous one was read on this side, so a transport that buffered the body
			// until the response ended would hang here instead of passing.
			process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = 'true';
			const events = ['data: {"delta":"Hel"}\n\n', 'data: {"delta":"lo"}\n\n', 'data: [DONE]\n\n'];
			const released: Array<() => void> = [];
			let ended = false;
			const { port } = await startServer(async (_req, res) => {
				res.writeHead(200, { 'content-type': 'text/event-stream' });
				for (const event of events) {
					res.write(event);
					await new Promise<void>((resolve) => released.push(resolve));
					await new Promise((resolve) => setTimeout(resolve, 20));
				}
				ended = true;
				res.end();
			});
			const sdkFetch = createAiProviderSdkFetch(tenant(port), { resolver: async () => ['127.0.0.1'] });

			const response = await sdkFetch!(`http://llm.gateway.test:${port}/v1/chat/completions`, {
				method: 'POST',
				body: '{"stream":true}'
			});
			expect(response.headers.get('content-type')).toBe('text/event-stream');

			const reader = response.body!.getReader();
			const decoder = new TextDecoder();
			for (const event of events) {
				const { value, done } = await reader.read();
				expect(done).toBe(false);
				expect(decoder.decode(value)).toBe(event);
				expect(ended).toBe(false);
				released.shift()!();
			}
			await expect(reader.read()).resolves.toMatchObject({ done: true });
			expect(ended).toBe(true);
		});
	});
});
