import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { EVENT_OUTBOX_DISPATCH_JOB, EVENT_OUTBOX_QUEUE_NAME } from './event-outbox-constant';
import { EventConsumerRegistry } from './event-consumer.registry';
import { EventOutboxDispatcher } from './event-outbox-dispatcher';
import { EventOutboxService } from './event-outbox.service';

/** What the scheduler, or an append, tells the worker about the pass it asked for. */
export interface IEventOutboxDispatchJob {
	requestedAt: string;
	/**
	 * Set by a request that follows an append: run passes until nothing more is due, quietly. A burst
	 * of messages in one conversation needs one pass per message (a pass claims each aggregate's head
	 * only), and an append-driven request must not leave the rest of the burst to the next minute.
	 * The per-minute tick leaves it unset and runs the one bounded pass it always ran.
	 */
	drain?: boolean;
}

/**
 * Runs the dispatch pass a queued request asked for.
 *
 * The pass itself is {@link EventOutboxDispatcher}'s: this worker is the queue's door to it, so the
 * per-minute schedule and the request an append makes reach the same code the API runs in-process
 * when it has no queue. A pass that could not claim is raised, so the queue's own retry and
 * dead-letter handling sees it.
 */
@Injectable()
@QueueWorker(EVENT_OUTBOX_QUEUE_NAME)
export class EventOutboxDispatchWorker extends QueueWorkerHost {
	private readonly logger = new Logger(EventOutboxDispatchWorker.name);
	private readonly dispatcher: EventOutboxDispatcher;

	constructor(eventOutboxService: EventOutboxService, registry: EventConsumerRegistry) {
		super();
		// Built here rather than injected, so the worker keeps the two collaborators the scheduler's
		// injector hands its job providers, and the pass is the same object whichever path runs it.
		this.dispatcher = new EventOutboxDispatcher(eventOutboxService, registry);
	}

	/**
	 * Claims one bounded batch and hands each claimed event to its consumers; or, for a request that
	 * followed an append, drains what is due.
	 *
	 * @param job The queued request.
	 */
	@QueueJobHandler(EVENT_OUTBOX_DISPATCH_JOB)
	public async handleDispatch(job: Job<IEventOutboxDispatchJob>): Promise<void> {
		const requestedAt = job.data?.requestedAt;

		if (job.data?.drain) {
			const drained = await this.dispatcher.drain({ requestedAt, quiet: true });

			if (drained.claimed > 0) {
				this.logger.debug(
					`Drained ${drained.claimed} event(s) in ${drained.passes} pass(es) after an append: ` +
						`${drained.published} published, ${drained.retrying} retrying, ${drained.unresolved} unresolved`
				);
			}

			return;
		}

		await this.dispatcher.pass({ requestedAt });
	}
}
