import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';

/**
 * Dispatch state of an outbox row and of a single consumer's record for it.
 *
 * One vocabulary covers both tables deliberately: the dispatch scan, the retry policy and the
 * dead-letter listing are then written once and read the same way for an event and for a consumer.
 */
export enum EventOutboxStatus {
	/** Not yet dispatched, or awaiting its next attempt. */
	PENDING = 'PENDING',
	/** Dispatch succeeded. For a delivery row: that consumer acknowledged the event. */
	PUBLISHED = 'PUBLISHED',
	/** The last attempt failed and a further attempt is scheduled. */
	FAILED = 'FAILED',
	/** The final attempt failed. Terminal, retained for diagnosis and replayable by an admin action. */
	DEAD = 'DEAD'
}

/**
 * The consumer kinds an event is fanned out to.
 *
 * The kind is the prefix of the consumer key, which is what keeps a subscriber, a queued job and an
 * outbound endpoint from ever colliding on the same event.
 */
export enum EventConsumerKind {
	/** An in-process subscriber; key form `subscriber:<key>`. */
	SUBSCRIBER = 'subscriber',
	/** A background job; key form `job:<queueName>`. */
	JOB = 'job',
	/** An outbound webhook endpoint; key form `webhook:<subscriptionId>`. */
	WEBHOOK = 'webhook'
}

/**
 * Ordering guarantee a consumer needs.
 */
export enum EventConsumerOrdering {
	/** The consumer requires the events of one partition to arrive in sequence order. */
	STRICT = 'strict',
	/** The consumer tolerates reordering, so a slow delivery cannot block its partition. */
	REORDERABLE = 'reorderable'
}

/**
 * Envelope fields that travel beside the payload: correlation, causation and the channel the fact
 * belongs to. They are not part of the contract a consumer validates, so a producer may add to them.
 */
export interface IEventHeaders {
	correlationId?: ID;
	causationId?: ID;
	/** Who caused the change, when a person did. */
	actorUserId?: ID;
	/** Channel the fact belongs to, when it is channel scoped. */
	channelId?: ID;
	/** Set on a replayed event, naming the event it replays. */
	replayOf?: ID;
	/** Producer opt-out from the head-of-line rule for a high-volume, idempotent-by-nature event. */
	allowReorder?: boolean;
	[key: string]: unknown;
}

/**
 * What a consumer receives.
 *
 * The envelope is stable across transports: the in-process bus, a queued job and an outbound
 * webhook all carry the same shape, so a receiver implemented once works for every event.
 */
export interface IEventEnvelope<T = JsonData> {
	/** Stable event identity; the id the delivery records and the signature carry. */
	id: ID;
	/** `<aggregate>.<action>`, for example `order.placed`. */
	name: string;
	/** Payload contract version, so a consumer can follow the compatibility rules. */
	version: number;
	/** When the fact happened, as opposed to when it was dispatched. */
	occurredAt: Date | string;
	tenantId?: ID;
	organizationId?: ID;
	channelId?: ID;
	/** The aggregate that changed. */
	aggregate: { type: string; id: ID };
	/** Monotonic within the partition, allocated inside the writing transaction. */
	sequence?: number;
	/** Ordering key, normally `<AggregateType>:<aggregateId>`. */
	partitionKey?: string;
	correlationId?: ID;
	causationId?: ID;
	/** The aggregate whose domain produced the event, for example `order`. */
	producer?: string;
	/** The event body: a projection, never an entity dump. */
	data: T;
}

/**
 * A request to write an event into the outbox.
 *
 * The input carries exactly what the row stores. Envelope-level fields that the row has no column
 * for — the payload contract version and the moment the fact happened — are derived when the row is
 * turned into an envelope, so a producer cannot promise a version the stored event does not carry.
 */
export interface IOutboxWriteInput {
	/** `<aggregate>.<action>`. */
	name: string;
	/** The aggregate that changed, for example `order`. */
	aggregateType: string;
	/** Id of the aggregate that changed. */
	aggregateId: ID;
	/** The projection a consumer receives. */
	data: JsonData;
	/** Ordering key; defaults to `<aggregateType>:<aggregateId>`. */
	partitionKey?: string;
	headers?: IEventHeaders;
	/** Overrides the tenant taken from the request context. */
	tenantId?: ID;
	/** Overrides the organization taken from the request context. */
	organizationId?: ID;
}

