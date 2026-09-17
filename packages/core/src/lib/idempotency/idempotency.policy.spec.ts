import { createHash } from 'node:crypto';
import { IdempotencyOutcome } from '@gauzy/contracts';
import {
	IDEMPOTENCY_KEY_HEADER,
	IDEMPOTENCY_REPLAYED_HEADER,
	MAX_IDEMPOTENCY_KEY_LENGTH,
	MAX_STORED_RESPONSE_BYTES,
	MIN_IDEMPOTENCY_KEY_LENGTH,
	buildRequestHash,
	canonicalizeQuery,
	clampRetentionSeconds,
	hashPrefix,
	isSafeMethod,
	isValidIdempotencyKey,
	normalizeIdempotencyKey,
	planIdempotentRequest,
	serializeResponseForStorage,
	stableStringify
} from './idempotency.policy';

/**
 * The retry-safety decisions, asserted without a database or a request.
 *
 * `planIdempotentRequest` is called twice per request — once to decide whether the work may run at
 * all, once with the kernel's answer — and every branch of it is a decision about the *request*: run
 * it, replay what the first attempt returned, tell the caller to come back, refuse the key, or demand
 * one. The cases below are those decisions, plus the two fingerprints the whole mechanism rests on:
 * the key's identity and the request hash that decides whether a repeat is the same request.
 */

describe('the request plan', () => {
	it('ignores a key on a read, because a read cannot duplicate anything', () => {
		// Refusing would break a client that sets the header unconditionally on every call it makes.
		expect(isSafeMethod('GET')).toBe(true);
		expect(isSafeMethod('head')).toBe(true);
		expect(isSafeMethod('OPTIONS')).toBe(true);
		expect(isSafeMethod('POST')).toBe(false);
		expect(isSafeMethod(undefined)).toBe(false);
		expect(planIdempotentRequest({ method: 'GET', key: 'key-1234', required: true })).toEqual({ action: 'SKIP' });
	});

	it('demands a key only when the route says it cannot be retried safely without one', () => {
		expect(planIdempotentRequest({ method: 'POST', required: true })).toEqual({ action: 'REQUIRE_KEY' });
		expect(planIdempotentRequest({ method: 'POST' })).toEqual({ action: 'SKIP' });
		// A header of whitespace is not a key, so it is treated exactly as an absent one.
		expect(planIdempotentRequest({ method: 'POST', key: '   ', required: true })).toEqual({ action: 'REQUIRE_KEY' });
	});

	it('refuses a key that is too short to be unique or too long to be stored whole', () => {
		// A key the column truncates would silently merge two different keys into one.
		expect(planIdempotentRequest({ method: 'POST', key: 'a'.repeat(MIN_IDEMPOTENCY_KEY_LENGTH - 1) })).toEqual({
			action: 'INVALID_KEY',
			reason: 'too-short'
		});
		expect(planIdempotentRequest({ method: 'POST', key: 'a'.repeat(MAX_IDEMPOTENCY_KEY_LENGTH + 1) })).toEqual({
			action: 'INVALID_KEY',
			reason: 'too-long'
		});
		expect(isValidIdempotencyKey('a'.repeat(MIN_IDEMPOTENCY_KEY_LENGTH))).toBe(true);
		expect(isValidIdempotencyKey('a'.repeat(MAX_IDEMPOTENCY_KEY_LENGTH))).toBe(true);
		expect(isValidIdempotencyKey('short')).toBe(false);
	});

	it('reads the key off the header the way the transport presents it', () => {
		// Express hands a repeated header over as an array, and a header may legally carry padding.
		expect(normalizeIdempotencyKey('  key-1234  ')).toBe('key-1234');
		expect(normalizeIdempotencyKey(['key-1234', 'key-5678'])).toBe('key-1234');
		expect(normalizeIdempotencyKey(42)).toBeNull();
		expect(normalizeIdempotencyKey('')).toBeNull();
		expect(planIdempotentRequest({ method: 'POST', key: [' key-1234 '] })).toEqual({ action: 'EXECUTE' });
	});

	it('runs the work when the kernel granted the claim, or when there is no answer yet', () => {
		expect(planIdempotentRequest({ method: 'POST', key: 'key-1234' })).toEqual({ action: 'EXECUTE' });
		expect(planIdempotentRequest({ method: 'POST', key: 'key-1234', claim: { outcome: IdempotencyOutcome.CLAIMED } })).toEqual({
			action: 'EXECUTE'
		});
	});

	it('replays the stored response, with the status it was stored under', () => {
		expect(
			planIdempotentRequest({
				method: 'POST',
				key: 'key-1234',
				claim: {
					outcome: IdempotencyOutcome.REPLAYED,
					response: { status: 201, body: { id: 'order-1' } },
					record: { requestHash: 'aaaaaaaa11111111', createdAt: new Date('2026-03-01T10:00:00Z') }
				}
			})
		).toEqual({
			action: 'REPLAY',
			status: 201,
			body: { id: 'order-1' },
			replayedAt: '2026-03-01T10:00:00.000Z'
		});
		// A stored row that recorded no status is replayed as a plain success rather than as a 0.
		expect(planIdempotentRequest({ method: 'POST', key: 'key-1234', claim: { outcome: IdempotencyOutcome.REPLAYED } })).toMatchObject({
			action: 'REPLAY',
			status: 200
		});
	});

	it('tells a caller holding a live claim when to come back', () => {
		expect(
			planIdempotentRequest({ method: 'POST', key: 'key-1234', claim: { outcome: IdempotencyOutcome.IN_FLIGHT, retryAfterMs: 4000 } })
		).toEqual({ action: 'IN_FLIGHT', retryAfterMs: 4000 });
		// A negative or absent wait is reported as zero rather than as a wait in the past.
		expect(
			planIdempotentRequest({ method: 'POST', key: 'key-1234', claim: { outcome: IdempotencyOutcome.IN_FLIGHT, retryAfterMs: -50 } })
		).toEqual({ action: 'IN_FLIGHT', retryAfterMs: 0 });
	});

	it('refuses a key reused for a different request, and says so without printing either body', () => {
		const plan = planIdempotentRequest({
			method: 'POST',
			key: 'key-1234',
			requestHash: 'ffffffff00000000',
			claim: { outcome: IdempotencyOutcome.REUSED_KEY, record: { requestHash: 'aaaaaaaa11111111' } }
		});

		expect(plan).toEqual({
			action: 'REUSED_KEY',
			expectedHashPrefix: 'aaaaaaaa',
			actualHashPrefix: 'ffffffff'
		});
		// Only a prefix travels: enough to tell two bodies apart in a bug report, useless for
		// reconstructing either of them.
		expect(hashPrefix('aaaaaaaa11111111').length).toBe(8);
		expect(hashPrefix(undefined)).toBe('');
	});

	it('never runs the work twice when the kernel answers with something this build does not know', () => {
		// Control: the tempting default for an unrecognised outcome is "carry on and execute", which is
		// the one answer that could book the same thing twice.
		expect(
			planIdempotentRequest({ method: 'POST', key: 'key-1234', claim: { outcome: 'SOMETHING_NEW' as IdempotencyOutcome } })
		).toEqual({ action: 'IN_FLIGHT', retryAfterMs: 0 });
	});
});

