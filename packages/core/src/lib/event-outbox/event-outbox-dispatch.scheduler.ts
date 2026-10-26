import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import {
	EVENT_OUTBOX_DISPATCH_JOB,
	EVENT_OUTBOX_DISPATCH_SCHEDULE,
	EVENT_OUTBOX_QUEUE_NAME
} from './event-outbox-constant';

/**
 * Fires the pass that hands appended events to their consumers.
 *
 * `append` is deliberately half of the transactional outbox: it writes the event in the caller's own
 * transaction and performs no I/O, so nothing is published by the request that produced the fact.
 * This job is the other half. Without something firing it the table only ever grows — every
 * subscription is silent, every search index is stale and every outbound endpoint is never called —
 * and nothing anywhere reports it, because from the writer's point of view the event was stored
 * exactly as promised.
 *
 * The job enqueues nothing but the request itself. The pass is what the worker does, on whichever
 * instance picks the job up, so a deployment that runs several API instances dispatches once rather
 * than once per instance. Two passes racing would not *lose* an event — the lease and the delivery
 * record both refuse a second claim — but they would spend their batches on each other's rows and
 * count attempts against events that never failed.
 *
 * **The schedule is per minute rather than hourly, and that is the difference between this sweep and
 * the retry-key one.** An idempotency row may be swept an hour late and nobody notices; an event
 * delivered an hour late is a subscription that looks broken, a search result that is wrong and a
 * partner integration that has already timed out. A minute is the coarsest period at which the outbox
 * still behaves like a transport rather than like a nightly batch, and the pass is bounded, so the
 * cost of firing it against an empty table is one claim query that matches nothing.
 */
@Injectable()
export class EventOutboxDispatchScheduler {
	private readonly logger = new Logger(EventOutboxDispatchScheduler.name);

	/**
	 * Asks the queue for one dispatch pass.
	 *
	 * @returns What the worker is told about the request.
	 */
	@ScheduledJob({
		name: EVENT_OUTBOX_DISPATCH_SCHEDULE,
		description: 'Hands appended outbox events to the consumers registered for them.',
		cron: CronExpression.EVERY_MINUTE,
		queueName: EVENT_OUTBOX_QUEUE_NAME,
		queueJobName: EVENT_OUTBOX_DISPATCH_JOB,
		preventOverlap: true
	})
	async enqueueDispatch(): Promise<{ requestedAt: string }> {
		const requestedAt = new Date().toISOString();

		this.logger.log(`Queued the event outbox dispatch pass at ${requestedAt}`);

		return { requestedAt };
	}
}
