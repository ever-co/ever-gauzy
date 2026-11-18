import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import { ThrottlerBehindProxyGuard } from '../throttler/throttler-behind-proxy.guard';
import {
	EMBED_CREDENTIAL_THROTTLER_TRACKER_PREFIX,
	EMBED_EXCHANGE_LIMIT_PER_ADDRESS,
	EMBED_EXCHANGE_LIMIT_PER_CREDENTIAL,
	embedExchangeLimit,
	embedExchangeTracker
} from './embed-exchange-throttle';
import { EMBED_ACCEPTED_CREDENTIAL_TTL_MS, recentlyAcceptedEmbedCredentials } from './embed-exchange-failures';
import { EmbedTokenController } from './embed.controller';
import { generateEmbedCredential, hashEmbedCredential } from './embed.utils';

/**
 * `POST /embed/token` is limited per credential, 600 exchanges a minute, once this instance accepted the credential: a
 * host's backend exchanges one credential for every member it serves, all from its own address. Anything else (no
 * well-formed credential, or one this instance has not accepted: made-up ones) is limited per address, 60 a minute, so
 * made-up credentials neither get a fresh budget each nor a storage entry each. Counted through the global guard as
 * `AppModule` registers it, on the controller's own route.
 */

const HOST_ADDRESS = '203.0.113.7';

/** The installation-wide default, lower than both limits, to show the route's own limits replace it. */
const DEFAULT_LIMIT = 10;

/** The context the global throttler sees for an exchange from `address` with `body`. */
function exchangeFrom(address: string, body: unknown): ExecutionContext {
	const request = { ip: address, headers: {}, body };
	const response = { header: () => undefined };
	return {
		getType: () => 'http',
		getHandler: () => EmbedTokenController.prototype.exchange,
		getClass: () => EmbedTokenController,
		switchToHttp: () => ({ getRequest: () => request, getResponse: () => response })
	} as unknown as ExecutionContext;
}

/** The global throttler, with a store of its own. */
async function throttler(): Promise<ThrottlerBehindProxyGuard> {
	const guard = new ThrottlerBehindProxyGuard(
		{ throttlers: [{ ttl: 60_000, limit: DEFAULT_LIMIT }] },
		new ThrottlerStorageService(),
		new Reflector()
	);
	await guard.onModuleInit();
	return guard;
}

