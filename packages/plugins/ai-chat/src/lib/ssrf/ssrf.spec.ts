import { BadRequestException } from '@nestjs/common';
import {
	ALLOW_PRIVATE_BASE_URLS_ENV,
	getUnsafeAiOutboundUrlReason,
	getUnsafeAiProviderBaseUrlReason,
	SsrfBlockedError,
	ssrfSafeFetch
} from './index';
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
			['cloud metadata with a trailing `?` that would swallow the appended path', 'http://169.254.169.254/latest/meta-data/?'],
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
				ssrfSafeFetch('https://llm.example.com/v1/models', { headers: { accept: 'application/json' } }, {
					resolver: resolvesTo('93.184.216.34')
				})
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

		it('lets an unresolvable host through to fetch, which fails on the same resolution', async () => {
			// A lookup ERROR is not a verdict of "private": failing closed here would turn every
			// resolver hiccup into a security-shaped message, and the request cannot connect either way.
			const mock = okFetch();
			const resolver = jest.fn().mockRejectedValue(Object.assign(new Error('getaddrinfo ENOTFOUND'), {}));

			await expect(
				ssrfSafeFetch('https://nowhere.example.com/v1/models', undefined, { resolver })
			).resolves.toBeInstanceOf(Response);
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
});
