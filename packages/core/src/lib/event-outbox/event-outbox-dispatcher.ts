import { Injectable, Logger } from '@nestjs/common';
import { EventOutboxStatus, IEventConsumer, IEventEnvelope } from '@gauzy/contracts';
import {
	EVENT_OUTBOX_DISPATCH_BATCH_SIZE,
	EVENT_OUTBOX_DISPATCH_LEASE_MS,
	EVENT_OUTBOX_DRAIN_MAX_PASSES
} from './event-outbox-constant';
import { EventConsumerRegistry, EventConsumerRunOutcome } from './event-consumer.registry';
import { EventOutbox } from './event-outbox.entity';
import { describeFailure, EventOutboxService } from './event-outbox.service';

/**
 * How one claimed row ended.
 *
 * The three are what a pass counts, and they are three rather than two because "the row was moved to
 * a terminal or a scheduled state" and "the row could not be moved at all" are different facts with
 * different recoveries: the first is the service's own ladder doing its work, the second is a row
 * that comes back only when its lease expires.
 */
export enum EventOutboxRowOutcome {
	/** Every consumer registered for the event settled, so the row is published. */
	PUBLISHED = 'PUBLISHED',
	/** At least one consumer is still owed the event, so the row waits out the service's backoff. */
	RETRYING = 'RETRYING',
	/** Nothing could be written about the row; the lease expiring is what returns it to a later pass. */
	UNRESOLVED = 'UNRESOLVED'
}

/** What one pass did. */
export interface IEventOutboxPassResult {
	claimed: number;
	published: number;
	retrying: number;
	unresolved: number;
}

/** What a drain did: the passes it ran and their totals. */
export interface IEventOutboxDrainResult extends IEventOutboxPassResult {
	passes: number;
}

/** How a pass reports itself. */
export interface IEventOutboxPassOptions {
	/** The moment the pass was asked for, named in the log line it starts with. */
	requestedAt?: string;
	/**
	 * Logs at debug level. A pass that follows every append runs once per chat message; at log level
	 * it would bury every other line the API writes.
	 */
	quiet?: boolean;
}

/** How a drain is bounded. */
export interface IEventOutboxDrainOptions extends IEventOutboxPassOptions {
	/** The most passes one drain runs. */
	maxPasses?: number;
}

/**
 * Runs the dispatch pass: claims one bounded batch and hands each claimed event to its consumers.
 *
 * **This is the only thing that drains `event_outbox`**, whichever process runs it — the queue worker
 * for a pass the schedule or an append asked for, or the API itself when it has no queue. Everything
 * it does is a coordination of decisions that live elsewhere. The service decides which rows are
 * claimable, in what order and under what lease; the registry decides which consumers an event has
 * and runs each of them at most once, with its own delivery record, its own ordering gate and its own
 * attempt budget; the service decides when a failed row is retried and when it is dead-lettered. What
 * is left here is the one decision nothing else can make: whether the row as a whole is done.
 *
 * **A row is done when every consumer of it has settled, not when every consumer succeeded.** A
 * delivery record that the registry dead-lettered is settled — its budget is spent, and the order
 * gate already treats that position as resolved so the rest of the aggregate is not held behind it.
 * Retrying the row on its account would re-claim that record on every pass and invoke a consumer the
 * platform has already given up on, forever. A record that merely *failed* is not settled: its budget
 * has attempts left, and returning the row to the ladder is how they are spent.
 *
 * **A row nobody consumes is published rather than retried.** The alternative is a row that climbs
 * its attempt counter until it dead-letters, which would fill the dead-letter listing an operator
 * reads with events whose only fault is that this installation has no consumer for them.
 *
 * **One consumer's failure never stops the others.** Each is run inside its own guard, so a broken
 * subscriber does not cost the search index or an outbound endpoint its copy of the event — and a
 * pass that stopped at the first failure would deliver consumers in registration order and no
 * further, which is a delivery guarantee nobody declared.
 *
 * **No transaction is held across consumer work.** The claim opens and closes its own transaction
 * inside the service; every consumer runs after it has committed. A pass that held the claim open
 * would hold write locks for as long as the slowest consumer's HTTP call, which on the deployments
 * that run SQLite blocks every writer in the process.
 *
 * A pass that could not claim at all is raised, so a queue's own retry and dead-letter handling sees
 * it. A row that could not be moved is logged and the pass continues: the row carries its own
 * recovery — the lease it holds expires — and one poisoned row must not cost every other row in the
 * batch its turn.
 */
