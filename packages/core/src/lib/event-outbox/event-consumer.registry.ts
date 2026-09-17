import { Injectable } from '@nestjs/common';
import {
	EventConsumerKind,
	EventConsumerOrdering,
	EventOutboxStatus,
	ID,
	IEventConsumer,
	IEventConsumerContext,
	IEventEnvelope
} from '@gauzy/contracts';
import { EventDelivery } from './event-delivery.entity';
import { describeFailure, EventOutboxService } from './event-outbox.service';

/**
 * How one delivery of one event to one consumer ended.
 */
export enum EventConsumerRunOutcome {
	/** The consumer succeeded and its delivery record says so. */
	DELIVERED = 'DELIVERED',
	/** The consumer had already acknowledged this event, so nothing was invoked. */
	ALREADY_DELIVERED = 'ALREADY_DELIVERED',
	/** The consumer threw; the record carries the error for the retry scan. */
	FAILED = 'FAILED'
}

/**
 * The result of running a consumer exactly once per event.
 */
export interface IEventConsumerRun {
	outcome: EventConsumerRunOutcome;
	consumerKey: string;
	delivery: EventDelivery;
	error?: string;
}

/**
 * Raised when a strict consumer receives an event out of sequence.
 *
 * The gap means an earlier event of the same aggregate is still in flight, so the correct answer is
 * to refuse this one and let it be redelivered — never to process it and hope the earlier one
 * arrives afterwards.
 */
export class EventOrderGapError extends Error {
	constructor(
		readonly consumerKey: string,
		readonly partitionKey: string,
		readonly lastDeliveredSequence: number,
		readonly receivedSequence: number
	) {
		super(
			`Consumer "${consumerKey}" received sequence ${receivedSequence} of partition "${partitionKey}" while only ${lastDeliveredSequence} was delivered.`
		);
		this.name = 'EventOrderGapError';
	}
}

/**
 * The registry a subscriber or a job declares itself to.
 *
 * Registration is the only thing that makes a consumer known: the dispatcher consults this registry,
 * so a consumer that is not registered simply never runs. Declarations are validated at bootstrap —
 * a duplicate key, an empty event list or a missing key fails startup loudly rather than producing a
 * consumer that is indistinguishable from one with nothing to do.
 */
@Injectable()
export class EventConsumerRegistry {
	private readonly consumers = new Map<string, IEventConsumer>();

	constructor(private readonly outbox: EventOutboxService) {}

	/**
	 * Registers a consumer.
	 *
	 * Registering the same consumer twice is a no-op, because a plugin loaded twice must register
	 * once; registering a *different* consumer under a key that is already taken is an error, because
	 * two consumers behind one delivery record would silently halve each other's work.
	 *
	 * @param consumer The consumer.
	 * @throws Error when the declaration is unusable or the key is taken.
	 */
	register(consumer: IEventConsumer): void {
		if (!consumer?.key) {
			throw new Error('An event consumer must declare a key.');
		}

		const consumerKey = EventConsumerRegistry.consumerKeyOf(consumer);
		const registered = this.consumers.get(consumerKey);

		if (registered === consumer) {
			return;
		}

		if (registered) {
			throw new Error(`The event consumer "${consumerKey}" is already registered.`);
		}

		if (!Array.isArray(consumer.events) || consumer.events.length === 0) {
			throw new Error(`The event consumer "${consumerKey}" declares no events, so it could never run.`);
		}

		this.consumers.set(consumerKey, consumer);
	}

	/**
	 * Stops new deliveries to a consumer.
	 *
	 * Outstanding delivery rows are deliberately left alone: they are the record of what the
	 * consumer did not process, and an operator replays them deliberately.
	 *
	 * @param key The consumer key, with or without its kind prefix.
	 */
	unregister(key: string): void {
		if (this.consumers.has(key)) {
			this.consumers.delete(key);
			return;
		}

		for (const [consumerKey, consumer] of this.consumers) {
			if (consumer.key === key) {
				this.consumers.delete(consumerKey);
			}
		}
	}

	/**
	 * The consumers registered for an event name.
	 *
	 * @param eventName The event name, for example `order.placed`.
	 * @returns The matching consumers, in registration order.
	 */
	consumersFor(eventName: string): IEventConsumer[] {
		return Array.from(this.consumers.values()).filter((consumer) => consumer.events.includes(eventName));
	}

