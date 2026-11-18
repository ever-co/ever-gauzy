import {
	EMBED_ACCEPTED_CREDENTIAL_TTL_MS,
	EMBED_EXCHANGE_FAILURES_PER_ADDRESS,
	EMBED_EXCHANGE_FAILURE_WINDOW_MS,
	EMBED_EXCHANGE_MEMORY_MAX_ENTRIES,
	EmbedExchangeFailures
} from './embed-exchange-failures';
import { EmbedTokenController } from './embed.controller';

/**
 * Made-up well-formed credentials each get a budget of their own from the rate limiter, and each costs a lookup. An
 * instance counts the credentials it refused per address and, past 60 within a minute, answers that address 429
 * before any lookup, except with a credential it accepted recently. Its memory is bounded.
 */

const HOST = '203.0.113.7';
const OTHER_ADDRESS = '198.51.100.9';
const UNKNOWN = 'a'.repeat(64);
const GOOD = 'b'.repeat(64);

/** A counter on a clock the test moves. */
function counter() {
	let now = 1_800_000_000_000;
	const failures = new EmbedExchangeFailures(() => now);
	const advance = (ms: number) => {
		now += ms;
	};
	return { failures, advance };
}

function refuse(failures: EmbedExchangeFailures, address: string, times: number): void {
	for (let sent = 0; sent < times; sent++) {
		failures.recordFailure(address);
	}
}

describe('EmbedExchangeFailures', () => {
	it('caps an address at its 60th refused credential within the window, and no other address', () => {
		const { failures } = counter();

		refuse(failures, HOST, EMBED_EXCHANGE_FAILURES_PER_ADDRESS - 1);
		expect(failures.allows(HOST, UNKNOWN)).toBe(true);

		expect(failures.recordFailure(HOST)).toBe(true);
		expect(failures.allows(HOST, UNKNOWN)).toBe(false);
		expect(failures.allows(OTHER_ADDRESS, UNKNOWN)).toBe(true);
	});

	it('lets the address be looked up again once the window ends, and counts it afresh', () => {
		const { failures, advance } = counter();
		refuse(failures, HOST, EMBED_EXCHANGE_FAILURES_PER_ADDRESS);

		advance(EMBED_EXCHANGE_FAILURE_WINDOW_MS - 1);
		expect(failures.allows(HOST, UNKNOWN)).toBe(false);
		advance(1);
		expect(failures.allows(HOST, UNKNOWN)).toBe(true);

		refuse(failures, HOST, EMBED_EXCHANGE_FAILURES_PER_ADDRESS - 1);
		expect(failures.allows(HOST, UNKNOWN)).toBe(true);
		refuse(failures, HOST, 1);
		expect(failures.allows(HOST, UNKNOWN)).toBe(false);
	});

	it('lets a credential it accepted through the cap, until the acceptance expires', () => {
		const { failures, advance } = counter();
		failures.recordAccepted(GOOD);
		refuse(failures, HOST, EMBED_EXCHANGE_FAILURES_PER_ADDRESS);

		expect(failures.allows(HOST, GOOD)).toBe(true);
		expect(failures.allows(HOST, UNKNOWN)).toBe(false);

		advance(EMBED_ACCEPTED_CREDENTIAL_TTL_MS);
		refuse(failures, HOST, EMBED_EXCHANGE_FAILURES_PER_ADDRESS);
		expect(failures.allows(HOST, GOOD)).toBe(false);
	});

	it('remembers no more addresses than its bound, forgetting the oldest first', () => {
		const { failures } = counter();
		refuse(failures, HOST, EMBED_EXCHANGE_FAILURES_PER_ADDRESS);

		for (let address = 0; address < EMBED_EXCHANGE_MEMORY_MAX_ENTRIES + 500; address++) {
			failures.recordFailure(`address-${address}`);
		}

		expect(failures['windows'].size).toBe(EMBED_EXCHANGE_MEMORY_MAX_ENTRIES);
		expect(failures.allows(HOST, UNKNOWN)).toBe(true);
	});

	it('forgets the windows that ended as soon as another refusal is counted', () => {
		const { failures, advance } = counter();
		for (let address = 0; address < 100; address++) {
			failures.recordFailure(`address-${address}`);
		}

		advance(EMBED_EXCHANGE_FAILURE_WINDOW_MS);
		failures.recordFailure(HOST);

		expect(failures['windows'].size).toBe(1);
	});

	it('counts each lookup it admits before it starts, so lookups at the same time cannot all pass the cap', () => {
		const { failures } = counter();
		const admitted: boolean[] = [];
		// None of them has been refused yet: each takes its place as it is admitted.
		for (let sent = 0; sent < EMBED_EXCHANGE_FAILURES_PER_ADDRESS + 10; sent++) {
			admitted.push(failures.admit(HOST, UNKNOWN).allowed);
		}

		expect(admitted.filter(Boolean)).toHaveLength(EMBED_EXCHANGE_FAILURES_PER_ADDRESS);
		expect(failures.admit(OTHER_ADDRESS, UNKNOWN)).toEqual({ allowed: true, counted: true, reachesCap: false });
	});

	it('gives back a lookup that earned a token, and neither counts nor caps an accepted credential', () => {
		const { failures } = counter();
		for (let sent = 0; sent < EMBED_EXCHANGE_FAILURES_PER_ADDRESS - 1; sent++) {
			failures.admit(HOST, UNKNOWN);
		}
		const lastPlace = failures.admit(HOST, GOOD);
		expect(lastPlace).toEqual({ allowed: true, counted: true, reachesCap: true });
		expect(failures.allows(HOST, UNKNOWN)).toBe(false);

		failures.release(HOST);
		failures.recordAccepted(GOOD);

		expect(failures.allows(HOST, UNKNOWN)).toBe(true);
		expect(failures.admit(HOST, GOOD)).toEqual({ allowed: true, counted: false, reachesCap: false });
	});

	it('forgets a revoked credential: it no longer passes a capped address', () => {
		const { failures } = counter();
		failures.recordAccepted(GOOD);
		refuse(failures, HOST, EMBED_EXCHANGE_FAILURES_PER_ADDRESS);
		expect(failures.allows(HOST, GOOD)).toBe(true);

		failures.forgetAccepted(GOOD);

		expect(failures.allows(HOST, GOOD)).toBe(false);
	});

	it('remembers no more accepted credentials than its bound, forgetting the oldest first', () => {
		const { failures } = counter();
		failures.recordAccepted(GOOD);

		for (let credential = 0; credential < EMBED_EXCHANGE_MEMORY_MAX_ENTRIES; credential++) {
			failures.recordAccepted(`credential-${credential}`);
		}
		refuse(failures, HOST, EMBED_EXCHANGE_FAILURES_PER_ADDRESS);

		expect(failures['accepted']['entries'].size).toBe(EMBED_EXCHANGE_MEMORY_MAX_ENTRIES);
		expect(failures.allows(HOST, GOOD)).toBe(false);
	});
});

describe('EmbedTokenController', () => {
	it('counts refused credentials by the address the rate limiter uses', async () => {
		const exchange = jest.fn(async (_input: unknown, _address: string) => ({
			token: 'an-embed-token',
			expiresAt: ''
		}));
		const controller = new EmbedTokenController({ exchange } as any);
		const input = { credential: 'gze_x' };

		await controller.exchange(input, { ip: `::ffff:${HOST}`, headers: {} });

		expect(exchange).toHaveBeenCalledWith(input, HOST);
	});
});