@Injectable()
export class EventOutboxDispatcher {
	private readonly logger = new Logger(EventOutboxDispatcher.name);

	constructor(
		private readonly eventOutboxService: EventOutboxService,
		private readonly registry: EventConsumerRegistry
	) {}

	/**
	 * One pass: claims one bounded batch and hands each claimed event to its consumers.
	 *
	 * @param options How the pass reports itself.
	 * @returns What the pass did.
	 */
	async pass(options: IEventOutboxPassOptions = {}): Promise<IEventOutboxPassResult> {
		const report = (message: string): void =>
			options.quiet ? this.logger.debug(message) : this.logger.log(message);

		report(`Dispatching the event outbox, requested at ${options.requestedAt ?? 'an unrecorded moment'}`);

		let claimed: EventOutbox[];

		try {
			claimed = await this.eventOutboxService.claimBatch({
				batchSize: EVENT_OUTBOX_DISPATCH_BATCH_SIZE,
				leaseMs: EVENT_OUTBOX_DISPATCH_LEASE_MS
			});
		} catch (error) {
			// Nothing was claimed, so nothing is owed a decision: the failure is the caller's to retry,
			// and a pass that swallowed it would report a drained outbox while the table grew.
			this.logger.error('The event outbox dispatch pass could not claim a batch', error);

			throw error;
		}

		const result: IEventOutboxPassResult = { claimed: claimed.length, published: 0, retrying: 0, unresolved: 0 };

		if (claimed.length === 0) {
			report('The event outbox had nothing due');

			return result;
		}

		for (const row of claimed) {
			const outcome = await this.dispatchRow(row);

			if (outcome === EventOutboxRowOutcome.PUBLISHED) {
				result.published += 1;
			} else if (outcome === EventOutboxRowOutcome.RETRYING) {
				result.retrying += 1;
			} else {
				result.unresolved += 1;
			}
		}

		report(
			`Dispatched ${claimed.length} event(s): ` +
				`${result.published} published, ` +
				`${result.retrying} retrying, ` +
				`${result.unresolved} unresolved`
		);

		return result;
	}

	/**
	 * Runs passes until nothing more is due, within a bound.
	 *
	 * One pass claims the head of each aggregate's queue and no more, so a burst of three messages in
	 * one conversation is three passes: the second message becomes claimable only once the first is
	 * published. A drain keeps going while a pass published something (a next head may now be due) or
	 * filled its whole batch (more aggregates may be waiting), and stops at the first pass that did
	 * neither — rows still retrying are inside their backoff and would not be claimed again anyway.
	 *
	 * @param options The bound and how the passes report themselves.
	 * @returns The passes run and their totals.
	 */
	async drain(options: IEventOutboxDrainOptions = {}): Promise<IEventOutboxDrainResult> {
		const maxPasses = Math.max(1, options.maxPasses ?? EVENT_OUTBOX_DRAIN_MAX_PASSES);
		const total: IEventOutboxDrainResult = { passes: 0, claimed: 0, published: 0, retrying: 0, unresolved: 0 };

		while (total.passes < maxPasses) {
			const result = await this.pass(options);

			total.passes += 1;
			total.claimed += result.claimed;
			total.published += result.published;
			total.retrying += result.retrying;
			total.unresolved += result.unresolved;

			if (result.published === 0 && result.claimed < EVENT_OUTBOX_DISPATCH_BATCH_SIZE) {
				break;
			}
		}

		return total;
	}

