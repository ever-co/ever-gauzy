import { isRateLimitError, rateLimitRetryAfter, buildRateLimitEnvelope, RATE_LIMIT_CODE } from './rate-limit';

/**
 * A 429 arrives in three genuinely different shapes, and the free tier depends on recognizing all of
 * them — so each is pinned here rather than trusted to a single `statusCode` check.
 */
describe('rate-limit classification', () => {
	describe('isRateLimitError', () => {
		it('detects a plain APICallError-shaped 429', () => {
			expect(isRateLimitError({ statusCode: 429, message: 'Too Many Requests' })).toBe(true);
		});

		it('detects it via `status` as well as `statusCode`', () => {
			expect(isRateLimitError({ status: 429 })).toBe(true);
		});

		it('unwraps a RetryError, which is what actually reaches onError', () => {
			// streamText flags 429 as retryable and retries it, so the original error ends up nested.
			const inner = { statusCode: 429, message: 'rate limited' };
			expect(isRateLimitError({ name: 'RetryError', lastError: inner, errors: [inner] })).toBe(true);
		});

		it('unwraps through `cause`', () => {
			expect(isRateLimitError(Object.assign(new Error('wrapped'), { cause: { statusCode: 429 } }))).toBe(true);
		});

		it('detects an in-stream 429 delivered on an HTTP 200 (OpenRouter does this)', () => {
			// No statusCode and no headers at all — only a code in the body.
			expect(isRateLimitError({ error: { code: 429, message: 'Rate limit exceeded' } })).toBe(true);
		});

		it('detects the nested data.error.code form', () => {
			expect(isRateLimitError({ data: { error: { code: 429 } } })).toBe(true);
		});

		it('does NOT classify other failures as rate limits', () => {
			expect(isRateLimitError({ statusCode: 500 })).toBe(false);
			expect(isRateLimitError({ statusCode: 401 })).toBe(false);
			expect(isRateLimitError(new Error('boom'))).toBe(false);
			expect(isRateLimitError(null)).toBe(false);
			expect(isRateLimitError(undefined)).toBe(false);
			expect(isRateLimitError('429')).toBe(false); // a bare string is not an error object
		});

		it('survives a self-referencing error without hanging', () => {
			const cyclic: Record<string, unknown> = { statusCode: 500 };
			cyclic['cause'] = cyclic;
			expect(isRateLimitError(cyclic)).toBe(false);
		});
	});

	describe('rateLimitRetryAfter', () => {
		it('reads retry-after (headers arrive lowercased)', () => {
			expect(rateLimitRetryAfter({ statusCode: 429, responseHeaders: { 'retry-after': '42' } })).toBe(42);
		});

		it('falls back to x-ratelimit-reset', () => {
			expect(rateLimitRetryAfter({ statusCode: 429, responseHeaders: { 'x-ratelimit-reset': '10' } })).toBe(10);
		});

		it('finds the header on a nested error', () => {
			expect(
				rateLimitRetryAfter({ lastError: { statusCode: 429, responseHeaders: { 'retry-after': '7' } } })
			).toBe(7);
		});

		it('returns undefined when the header is absent or not a number', () => {
			expect(rateLimitRetryAfter({ statusCode: 429 })).toBeUndefined();
			expect(rateLimitRetryAfter({ responseHeaders: { 'retry-after': 'soon' } })).toBeUndefined();
		});
	});

	describe('buildRateLimitEnvelope', () => {
		it('round-trips through JSON so the client can parse it out of the error channel', () => {
			const json = buildRateLimitEnvelope({
				code: RATE_LIMIT_CODE,
				providerId: 'openrouter',
				credentialSource: 'platform',
				retryAfterSeconds: 30
			});
			expect(JSON.parse(json)).toEqual({
				code: RATE_LIMIT_CODE,
				providerId: 'openrouter',
				credentialSource: 'platform',
				retryAfterSeconds: 30
			});
		});
	});
});
