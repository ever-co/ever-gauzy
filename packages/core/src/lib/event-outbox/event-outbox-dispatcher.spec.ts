import { Logger } from '@nestjs/common';
import { EventOutboxStatus } from '@gauzy/contracts';
import { EVENT_OUTBOX_DISPATCH_BATCH_SIZE, EVENT_OUTBOX_DRAIN_MAX_PASSES } from './event-outbox-constant';
import { EventConsumerRegistry, EventConsumerRunOutcome } from './event-consumer.registry';
import { EventOutboxDispatcher } from './event-outbox-dispatcher';
import { EventOutboxService } from './event-outbox.service';

/**
 * A drain is what follows an append. One pass claims each aggregate's head only, so a burst of messages in one
 * conversation is one pass per message: a drain that stopped after the first pass left the rest of the burst to
 * the next per-minute tick, which is a chat that shows the first message at once and the second a minute later.
 */

type Row = { id: string; eventId: string; eventName: string; partitionKey: string };

const row = (n: number, partition = 'ChatConversation:c1'): Row => ({
	id: `row-${n}`,
	eventId: `event-${n}`,
	eventName: 'chat_message.created',
	partitionKey: partition
});

/** A store that hands out scripted batches, one per claim, then nothing. */
function store(batches: Row[][]) {
	const claims: number[] = [];
	const published: string[] = [];
	const failed: string[] = [];
	const service = {
		claimBatch: jest.fn(async () => {
			claims.push(claims.length + 1);
			return batches.shift() ?? [];
		}),
		toEnvelope: (claimed: Row) => ({ id: claimed.eventId, name: claimed.eventName }),
		markPublished: jest.fn(async (id: string) => {
			published.push(id);
			return null;
		}),
		markFailed: jest.fn(async (id: string) => {
			failed.push(id);
			return null;
		})
	};
	return { service, claims, published, failed };
}

/** A registry with one consumer whose outcome the case decides. */
function registry(outcome: EventConsumerRunOutcome = EventConsumerRunOutcome.DELIVERED) {
	const consumer = { key: 'subscriber:graphql', events: ['chat_message.created'] };
	return {
		consumersFor: () => [consumer],
		runOnce: jest.fn(async () =>
			outcome === EventConsumerRunOutcome.FAILED
				? { outcome, error: 'refused', delivery: { status: EventOutboxStatus.FAILED } }
				: { outcome }
		)
	} as unknown as EventConsumerRegistry;
}

function dispatcherOver(batches: Row[][], outcome?: EventConsumerRunOutcome) {
	const ledger = store(batches);
	const dispatcher = new EventOutboxDispatcher(ledger.service as unknown as EventOutboxService, registry(outcome));
	return { ledger, dispatcher };
}

let log: jest.SpyInstance;
let debug: jest.SpyInstance;

beforeEach(() => {
	log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('EventOutboxDispatcher.drain', () => {
	it('runs passes until the burst is delivered: each published head may have another event behind it', async () => {
		const { ledger, dispatcher } = dispatcherOver([[row(1)], [row(2)], [row(3)]]);

		const drained = await dispatcher.drain();

		expect(ledger.published).toEqual(['row-1', 'row-2', 'row-3']);
		// The fourth claim found nothing and ended the drain.
		expect(drained).toEqual({ passes: 4, claimed: 3, published: 3, retrying: 0, unresolved: 0 });
	});

	it('runs one pass when nothing is due', async () => {
		const { ledger, dispatcher } = dispatcherOver([]);

		expect(await dispatcher.drain()).toMatchObject({ passes: 1, claimed: 0 });
		expect(ledger.claims).toHaveLength(1);
	});

	it('stops after a pass that only retried: those rows wait out their backoff and would not be claimed again', async () => {
		const { ledger, dispatcher } = dispatcherOver(
			[[row(1), row(2, 'ChatConversation:c2')], [row(3)]],
			EventConsumerRunOutcome.FAILED
		);

		const drained = await dispatcher.drain();

		expect(drained).toMatchObject({ passes: 1, claimed: 2, retrying: 2, published: 0 });
		expect(ledger.failed).toEqual(['row-1', 'row-2']);
		expect(ledger.claims).toHaveLength(1);
	});

	it('keeps going after a full batch even when nothing was published, because more aggregates may be waiting', async () => {
		const full = Array.from({ length: EVENT_OUTBOX_DISPATCH_BATCH_SIZE }, (_, i) => row(i, `p${i}`));
		const { ledger, dispatcher } = dispatcherOver([full, []], EventConsumerRunOutcome.FAILED);

		expect(await dispatcher.drain()).toMatchObject({ passes: 2, retrying: EVENT_OUTBOX_DISPATCH_BATCH_SIZE });
		expect(ledger.claims).toHaveLength(2);
	});

	it('is bounded, so one request never holds the process for long', async () => {
		const endless = Array.from({ length: EVENT_OUTBOX_DRAIN_MAX_PASSES + 5 }, (_, i) => [row(i)]);
		const { ledger, dispatcher } = dispatcherOver(endless);

		expect(await dispatcher.drain()).toMatchObject({ passes: EVENT_OUTBOX_DRAIN_MAX_PASSES });
		expect(ledger.claims).toHaveLength(EVENT_OUTBOX_DRAIN_MAX_PASSES);
		expect(await dispatcherOver([[row(1)], [row(2)], [row(3)]]).dispatcher.drain({ maxPasses: 2 })).toMatchObject({
			passes: 2
		});
	});

	it('raises a pass that could not claim, as the worker always did', async () => {
		const { ledger, dispatcher } = dispatcherOver([]);
		const refusal = new Error('connection terminated unexpectedly');
		ledger.service.claimBatch.mockRejectedValueOnce(refusal);

		await expect(dispatcher.drain()).rejects.toBe(refusal);
	});

	it('reports at debug level when asked to be quiet: a drain follows every chat message', async () => {
		const { dispatcher } = dispatcherOver([[row(1)]]);

		await dispatcher.drain({ quiet: true, requestedAt: '2026-11-10T20:00:00.000Z' });

		expect(log).not.toHaveBeenCalled();
		expect(debug.mock.calls.map((call) => String(call[0])).join('\n')).toContain(
			'Dispatched 1 event(s): 1 published'
		);
	});
});