/**
 * The transactional outbox row.
 *
 * A state change and its event are written in one transaction, so an event can never be lost by a
 * crash between the commit and the publish. Dispatch is at-least-once, which is why every consumer
 * needs its own delivery record.
 */
export interface IEventOutbox extends IBasePerTenantAndOrganizationEntityModel {
	/** Stable event identity; unique across the table. */
	eventId: ID;

	/** `<aggregate>.<action>`. */
	eventName: string;

	/** The aggregate that changed. */
	aggregateType: string;

	/** Id of the aggregate that changed. */
	aggregateId: ID;

	/** The event body. */
	payload: JsonData;

	/** Correlation, causation, actor and channel. */
	headers?: JsonData;

	status: EventOutboxStatus;

	/** Dispatch attempts. */
	attemptCount: number;

	/** Earliest dispatch time; a failed attempt pushes it forward by the backoff schedule. */
	availableAt: Date;

	/** When dispatch completed. */
	publishedAt?: Date;

	/** Last dispatch error. */
	lastError?: string;

	/** Ordering key, so a consumer sees one aggregate's events in order. */
	partitionKey?: string;

	/** Monotonic per `partitionKey`, allocated inside the writing transaction. */
	sequence: number;
}

/**
 * One row per `(event, consumer)`.
 *
 * The unique pair is the mechanism that makes a consumer idempotent, not a nicety: a consumer that
 * tries to process the same event twice fails the insert and skips the work.
 */
export interface IEventDelivery extends IBasePerTenantAndOrganizationEntityModel {
	/** The `event_outbox.eventId`; no foreign key, because deliveries outlive outbox retention. */
	eventId: ID;

	/** `<kind>:<key>` — `subscriber:<name>`, `job:<queue>` or `webhook:<subscriptionId>`. */
	consumerKey: string;

	status: EventOutboxStatus;

	attemptCount: number;

	/** When the consumer acknowledged the event. */
	deliveredAt?: Date;

	/** Last consumer error. */
	lastError?: string;

	/** Copied from the outbox row so the retry scan keeps per-aggregate ordering without a join. */
	partitionKey?: string;

	/** Copied from the outbox row; a strict consumer compares it against the last it processed. */
	sequence?: number;
}

/**
 * A consumer of events: an in-process subscriber or a queued job.
 *
 * A consumer is the only thing that makes work durable, so it declares its own attempt budget and
 * whether it needs per-aggregate ordering; the registry refuses a declaration it cannot honour.
 */
export interface IEventConsumer {
	/** Stable key, namespaced by the owning module, for example `notification.order-confirmation`. */
	readonly key: string;
	/** Defaults to `subscriber` when the consumer runs in process. */
	readonly kind?: EventConsumerKind;
	/** Event names this consumer wants, matched exactly. */
	readonly events: string[];
	/** Defaults to `reorderable`; a strict consumer rejects a gap and is redelivered later. */
	readonly ordering?: EventConsumerOrdering;
	/** Attempt budget before the delivery is dead-lettered. */
	readonly maxAttempts?: number;
	handle(event: IEventEnvelope, context: IEventConsumerContext): Promise<void>;
}

/**
 * What a consumer is handed while it runs.
 *
 * The context owns the delivery record, so a consumer that never touches it is still protected
 * against duplicate deliveries: the record exists before the consumer is invoked and is only
 * marked delivered after the consumer reports success.
 */
export interface IEventConsumerContext {
	/** `<kind>:<key>` of the consumer this context belongs to. */
	readonly consumerKey: string;
	/** True when this consumer already acknowledged the event. */
	alreadyDelivered(): Promise<boolean>;
	/** Marks the delivery delivered; called by the runner when the consumer returns. */
	markDelivered(): Promise<void>;
	/** Throws when an earlier event of the same partition has not been delivered yet. */
	assertOrder(event: IEventEnvelope): Promise<void>;
}
