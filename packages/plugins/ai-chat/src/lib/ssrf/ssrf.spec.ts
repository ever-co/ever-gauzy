import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns';
import {
	ALLOW_PRIVATE_BASE_URLS_ENV,
	getUnsafeAiOutboundUrlReason,
	getUnsafeAiProviderBaseUrlReason,
	createAiProviderSdkFetch,
	isPrivateAiProviderEndpointAllowed,
	SsrfBlockedError,
	ssrfSafeFetch
} from './index';

// The DEFAULT resolver is `dns.lookup`; replacing it lets a spec prove what the guard does when no
// resolver is injected (no verdict reuse) without touching the network.
jest.mock('dns', () => ({ ...jest.requireActual('dns'), lookup: jest.fn() }));
const lookupMock = lookup as unknown as jest.Mock;
type LookupCallback = (error: null, addresses: { address: string; family: number }[]) => void;
import { assertSafeAiProviderBaseUrl } from '../credentials/base-url.validator';

/**
 * A tenant admin can store an AI-provider `baseUrl` that the server then fetches — the model
 * catalogue, dictation, chat completions and the docs plugin's embeddings all originate from that
 * one string. Validated only as "is a URL" (with `require_tld: false`, which explicitly admits
 * `http://169.254.169.254/` and `http://localhost`), it was a server-side request forgery primitive
 * against whatever the API pod can reach (GHSA-w3mx-m5cr-3gxp).
 */
