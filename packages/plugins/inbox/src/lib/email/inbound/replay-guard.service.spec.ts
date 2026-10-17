jest.mock('@gauzy/core', () => ({ EVER_REDIS_CLIENT: 'EVER_REDIS_CLIENT' }));

import { INBOUND_PROCESSING_CLAIM_MS, InboundReplayGuard } from './replay-guard.service';

describe('InboundReplayGuard', () => {
	afterEach(() => jest.restoreAllMocks());

	it('claims a delivery briefly, then remembers a stored one for its whole window', async () => {
		let now = 1_000_000;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
		const guard = new InboundReplayGuard(null);
		expect(await guard.consume('generic:a', 'd1', INBOUND_PROCESSING_CLAIM_MS)).toBe(true);
		expect(await guard.consume('generic:a', 'd1', INBOUND_PROCESSING_CLAIM_MS)).toBe(false);
		await guard.complete('generic:a', 'd1', 60 * 60_000);
		now += INBOUND_PROCESSING_CLAIM_MS + 1;
		// Stored: still a replay after the claim would have expired.
		expect(await guard.consume('generic:a', 'd1', INBOUND_PROCESSING_CLAIM_MS)).toBe(false);
		// Another account's delivery with the same fingerprint is its own.
		expect(await guard.consume('generic:b', 'd1', INBOUND_PROCESSING_CLAIM_MS)).toBe(true);
	});

	it('lets a retry through once the claim of a crashed delivery expires', async () => {
		let now = 1_000_000;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
		const guard = new InboundReplayGuard(null);
		expect(await guard.consume('ses:a', 'sns:1', INBOUND_PROCESSING_CLAIM_MS)).toBe(true);
		// The process died before storing finished: no `complete`, no `release`.
		now += INBOUND_PROCESSING_CLAIM_MS + 1;
		expect(await guard.consume('ses:a', 'sns:1', INBOUND_PROCESSING_CLAIM_MS)).toBe(true);
	});

	it('claims with SET NX and completes with SET PX on Redis', async () => {
		const set = jest.fn(async () => 'OK');
		const guard = new InboundReplayGuard({ set } as never);
		expect(await guard.consume('generic:a', 'd1', INBOUND_PROCESSING_CLAIM_MS)).toBe(true);
		await guard.complete('generic:a', 'd1', 60 * 60_000);
		expect(set.mock.calls.map((call) => (call as unknown[])[2])).toEqual([
			{ NX: true, PX: INBOUND_PROCESSING_CLAIM_MS },
			{ PX: 60 * 60_000 }
		]);
	});
});
