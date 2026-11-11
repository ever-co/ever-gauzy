import { AsyncResource } from 'node:async_hooks';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { EventOutboxStatus, IEventConsumer, IEventEnvelope } from '@gauzy/contracts';
import {
	EVENT_OUTBOX_COMMIT_PASS_LIMIT,
	EVENT_OUTBOX_DISPATCH_BATCH_SIZE,
	EVENT_OUTBOX_DISPATCH_JOB,
	EVENT_OUTBOX_DISPATCH_LEASE_MS,
	EVENT_OUTBOX_DISPATCH_ON_COMMIT_ENV,
	EVENT_OUTBOX_QUEUE_NAME
} from './event-outbox-constant';
import { EventConsumerRegistry, EventConsumerRunOutcome } from './event-consumer.registry';
import { EventOutbox } from './event-outbox.entity';
import { describeFailure, EventOutboxService } from './event-outbox.service';

/** How many rows one pass claimed, and how many of them it published. */
interface IEventOutboxPassCount {
	claimed: number;
	published: number;
}

/** What the scheduler tells the worker about the pass it asked for. */
export interface IEventOutboxDispatchJob {
	requestedAt: string;
}

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

/**
 * Runs the dispatch pass the scheduler queued.
 *
 * **This worker is the only thing that drains `event_outbox`**, and everything it does is a
 * coordination of decisions that live elsewhere. The service decides which rows are claimable, in
 * what order and under what lease; the registry decides which consumers an event has and runs each of
 * them at most once, with its own delivery record, its own ordering gate and its own attempt budget;
 * the service decides when a failed row is retried and when it is dead-lettered. What is left for
 * this worker is the one decision nothing else can make: whether the row as a whole is done.
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
 * A pass that could not claim at all is raised, so the queue's own retry and dead-letter handling
 * sees it. A row that could not be moved is logged and the pass continues: the row carries its own
 * recovery — the lease it holds expires — and one poisoned row must not cost every other row in the
 * batch its turn.
 */