describe('AI provider base URL — SSRF egress guard', () => {
	const originalFlag = process.env[ALLOW_PRIVATE_BASE_URLS_ENV];

	afterEach(() => {
		if (originalFlag === undefined) {
			delete process.env[ALLOW_PRIVATE_BASE_URLS_ENV];
		} else {
			process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = originalFlag;
		}
		jest.restoreAllMocks();
	});

	describe('getUnsafeAiProviderBaseUrlReason (store time)', () => {
		beforeEach(() => {
			delete process.env[ALLOW_PRIVATE_BASE_URLS_ENV];
		});

		it.each([
			['cloud metadata', 'http://169.254.169.254/latest/meta-data/'],
			[
				'cloud metadata with a trailing `?` that would swallow the appended path',
				'http://169.254.169.254/latest/meta-data/?'
			],
			['loopback by name', 'http://localhost:8080/v1'],
			['loopback by name with a trailing dot', 'http://localhost./v1'],
			['loopback by IPv4 literal', 'http://127.0.0.1:11434/v1'],
			['loopback by IPv6 literal', 'http://[::1]:8000/v1'],
			['IPv4-mapped IPv6 loopback', 'http://[::ffff:127.0.0.1]/v1'],
			['RFC 1918 /8', 'http://10.0.0.5/v1'],
			['RFC 1918 /12', 'https://172.16.9.9/v1'],
			['RFC 1918 /16', 'http://192.168.1.10:8080/v1'],
			['CGNAT', 'http://100.64.0.1/v1'],
			['IPv6 unique-local', 'http://[fc00::1]/v1'],
			['IPv6 link-local', 'http://[fe80::1]/v1'],
			['"this" network', 'http://0.0.0.0:8080/v1'],
			['a non-HTTP scheme', 'file:///etc/passwd'],
			['embedded credentials', 'https://user:pw@api.example.com/v1'],
			['a query string that would demote the appended path', 'https://api.example.com/anything?'],
			['a fragment that would demote the appended path', 'https://api.example.com/anything#'],
			['nonsense', 'not-a-url']
		])('refuses %s', (_label, url) => {
			expect(getUnsafeAiProviderBaseUrlReason(url)).not.toBeNull();
			expect(() => assertSafeAiProviderBaseUrl(url)).toThrow(BadRequestException);
		});

		it.each([
			['a public vendor endpoint', 'https://api.openai.com/v1'],
			['a public self-hosted gateway', 'https://llm.example.com/v1'],
			['a public gateway on a non-standard port', 'https://llm.example.com:8443/v1'],
			['a public plain-HTTP gateway', 'http://llm.example.com/v1']
		])('accepts %s', (_label, url) => {
			expect(getUnsafeAiProviderBaseUrlReason(url)).toBeNull();
			expect(() => assertSafeAiProviderBaseUrl(url)).not.toThrow();
		});

		it('re-permits ONLY the host rule when the deployment opts in to private endpoints', () => {
			process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = 'true';

			// The self-hosted workflow the flag exists for.
			expect(getUnsafeAiProviderBaseUrlReason('http://localhost:8080/v1')).toBeNull();
			expect(getUnsafeAiProviderBaseUrlReason('http://192.168.1.10:8000/v1')).toBeNull();

			// Every other rule still applies on an opted-in deployment.
			expect(getUnsafeAiProviderBaseUrlReason('file://localhost/etc/passwd')).not.toBeNull();
			expect(getUnsafeAiProviderBaseUrlReason('http://user:pw@127.0.0.1/v1')).not.toBeNull();
			expect(getUnsafeAiProviderBaseUrlReason('http://127.0.0.1/v1?')).not.toBeNull();
		});

		it('treats anything other than `true` as opted OUT', () => {
			for (const value of ['', 'false', '1', 'yes', 'no']) {
				process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = value;
				expect(getUnsafeAiProviderBaseUrlReason('http://169.254.169.254/')).not.toBeNull();
			}
			// Case and surrounding whitespace do not change an operator's evident intent.
			process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = ' TRUE ';
			expect(getUnsafeAiProviderBaseUrlReason('http://169.254.169.254/')).toBeNull();
		});
	});

	describe('getUnsafeAiOutboundUrlReason (request time)', () => {
		beforeEach(() => {
			delete process.env[ALLOW_PRIVATE_BASE_URLS_ENV];
		});

		it('allows a query string, which providers legitimately build (Deepgram)', () => {
			expect(getUnsafeAiOutboundUrlReason('https://api.deepgram.com/v1/listen?model=nova-3')).toBeNull();
		});

		it('still refuses an internal host with a query string', () => {
			expect(getUnsafeAiOutboundUrlReason('http://169.254.169.254/latest/meta-data/?x=1')).not.toBeNull();
		});
	});

	describe('isPrivateAiProviderEndpointAllowed (who chose the address)', () => {
		beforeEach(() => {
			delete process.env[ALLOW_PRIVATE_BASE_URLS_ENV];
		});

		it('keeps a TENANT-supplied base URL default-deny, and honours the deployment opt-in for it', () => {
			const tenant = { apiKey: '', baseUrl: 'http://localhost:8000/v1', source: 'tenant' as const };
			expect(isPrivateAiProviderEndpointAllowed(tenant)).toBe(false);

			process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = 'true';
			expect(isPrivateAiProviderEndpointAllowed(tenant)).toBe(true);
		});

		it.each([
			[
				'an operator `*_BASE_URL` (environment source)',
				{ apiKey: 'k', baseUrl: 'http://10.0.0.5/v1', source: 'environment' }
			],
			['a platform credential', { apiKey: 'k', baseUrl: 'http://10.0.0.5/v1', source: 'platform' }],
			['a tenant row with NO base URL (built-in default address)', { apiKey: '', source: 'tenant' }],
			['a tenant row with a blank base URL', { apiKey: '', baseUrl: '   ', source: 'tenant' }]
		])('allows %s without the opt-in — none of it is tenant input', (_label, credentials) => {
			expect(isPrivateAiProviderEndpointAllowed(credentials as never)).toBe(true);
		});

		it('falls back to the deployment flag when there are no credentials to vouch for the address', () => {
			expect(isPrivateAiProviderEndpointAllowed(null)).toBe(false);
			process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = 'true';
			expect(isPrivateAiProviderEndpointAllowed(null)).toBe(true);
		});
	});

	describe('ssrfSafeFetch (delivery time)', () => {
		const realFetch = global.fetch;
		afterEach(() => {
			global.fetch = realFetch;
		});

		const okFetch = () => {
			const mock = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
			global.fetch = mock as unknown as typeof fetch;
			return mock;
		};

		/** A resolver that never touches the network. */
		const resolvesTo = (...addresses: string[]) => jest.fn().mockResolvedValue(addresses);

		beforeEach(() => {
			delete process.env[ALLOW_PRIVATE_BASE_URLS_ENV];
		});

		it('performs a request to a public host and refuses to follow redirects', async () => {
			const mock = okFetch();

			await expect(
				ssrfSafeFetch(
					'https://llm.example.com/v1/models',
					{ headers: { accept: 'application/json' } },
					{
						resolver: resolvesTo('93.184.216.34')
					}
				)
			).resolves.toBeInstanceOf(Response);

			expect(mock).toHaveBeenCalledTimes(1);
			const [, init] = mock.mock.calls[0];
			// `redirect: 'follow'` is undici's default, so a public host answering 302 with an internal
			// Location would otherwise be followed with no second check.
			expect(init.redirect).toBe('error');
			expect(init.headers).toEqual({ accept: 'application/json' });
		});

		it('refuses a literal internal address before any request is made', async () => {
			const mock = okFetch();
			const resolver = resolvesTo('169.254.169.254');

			await expect(
				ssrfSafeFetch('http://169.254.169.254/latest/meta-data/', undefined, { resolver })
			).rejects.toThrow(SsrfBlockedError);

			expect(mock).not.toHaveBeenCalled();
			expect(resolver).not.toHaveBeenCalled();
		});

		it('refuses a PUBLIC-LOOKING host that resolves to an internal address (DNS rebinding)', async () => {
			const mock = okFetch();

			await expect(
				ssrfSafeFetch('https://totally-public.example.com/v1/models', undefined, {
					resolver: resolvesTo('10.1.2.3')
				})
			).rejects.toThrow(SsrfBlockedError);

			expect(mock).not.toHaveBeenCalled();
		});

		it('refuses when ANY resolved address is internal, not just the first', async () => {
			const mock = okFetch();

			await expect(
				ssrfSafeFetch('https://split-horizon.example.com/v1/models', undefined, {
					resolver: resolvesTo('93.184.216.34', '127.0.0.1')
				})
			).rejects.toThrow(SsrfBlockedError);

			expect(mock).not.toHaveBeenCalled();
		});

		it('names neither the host nor the resolved address in the error it raises', async () => {
			okFetch();

			await expect(
				ssrfSafeFetch('https://marker.example.com/v1/models', undefined, { resolver: resolvesTo('10.1.2.3') })
			).rejects.toThrow(/does not|not allowed|non-public/i);

			await ssrfSafeFetch('https://marker.example.com/v1/models', undefined, {
				resolver: resolvesTo('10.1.2.3')
			}).catch((error: Error) => {
				expect(error.message).not.toContain('10.1.2.3');
				expect(error.message).not.toContain('marker.example.com');
			});
		});

		it('lets a host that DEFINITIVELY does not exist through the guard (there is nothing to connect to)', async () => {
			// `fetch` then fails on its own lookup with the "could not be reached" message a self-hoster
			// can act on, instead of a security-shaped refusal for a typo.
			const mock = okFetch();
			const resolver = jest
				.fn()
				.mockRejectedValue(
					Object.assign(new Error('getaddrinfo ENOTFOUND nowhere.example.com'), { code: 'ENOTFOUND' })
				);

			await expect(
				ssrfSafeFetch('https://nowhere.example.com/v1/models', undefined, { resolver })
			).resolves.toBeInstanceOf(Response);
			expect(mock).toHaveBeenCalledTimes(1);
		});

		it.each([
			['a temporary resolver failure', Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' })],
			['a refused resolver', Object.assign(new Error('queryA ECONNREFUSED'), { code: 'ECONNREFUSED' })],
			['an error with no code at all', new Error('resolver exploded')]
		])('fails CLOSED on %s — no verdict is not a public verdict', async (_label, failure) => {
			const mock = okFetch();
			const resolver = jest.fn().mockRejectedValue(failure);

			await expect(ssrfSafeFetch('https://flaky.example.com/v1/models', undefined, { resolver })).rejects.toThrow(
				SsrfBlockedError
			);
			expect(mock).not.toHaveBeenCalled();
		});

		it('re-resolves on every request instead of reusing an earlier public verdict', async () => {
			// The rebinding shape: public for the first request, internal for the next one.
			const mock = okFetch();
			lookupMock
				.mockImplementationOnce((_host: string, _options: unknown, callback: LookupCallback) =>
					callback(null, [{ address: '93.184.215.14', family: 4 }])
				)
				.mockImplementationOnce((_host: string, _options: unknown, callback: LookupCallback) =>
					callback(null, [{ address: '169.254.169.254', family: 4 }])
				);

			await expect(ssrfSafeFetch('https://rebind.example.com/v1/models')).resolves.toBeInstanceOf(Response);
			await expect(ssrfSafeFetch('https://rebind.example.com/v1/models')).rejects.toThrow(SsrfBlockedError);

			expect(lookupMock).toHaveBeenCalledTimes(2);
			expect(mock).toHaveBeenCalledTimes(1);
		});

		it('gives up on a stalled lookup when the request signal aborts, reporting the abort rather than a refusal', async () => {
			const mock = okFetch();
			const resolver = jest.fn().mockReturnValue(new Promise<string[]>(() => undefined));
			const controller = new AbortController();
			const reason = Object.assign(new Error('The operation was aborted due to timeout'), {
				name: 'TimeoutError'
			});

			const pending = ssrfSafeFetch(
				'https://slow-dns.example.com/v1/models',
				{ signal: controller.signal },
				{
					resolver
				}
			);
			controller.abort(reason);

			await expect(pending).rejects.toBe(reason);
			expect(mock).not.toHaveBeenCalled();
		});

		it('does not resolve a public IP literal — the literal check already judged it', async () => {
			const mock = okFetch();
			const resolver = resolvesTo('10.0.0.1');

			await expect(
				ssrfSafeFetch('https://93.184.215.14/v1/models', undefined, { resolver })
			).resolves.toBeInstanceOf(Response);
			expect(resolver).not.toHaveBeenCalled();
			expect(mock).toHaveBeenCalledTimes(1);
		});

		it('skips the resolve-then-check entirely on an opted-in deployment', async () => {
			process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = 'true';
			const mock = okFetch();
			const resolver = resolvesTo('127.0.0.1');

			await expect(
				ssrfSafeFetch('http://localhost:8080/v1/models', undefined, { resolver })
			).resolves.toBeInstanceOf(Response);
			expect(mock).toHaveBeenCalledTimes(1);
			expect(resolver).not.toHaveBeenCalled();
		});
	});

	/**
	 * Chat completions and embeddings reach the stored base URL through the AI SDK's own `fetch`, not
	 * through the catalogue or speech helpers. Without this guard a tenant base URL on a wildcard-DNS
	 * name (`169.254.169.254.nip.io`) passed every literal check and was requested on each chat turn.
	 */
	describe('createAiProviderSdkFetch (chat and embedding sinks)', () => {
		const realFetch = global.fetch;
		afterEach(() => {
			global.fetch = realFetch;
		});
		beforeEach(() => {
			delete process.env[ALLOW_PRIVATE_BASE_URLS_ENV];
		});

		const okFetch = () => {
			const mock = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
			global.fetch = mock as unknown as typeof fetch;
			return mock;
		};

		it.each([
			[
				'an operator environment credential',
				{ apiKey: 'k', baseUrl: 'http://10.0.0.5/v1', source: 'environment' }
			],
			['a platform credential', { apiKey: 'k', baseUrl: 'http://10.0.0.5/v1', source: 'platform' }],
			['a tenant key that uses the vendor host', { apiKey: 'k', source: 'tenant' }],
			['a tenant key with a blank base URL', { apiKey: 'k', baseUrl: '  ', source: 'tenant' }]
		] as const)('leaves %s on the SDK default transport', (_label, credentials) => {
			expect(createAiProviderSdkFetch(credentials)).toBeUndefined();
			expect(createAiProviderSdkFetch(null)).toBeUndefined();
		});

		it('refuses a tenant base URL whose public-looking host resolves to an internal address', async () => {
			const mock = okFetch();
			const sdkFetch = createAiProviderSdkFetch(
				{ apiKey: 'k', baseUrl: 'http://169.254.169.254.nip.io/v1', source: 'tenant' },
				{ resolver: jest.fn().mockResolvedValue(['169.254.169.254']) }
			);

			expect(sdkFetch).toBeDefined();
			await expect(
				sdkFetch!('http://169.254.169.254.nip.io/v1/chat/completions', { method: 'POST', body: '{}' })
			).rejects.toThrow(SsrfBlockedError);
			expect(mock).not.toHaveBeenCalled();
		});

		it('passes a public tenant request through unchanged except that redirects are refused', async () => {
			const mock = okFetch();
			const sdkFetch = createAiProviderSdkFetch(
				{ apiKey: 'k', baseUrl: 'https://llm.example.com/v1', source: 'tenant' },
				{ resolver: jest.fn().mockResolvedValue(['93.184.216.34']) }
			);

			await expect(
				sdkFetch!('https://llm.example.com/v1/chat/completions', {
					method: 'POST',
					headers: { authorization: 'Bearer k' },
					body: '{"stream":true}'
				})
			).resolves.toBeInstanceOf(Response);

			expect(mock).toHaveBeenCalledTimes(1);
			const [url, init] = mock.mock.calls[0];
			expect(url).toBe('https://llm.example.com/v1/chat/completions');
			expect(init).toEqual({
				method: 'POST',
				headers: { authorization: 'Bearer k' },
				body: '{"stream":true}',
				redirect: 'error'
			});
		});

		it('judges a Request object by its own URL', async () => {
			const mock = okFetch();
			const sdkFetch = createAiProviderSdkFetch({
				apiKey: 'k',
				baseUrl: 'https://llm.example.com/v1',
				source: 'tenant'
			});

			await expect(sdkFetch!(new Request('http://127.0.0.1:8080/v1/embeddings'))).rejects.toThrow(
				SsrfBlockedError
			);
			expect(mock).not.toHaveBeenCalled();
		});

		it('lets a tenant use a private endpoint only on a deployment that opted in', async () => {
			const mock = okFetch();
			const credentials = { apiKey: '', baseUrl: 'http://localhost:11434/v1', source: 'tenant' } as const;

			await expect(
				createAiProviderSdkFetch(credentials)!('http://localhost:11434/v1/chat/completions')
			).rejects.toThrow(SsrfBlockedError);
			expect(mock).not.toHaveBeenCalled();

			process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = 'true';
			await expect(
				createAiProviderSdkFetch(credentials)!('http://localhost:11434/v1/chat/completions')
			).resolves.toBeInstanceOf(Response);
			expect(mock).toHaveBeenCalledTimes(1);
		});
	});
});