	/**
	 * Every registered consumer.
	 *
	 * @returns The consumers, in registration order.
	 */
	list(): IEventConsumer[] {
		return Array.from(this.consumers.values());
	}

	/**
	 * Runs a consumer for an event, at most once.
	 *
	 * The delivery record is claimed before the consumer is invoked and completed after it returns,
	 * so a consumer that already acknowledged the event is skipped, a consumer that throws leaves a
	 * failed record for the retry scan, and a crash in between leaves a pending one. A consumer needs
	 * no idempotency bookkeeping of its own to get these three properties.
	 *
	 * @param consumer The consumer to run.
	 * @param event The event to hand it.
	 * @returns What the run did.
	 */
	async runOnce(consumer: IEventConsumer, event: IEventEnvelope): Promise<IEventConsumerRun> {
		const consumerKey = EventConsumerRegistry.consumerKeyOf(consumer);

		const claim = await this.outbox.claimDelivery({
			eventId: event.id,
			consumerKey,
			partitionKey: event.partitionKey,
			sequence: event.sequence
		});

		if (!claim.claimed) {
			return { outcome: EventConsumerRunOutcome.ALREADY_DELIVERED, consumerKey, delivery: claim.delivery };
		}

		try {
			await consumer.handle(event, this.createContext(consumer, claim.delivery));
		} catch (error) {
			const message = describeFailure(error);
			const delivery = await this.outbox.completeDelivery(claim.delivery.id as ID, {
				delivered: false,
				error: message,
				maxAttempts: consumer.maxAttempts
			});

			return { outcome: EventConsumerRunOutcome.FAILED, consumerKey, delivery: delivery ?? claim.delivery, error: message };
		}

		// Completing an already completed record is a no-op, so a consumer that marked itself
		// delivered does not have to tell the runner that it did.
		const delivery = await this.outbox.completeDelivery(claim.delivery.id as ID, {
			delivered: true,
			maxAttempts: consumer.maxAttempts
		});

		return { outcome: EventConsumerRunOutcome.DELIVERED, consumerKey, delivery: delivery ?? claim.delivery };
	}

	/**
	 * The delivery-record key of a consumer.
	 *
	 * The kind prefix is what keeps a subscriber, a queued job and an outbound endpoint from ever
	 * colliding on one event, and it is the namespace an operator filters a dead-letter listing by.
	 *
	 * @param consumer The consumer.
	 * @returns `<kind>:<key>`.
	 */
	static consumerKeyOf(consumer: IEventConsumer): string {
		return `${consumer.kind ?? EventConsumerKind.SUBSCRIBER}:${consumer.key}`;
	}

	/**
	 * Builds the context a consumer runs with.
	 *
	 * @param consumer The consumer.
	 * @param delivery The claimed delivery record.
	 * @returns The context.
	 */
	private createContext(consumer: IEventConsumer, delivery: EventDelivery): IEventConsumerContext {
		const outbox = this.outbox;
		const consumerKey = delivery.consumerKey;
		let delivered = false;

		return {
			consumerKey,

			async alreadyDelivered(): Promise<boolean> {
				if (delivered) {
					return true;
				}

				const record = await outbox.findDeliveryById(delivery.id as ID);
				delivered = record?.status === EventOutboxStatus.PUBLISHED;

				return delivered;
			},

			async markDelivered(): Promise<void> {
				if (delivered) {
					return;
				}

				await outbox.completeDelivery(delivery.id as ID, {
					delivered: true,
					maxAttempts: consumer.maxAttempts
				});
				delivered = true;
			},

			async assertOrder(event: IEventEnvelope): Promise<void> {
				if ((consumer.ordering ?? EventConsumerOrdering.REORDERABLE) !== EventConsumerOrdering.STRICT) {
					return;
				}

				if (!event.partitionKey || event.sequence === undefined) {
					return;
				}

				const received = Number(event.sequence);
				const lastDelivered = await outbox.findLastDeliveredSequence(consumerKey, event.partitionKey);

				if (received > lastDelivered + 1) {
					throw new EventOrderGapError(consumerKey, event.partitionKey, lastDelivered, received);
				}
			}
		};
	}
}