@Injectable()
@QueueWorker(EVENT_OUTBOX_QUEUE_NAME)
export class EventOutboxDispatchWorker extends QueueWorkerHost implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(EventOutboxDispatchWorker.name);

	/** Removes the commit listener; set while this worker listens. */
	private stopListening?: () => void;

	/** Whether a wake's passes are running or about to run. */
	private waking = false;

	/** Whether a commit arrived after the running wake's last claim, so one more pass is owed. */
	private wakeAgain = false;

	/** Set once the module is being destroyed: no pass after a commit starts from then on. */
	private closing = false;

	/** The wake scheduled to start, until it starts. */
	private pendingStart?: ReturnType<typeof setImmediate>;

	/** The running wake, which shutdown waits for. */
	private running?: Promise<void>;

	/**
	 * The async context this worker was built in, which has no request.
	 *
	 * A pass after a commit is scheduled from inside the ORM's commit hook, so a plain `setImmediate`
	 * would carry the committing request's context (`RequestContext` is AsyncLocalStorage, through
	 * `nestjs-cls`) into the pass, and a delivery record of a tenant-wide event would take that request's
	 * organization (`claimDelivery` falls back to it). The pass runs in this context instead, as a pass
	 * the queue hands over does.
	 */
	private readonly outsideRequests = new AsyncResource('EventOutboxDispatchAfterCommit');

	constructor(private readonly eventOutboxService: EventOutboxService, private readonly registry: EventConsumerRegistry) {
		super();
	}

	/**
	 * Listens for commits that appended events, unless `GAUZY_EVENT_OUTBOX_DISPATCH_ON_COMMIT=false`.
	 *
	 * **The pass after a commit is what brings a live event to its subscribers in about the time of one
	 * pass** (realtime-channel spec §4, P95 under 1 s; plan §15.9, T28). The scheduled pass runs every
	 * minute, and before this a hint waited for it. The outbox row is unchanged by this: it is written in
	 * the caller's transaction as before and stays the replay and webhook record, and the pass is the
	 * same claim, lease and per-partition order the scheduled one runs.
	 */
	onModuleInit(): void {
		this.closing = false;

		if (process.env[EVENT_OUTBOX_DISPATCH_ON_COMMIT_ENV]?.trim().toLowerCase() === 'false') {
			return;
		}

		this.stopListening = this.eventOutboxService.commitSignal?.listen(() => this.wake());
	}

	/**
	 * Stops listening, cancels a wake that has not started and waits for the one that runs.
	 *
	 * These passes run outside BullMQ, so closing the queue's worker does not wait for them. Nest destroys
	 * modules before it shuts the application's connections down, so waiting here keeps a pass from
	 * running against a closed database.
	 */
	async onModuleDestroy(): Promise<void> {
		this.closing = true;
		this.stopListening?.();
		this.stopListening = undefined;

		if (this.pendingStart) {
			clearImmediate(this.pendingStart);
			this.pendingStart = undefined;
			this.waking = false;
			this.wakeAgain = false;
		}

		await this.running;
	}

	/**
	 * Asks for a pass after a commit that appended an event.
	 *
	 * **Only a process that consumes the dispatch queue runs it.** That is the process that already runs
	 * every pass and hosts every consumer (see `EventOutboxMaintenanceModule`); a process without a queue
	 * connection does not dispatch at all, and a wake must not start dispatching there.
	 *
	 * **Wakes coalesce without losing one.** While passes run, a wake only marks that one more is owed,
	 * and it runs after the current one, so every commit is followed by a pass that started after it. A
	 * burst of commits costs a pass or two, not one each. Two passes in different processes are safe for
	 * the reason two scheduled ones are: the claim locks the rows it leases.
	 */
	wake(): void {
		if (this.closing || !this.consumesQueue()) {
			return;
		}

		if (this.waking) {
			this.wakeAgain = true;

			return;
		}

		this.waking = true;
		// Out of the ORM's commit hook, so the request that committed carries on, and out of its async
		// context, so the pass sees no request.
		this.outsideRequests.runInAsyncScope(() => {
			this.pendingStart = setImmediate(() => {
				this.pendingStart = undefined;
				this.running = this.runWakes();
			});
		});
	}

	/** Runs passes until no wake is owed. */
	private async runWakes(): Promise<void> {
		try {
			do {
				this.wakeAgain = false;

				for (let pass = 1; pass <= EVENT_OUTBOX_COMMIT_PASS_LIMIT && !this.closing; pass += 1) {
					const { claimed } = await this.runPass('a commit', true);

					// A claim takes only the head of each partition, so an aggregate's next event becomes
					// claimable once its head settles — published, or dead-lettered by the attempt budget,
					// which the pass counts as a retry. One transaction that appended several events of one
					// aggregate therefore needs a pass per event, and a full batch may have left rows behind.
					// So the passes go on until one claims nothing: a head waiting out its backoff is not
					// due, so that pass comes at once and costs one claim that matches nothing.
					if (claimed === 0) {
						break;
					}
				}
			} while (this.wakeAgain && !this.closing);
		} catch (error) {
			// The claim's failure is already logged by the pass. The scheduled pass is still there, and it is
			// what the queue retries, so a failed wake costs latency rather than an event.
			this.logger.debug(`Stopped the event outbox passes after a commit: ${describeFailure(error)}`);
		} finally {
			this.waking = false;
			this.wakeAgain = false;
			this.running = undefined;
		}
	}

	/**
	 * Whether this process consumes the dispatch queue: the BullMQ worker is attached and running. The in-process
	 * worker of an API without a queue (`EventOutboxInlineDispatchWorker`) answers true.
	 */
	protected consumesQueue(): boolean {
		try {
			return this.worker?.isRunning() === true;
		} catch {
			// The host throws when no worker is attached: a process without a queue root.
			return false;
		}
	}

	/**
	 * Claims one bounded batch and hands each claimed event to its consumers.
	 *
	 * @param job The queued request.
	 */
	@QueueJobHandler(EVENT_OUTBOX_DISPATCH_JOB)
	public async handleDispatch(job: Job<IEventOutboxDispatchJob>): Promise<void> {
		await this.runPass(job.data?.requestedAt ?? 'an unrecorded moment', false);
	}

	/**
	 * One pass: claims one bounded batch and hands each claimed event to its consumers.
	 *
	 * @param requestedBy What asked for the pass, for the log.
	 * @param afterCommit Whether a commit asked for it. Those passes run once per commit burst, so they
	 * log at debug level, except for failures.
	 * @returns How many rows the pass claimed, and how many of them it published.
	 */
	private async runPass(requestedBy: string, afterCommit: boolean): Promise<IEventOutboxPassCount> {
		const report = (message: string) => (afterCommit ? this.logger.debug(message) : this.logger.log(message));

		report(afterCommit ? 'Dispatching the event outbox after a commit' : `Dispatching the event outbox, requested at ${requestedBy}`);

		let claimed: EventOutbox[];

		try {
			claimed = await this.eventOutboxService.claimBatch({
				batchSize: EVENT_OUTBOX_DISPATCH_BATCH_SIZE,
				leaseMs: EVENT_OUTBOX_DISPATCH_LEASE_MS
			});
		} catch (error) {
			// Nothing was claimed, so nothing is owed a decision: the failure is the queue's to retry,
			// and a pass that swallowed it would report a drained outbox while the table grew.
			this.logger.error('The event outbox dispatch pass could not claim a batch', error);

			throw error;
		}

		if (claimed.length === 0) {
			report('The event outbox had nothing due');

			return { claimed: 0, published: 0 };
		}

		const counted: Record<EventOutboxRowOutcome, number> = {
			[EventOutboxRowOutcome.PUBLISHED]: 0,
			[EventOutboxRowOutcome.RETRYING]: 0,
			[EventOutboxRowOutcome.UNRESOLVED]: 0
		};

		for (const row of claimed) {
			counted[await this.dispatchRow(row)] += 1;
		}

		report(
			`Dispatched ${claimed.length} event(s): ` +
				`${counted[EventOutboxRowOutcome.PUBLISHED]} published, ` +
				`${counted[EventOutboxRowOutcome.RETRYING]} retrying, ` +
				`${counted[EventOutboxRowOutcome.UNRESOLVED]} unresolved`
		);

		return { claimed: claimed.length, published: counted[EventOutboxRowOutcome.PUBLISHED] };
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
				new Error(`${unsettled.join(', ')} did not settle event "${row.eventName}": ${describeFailure(firstFailure)}`)
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
	private async runConsumer(
		consumer: IEventConsumer,
		envelope: IEventEnvelope,
		row: EventOutbox
	): Promise<unknown> {
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
