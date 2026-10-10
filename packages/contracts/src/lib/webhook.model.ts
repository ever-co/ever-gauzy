import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';

/**
 * Where an outbound webhook delivery attempt stands.
 *
 * `DEAD` is terminal and is reached only after the final scheduled attempt, so a delivery listed as
 * dead is one an operator can act on rather than one that is still quietly retrying.
 */
export enum WebhookDeliveryStatus {
	/** Created and not yet attempted, or awaiting `nextAttemptAt`. */
	PENDING = 'PENDING',
	/** The endpoint answered 2xx; `deliveredAt` is set and the subscription's failure count resets. */
	DELIVERED = 'DELIVERED',
	/** The last attempt failed and a further attempt is scheduled. */
	FAILED = 'FAILED',
	/** The final scheduled attempt failed. Terminal. */
	DEAD = 'DEAD'
}

/**
 * The fixed header names every delivery carries.
 *
 * They are neutral on purpose: the same headers carry a contact event, an invoice event or an order
 * event to the same receiver, so a receiver implemented once works for every event the platform
 * emits. A subscription's event selection — not its headers — distinguishes the streams.
 */
export enum WebhookHeader {
	/** The event name. */
	EVENT = 'X-Event',
	/** The event id; the receiver's idempotency key. */
	EVENT_ID = 'X-Event-Id',
	/** The delivery attempt id, unique per attempt and distinct from the event id. */
	DELIVERY = 'X-Delivery',
	/** `t=<unix-seconds>,v1=<hex hmac-sha256>`. */
	SIGNATURE = 'X-Signature',
	/** The pinned payload version. */
	API_VERSION = 'X-Api-Version',
	/** 1-based attempt number. */
	ATTEMPT = 'X-Attempt',
	/** Tenant id, so a multi-tenant receiver can route before parsing. */
	TENANT = 'X-Tenant'
}

/**
 * An outbound delivery endpoint.
 *
 * A subscription is how a consumer outside the platform receives events. One subscription per
 * `(organization, url)`, because a duplicate endpoint would double-deliver every event; and a
 * subscription that keeps failing is disabled rather than left to hammer the endpoint forever.
 */
export interface IWebhookSubscription extends IBasePerTenantAndOrganizationEntityModel {
	/** Operator-facing name. */
	name: string;

	/** Absolute HTTPS endpoint. */
	url: string;

	/** HMAC signing secret, encrypted at rest and excluded from every response projection. */
	secret: string;

	/** Subscribed event names or patterns, for example `order.placed` or `order.*`. */
	events: string[];

	/** Channel the subscription listens to; null means every channel. */
	channelId?: ID;

	/** Free-text note for operators. */
	description?: string;

	/** Static extra headers sent with every delivery; never allowed to override the reserved ones. */
	headers?: JsonData;

	/** Contract version the consumer expects, echoed in the delivery headers. */
	apiVersion?: string;

	/** Consecutive failures; reset on success. */
	failureCount: number;

	/** When the endpoint last accepted a delivery. */
	lastSuccessAt?: Date;

	/** When the endpoint last refused one. */
	lastFailureAt?: Date;

	/** Set when the failure count crossed the auto-disable threshold. */
	disabledAt?: Date;

	/** Operator metadata, including the previous secret and its expiry during a rotation. */
	metadata?: JsonData;
}

/**
 * One attempt-history row for a `(subscription, event)` pair.
 *
 * The unique pair is what makes the dispatcher idempotent: a re-run of the outbox dispatcher cannot
 * double-send, because the second attempt at the same pair fails the insert. The payload is stored
 * when the row is created and never regenerated, so a replay sends exactly what was intended.
 */
export interface IWebhookDelivery extends IBasePerTenantAndOrganizationEntityModel {
	/** The subscription the delivery belongs to. */
	subscriptionId: ID;

	/** The `event_outbox.eventId`; no foreign key, because deliveries outlive outbox retention. */
	eventId: ID;

	/** Denormalised so a delivery list is readable without the outbox row. */
	eventName: string;

	/** The exact body that will be, or was, sent. */
	payload: JsonData;

	status: WebhookDeliveryStatus;

	attemptCount: number;

	/** HTTP status of the last attempt. */
	responseStatus?: number;

	/** Truncated response body, for triage. */
	responseBody?: string;

	/** How long the last attempt took. */
	durationMs?: number;

	/** The retry scan key: when the next attempt is due. */
	nextAttemptAt?: Date;

	/** When the endpoint acknowledged the delivery. */
	deliveredAt?: Date;

	/** Transport, TLS or timeout error of the last attempt. */
	lastError?: string;
}

/**
 * The result of one delivery attempt, as recorded on the delivery row.
 */
export interface IWebhookAttemptResult {
	/** True when the endpoint answered 2xx. */
	delivered: boolean;
	/** HTTP status of the attempt, absent when the request never completed. */
	responseStatus?: number;
	/** Response body, truncated for diagnostics. */
	responseBody?: string;
	/** Transport, TLS or timeout error. */
	lastError?: string;
	/** How long the attempt took. */
	durationMs: number;
}
