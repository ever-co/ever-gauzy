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
import { EmbedTokenController } from './embed.controller';
import { generateEmbedCredential } from './embed.utils';

/**
 * `POST /embed/token` is limited per credential, 600 exchanges a minute: a host's backend exchanges one credential for
 * every member it serves, all from its own address. A request without a well-formed credential is limited per address,
 * 60 a minute, as before. Counted through the global guard as `AppModule` registers it, on the controller's own route.
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
	it('counts a well-formed credential in a bucket named by its SHA-256, never by the credential', () => {
		const { credential } = credentialOf();
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

	it('lets one credential exchange 600 times a minute from one address, and throttles the 601st', async () => {
		const guard = await throttler();
		const host = exchangeFrom(HOST_ADDRESS, credentialOf());

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
		const first = exchangeFrom(HOST_ADDRESS, credentialOf());
		const second = exchangeFrom(HOST_ADDRESS, credentialOf());

		expect(await accepted(guard, first, 601)).toBe(EMBED_EXCHANGE_LIMIT_PER_CREDENTIAL);

		expect(await accepted(guard, second, 1)).toBe(1);
		expect(await accepted(guard, exchangeFrom(HOST_ADDRESS, {}), 1)).toBe(1);
	});
});