	/**
	 * Hands one claimed event to every consumer registered for its name, and records what became of it.
	 *
	 * The envelope is built once from the row rather than per consumer, so every consumer of one event
	 * sees the same identity, aggregate and sequence — which is what makes a delivery record and a
	 * replay describe the same fact.
	 *
	 * @param row The claimed outbox row.
	 * @returns How the row ended, which is what the pass counts.
	 */
	private async dispatchRow(row: EventOutbox): Promise<EventOutboxRowOutcome> {
		try {
			const consumers = this.registry.consumersFor(row.eventName);

			if (consumers.length === 0) {
				// Published rather than retried: this installation has no consumer for the event, which is
				// a fact about the deployment rather than a failure to deliver. The row stays as the record
				// that the fact happened.
				await this.eventOutboxService.markPublished(row.id);

				return EventOutboxRowOutcome.PUBLISHED;
			}

			const envelope = this.eventOutboxService.toEnvelope(row);
			const unsettled: string[] = [];
			let firstFailure: unknown = undefined;

			for (const consumer of consumers) {
				const failure = await this.runConsumer(consumer, envelope, row);

				if (failure === undefined) {
					continue;
				}

				unsettled.push(EventConsumerRegistry.consumerKeyOf(consumer));

				if (firstFailure === undefined) {
					firstFailure = failure;
				}
			}

			if (unsettled.length === 0) {
				await this.eventOutboxService.markPublished(row.id);

				return EventOutboxRowOutcome.PUBLISHED;
			}

			// The service owns the ladder and the attempt budget; what this call adds is the diagnosis an
			// operator reads on the row — which consumers are still owed the event, and why the first of
			// them refused it.
			await this.eventOutboxService.markFailed(
				row.id,
				new Error(
					`${unsettled.join(', ')} did not settle event "${row.eventName}": ${describeFailure(firstFailure)}`
				)
			);

			return EventOutboxRowOutcome.RETRYING;
		} catch (error) {
			// The row could not be moved — the store refused the write, or the registry itself threw
			// outside a consumer. It keeps the lease it was claimed under, so a later pass picks it up
			// once that expires, and its attempt counter is already incremented, so the service's own
			// budget still bounds how long this can repeat.
			this.logger.error(`The outbox row "${String(row.id)}" could not be dispatched`, error);

			return EventOutboxRowOutcome.UNRESOLVED;
		}
	}

	/**
	 * Runs one consumer for one event, and reports only whether the row still owes it the event.
	 *
	 * Nothing about the delivery record is decided here: `runOnce` claims it before the consumer is
	 * invoked, suppresses a consumer that already acknowledged the event, applies the ordering gate a
	 * strict consumer asked for and completes the record afterwards. What is read back from it is the
	 * one thing the row's own status depends on — whether this consumer's record is settled.
	 *
	 * @param consumer The consumer to run.
	 * @param envelope The event to hand it.
	 * @param row The claimed row, named in the log line a dead letter produces.
	 * @returns The failure that leaves the consumer owed the event, or undefined when it is settled.
	 */
	private async runConsumer(consumer: IEventConsumer, envelope: IEventEnvelope, row: EventOutbox): Promise<unknown> {
		const consumerKey = EventConsumerRegistry.consumerKeyOf(consumer);

		try {
			const run = await this.registry.runOnce(consumer, envelope);

			if (run.outcome !== EventConsumerRunOutcome.FAILED) {
				return undefined;
			}

			if (run.delivery?.status === EventOutboxStatus.DEAD) {
				// The consumer's own budget is spent. The record is terminal and the order gate already
				// counts this position as resolved, so holding the row open for it would re-invoke a
				// consumer the platform has given up on once per pass, for as long as the row lives.
				this.logger.warn(
					`The consumer "${consumerKey}" dead-lettered event "${row.eventName}" (${String(row.eventId)}): ${
						run.error ?? 'no reason recorded'
					}`
				);

				return undefined;
			}

			return run.error ?? `The consumer "${consumerKey}" refused the event.`;
		} catch (error) {
			// `runOnce` catches whatever the consumer threw, so reaching here means the delivery record
			// itself could not be claimed or completed. The consumer is still owed the event and the row
			// is returned to the ladder, which is the same answer a refused delivery gets.
			this.logger.error(`The delivery record for "${consumerKey}" could not be written`, error);

			return error;
		}
	}
}