/** Sends `times` exchanges and answers how many got through before the first 429. */
async function accepted(guard: ThrottlerBehindProxyGuard, context: ExecutionContext, times: number): Promise<number> {
	for (let sent = 0; sent < times; sent++) {
		try {
			await guard.canActivate(context);
		} catch (error) {
			expect(error).toBeInstanceOf(ThrottlerException);
			expect((error as ThrottlerException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
			return sent;
		}
	}
	return times;
}

const credentialOf = () => ({ credential: generateEmbedCredential().secret });

/** A credential this instance accepted, as a successful exchange records it. */
const acceptedCredentialOf = () => {
	const body = credentialOf();
	recentlyAcceptedEmbedCredentials.record(hashEmbedCredential(body.credential));
	return body;
};

/** Bodies without a well-formed credential: none, a missing field, a wrong prefix, a wrong length, not a string. */
const MALFORMED_BODIES: unknown[] = [
	undefined,
	{},
	{ credential: `gzx_${'a'.repeat(43)}` },
	{ credential: `gze_${'a'.repeat(42)}` },
	{ credential: 42 },
	{ credential: [generateEmbedCredential().secret] }
];

describe('embed exchange rate limit', () => {
	it('counts an accepted credential in a bucket named by its SHA-256, never by the credential', () => {
		const { credential } = acceptedCredentialOf();
		const context = exchangeFrom(HOST_ADDRESS, { credential });

		const tracker = embedExchangeTracker({ ip: HOST_ADDRESS, headers: {}, body: { credential } });

		const digest = createHash('sha256').update(credential, 'utf8').digest('hex');
		expect(tracker).toBe(`${EMBED_CREDENTIAL_THROTTLER_TRACKER_PREFIX}${digest}`);
		expect(tracker).not.toContain(credential.slice(4));
		expect(embedExchangeLimit(context)).toBe(EMBED_EXCHANGE_LIMIT_PER_CREDENTIAL);
	});

	it('counts a request without a well-formed credential by its address', () => {
		for (const body of MALFORMED_BODIES) {
			const context = exchangeFrom(HOST_ADDRESS, body);

			expect(embedExchangeTracker({ ip: HOST_ADDRESS, headers: {}, body })).toBe(HOST_ADDRESS);
			expect(embedExchangeLimit(context)).toBe(EMBED_EXCHANGE_LIMIT_PER_ADDRESS);
		}
	});

	it('counts a well-formed credential this instance has not accepted by its address, 60 a minute', async () => {
		const guard = await throttler();
		const madeUp = () => exchangeFrom(HOST_ADDRESS, credentialOf());

		expect(embedExchangeTracker({ ip: HOST_ADDRESS, headers: {}, body: credentialOf() })).toBe(HOST_ADDRESS);
		expect(embedExchangeLimit(madeUp())).toBe(EMBED_EXCHANGE_LIMIT_PER_ADDRESS);

		let sent = 0;
		for (let attempt = 0; attempt < EMBED_EXCHANGE_LIMIT_PER_ADDRESS + 5; attempt++) {
			sent += await accepted(guard, madeUp(), 1);
		}
		expect(sent).toBe(EMBED_EXCHANGE_LIMIT_PER_ADDRESS);
		// An accepted credential from the same address keeps its own budget.
		expect(await accepted(guard, exchangeFrom(HOST_ADDRESS, acceptedCredentialOf()), 1)).toBe(1);
	});

	it('decides the limit and the bucket of a request once, even if the acceptance expires in between', () => {
		const now = 1_800_000_000_000;
		const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
		try {
			const { credential } = acceptedCredentialOf();
			const request = { ip: HOST_ADDRESS, headers: {}, body: { credential } };
			const context = {
				switchToHttp: () => ({ getRequest: () => request })
			} as unknown as ExecutionContext;

			clock.mockReturnValue(now + EMBED_ACCEPTED_CREDENTIAL_TTL_MS - 1);
			expect(embedExchangeLimit(context)).toBe(EMBED_EXCHANGE_LIMIT_PER_CREDENTIAL);
			clock.mockReturnValue(now + EMBED_ACCEPTED_CREDENTIAL_TTL_MS);
			expect(embedExchangeTracker(request)).toMatch(new RegExp(`^${EMBED_CREDENTIAL_THROTTLER_TRACKER_PREFIX}`));

			// A new request after the expiry is counted by its address.
			expect(embedExchangeTracker({ ...request })).toBe(HOST_ADDRESS);
		} finally {
			clock.mockRestore();
		}
	});

	it('lets one credential exchange 600 times a minute from one address, and throttles the 601st', async () => {
		const guard = await throttler();
		const host = exchangeFrom(HOST_ADDRESS, acceptedCredentialOf());

		expect(await accepted(guard, host, 61)).toBe(61);
		expect(await accepted(guard, host, 539)).toBe(539);
		expect(await accepted(guard, host, 1)).toBe(0);
	});

	it('throttles an address after 60 requests without a well-formed credential, whatever their shape', async () => {
		const guard = await throttler();
		let sent = 0;
		for (const body of MALFORMED_BODIES) {
			sent += await accepted(guard, exchangeFrom(HOST_ADDRESS, body), 10);
		}

		expect(sent).toBe(EMBED_EXCHANGE_LIMIT_PER_ADDRESS);
		expect(await accepted(guard, exchangeFrom(HOST_ADDRESS, {}), 1)).toBe(0);
		// CONTROL: another address has spent nothing.
		expect(await accepted(guard, exchangeFrom('198.51.100.9', {}), 1)).toBe(1);
	});

	it('gives two credentials from one address separate budgets, apart from the address', async () => {
		const guard = await throttler();
		const first = exchangeFrom(HOST_ADDRESS, acceptedCredentialOf());
		const second = exchangeFrom(HOST_ADDRESS, acceptedCredentialOf());

		expect(await accepted(guard, first, 601)).toBe(EMBED_EXCHANGE_LIMIT_PER_CREDENTIAL);

		expect(await accepted(guard, second, 1)).toBe(1);
		expect(await accepted(guard, exchangeFrom(HOST_ADDRESS, {}), 1)).toBe(1);
	});
});