describe('the identity of a request', () => {
	it('serializes an object in a stable key order, whatever order it was built in', () => {
		// A retry re-sends the same body, but a client that rebuilds its JSON — or a proxy that
		// reorders keys — must still produce the same text, or the retry looks like a different request.
		expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
		expect(stableStringify({ a: [1, { d: 4, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":4}]}');
		expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
		expect(stableStringify(new Date('2026-03-01T10:00:00Z'))).toBe('"2026-03-01T10:00:00.000Z"');
		expect(stableStringify(null)).toBe('null');
	});

	it('canonicalizes the query string, because two parameter orders are one request', () => {
		expect(canonicalizeQuery(undefined)).toBe('');
		expect(canonicalizeQuery(null)).toBe('');
		expect(canonicalizeQuery('page=2&limit=10')).toBe('page=2&limit=10');
		expect(canonicalizeQuery({ page: 2, limit: 10 })).toBe(canonicalizeQuery({ limit: 10, page: 2 }));
	});

	it('hashes the method, the path and the body into one hex digest', () => {
		const hash = buildRequestHash({ method: 'post', path: '/api/orders', body: { sku: 'A' } });

		expect(hash).toMatch(/^[0-9a-f]{64}$/);
		expect(hash).toBe(
			createHash('sha256')
				.update(JSON.stringify(['POST', '/api/orders', '', '{"sku":"A"}']))
				.digest('hex')
		);
	});

	it('gives the same request the same hash however its body was spelled', () => {
		// The property the whole mechanism rests on: a rebuilt retry must be recognised as a retry.
		expect(buildRequestHash({ method: 'POST', path: '/api/orders', body: { a: 1, b: 2 } })).toBe(
			buildRequestHash({ method: 'POST', path: '/api/orders', body: { b: 2, a: 1 } })
		);
		expect(buildRequestHash({ method: 'POST', path: '/api/orders', query: { page: 1, limit: 20 }, body: {} })).toBe(
			buildRequestHash({ method: 'POST', path: '/api/orders', query: { limit: 20, page: 1 }, body: {} })
		);
	});

	it('gives a different request a different hash, in each of the four dimensions', () => {
		// Control: a hash that ignored any of these would answer a question the caller never asked.
		const base = { method: 'POST', path: '/api/orders', query: { page: 1 }, body: { sku: 'A' } };
		const hash = buildRequestHash(base);

		expect(buildRequestHash({ ...base, method: 'PUT' })).not.toBe(hash);
		expect(buildRequestHash({ ...base, path: '/api/carts' })).not.toBe(hash);
		expect(buildRequestHash({ ...base, query: { page: 2 } })).not.toBe(hash);
		expect(buildRequestHash({ ...base, body: { sku: 'B' } })).not.toBe(hash);
	});

	it('prefers the raw body the client actually sent over the parsed one', () => {
		// The parsed body has already lost the caller's spelling; the raw bytes have not.
		const raw = '{"sku":"A",  "note":"  spaced  "}';

		expect(buildRequestHash({ method: 'POST', path: '/api/orders', rawBody: raw, body: { sku: 'A' } })).toBe(
			buildRequestHash({ method: 'POST', path: '/api/orders', rawBody: raw, body: { sku: 'ignored' } })
		);
		expect(buildRequestHash({ method: 'POST', path: '/api/orders', rawBody: Buffer.from(raw, 'utf8') })).toBe(
			buildRequestHash({ method: 'POST', path: '/api/orders', rawBody: raw })
		);
	});
});

describe('what is kept for a replay', () => {
	it('stores a body that fits, and drops one that does not rather than truncating it', () => {
		expect(serializeResponseForStorage({ id: 'order-1' })).toEqual({ stored: { id: 'order-1' }, dropped: false });
		expect(serializeResponseForStorage(undefined)).toEqual({ dropped: false });
		expect(serializeResponseForStorage(null)).toEqual({ dropped: false });

		// Half a JSON document cannot be replayed, and a caller that received half of one could not
		// tell that it had.
		const tooLarge = { note: 'x'.repeat(MAX_STORED_RESPONSE_BYTES) };
		expect(serializeResponseForStorage(tooLarge)).toEqual({ dropped: true });
	});

	it('drops a body that cannot be serialized at all, because it could not be replayed either', () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;

		expect(serializeResponseForStorage(circular)).toEqual({ dropped: true });
	});

	it('round-trips the stored body so a replay is byte-for-byte what the client first saw', () => {
		const body = { id: 'order-1', lines: [{ sku: 'A', quantity: '2.000000' }] };

		expect(serializeResponseForStorage(body).stored).toEqual(body);
	});
});

describe('the retention window', () => {
	it('clamps a per-route override to the window the platform supports', () => {
		expect(clampRetentionSeconds(0)).toBe(60);
		expect(clampRetentionSeconds(90)).toBe(90);
		expect(clampRetentionSeconds(90.7)).toBe(90);
		expect(clampRetentionSeconds(7 * 24 * 60 * 60 * 2)).toBe(7 * 24 * 60 * 60);
	});

	it('reports no override when none was asked for', () => {
		expect(clampRetentionSeconds(undefined)).toBeUndefined();
		expect(clampRetentionSeconds(Number.NaN)).toBeUndefined();
		expect(clampRetentionSeconds(Number.POSITIVE_INFINITY)).toBeUndefined();
	});
});

describe('the header names', () => {
	it('states the names the transport contract fixes', () => {
		expect(IDEMPOTENCY_KEY_HEADER).toBe('idempotency-key');
		expect(IDEMPOTENCY_REPLAYED_HEADER).toBe('Idempotency-Replayed');
	});
});
