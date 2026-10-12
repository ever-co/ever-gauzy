import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';

/**
 * Lifecycle of a stored idempotency key.
 *
 * The three values are the whole vocabulary a retrying client needs: the work is either still
 * running, finished, or terminally broken. A key that is terminally broken is replayed rather than
 * retried, because retrying under the same key would repeat a request the server already refused.
 */
export enum IdempotencyStatus {
	/** A first request holds the key and is still working. */
	IN_PROGRESS = 'IN_PROGRESS',
	/** The work finished; the stored response is replayed verbatim. */
	COMPLETED = 'COMPLETED',
	/** The work failed terminally; the stored error response is replayed. */
	FAILED = 'FAILED'
}

/**
 * How a request that presented an idempotency key was answered.
 */
export enum IdempotencyOutcome {
	/** The key was free, or its lock was stale; the caller owns it and must run the work. */
	CLAIMED = 'CLAIMED',
	/** The key already holds a terminal response, which is replayed to the caller. */
	REPLAYED = 'REPLAYED',
	/** Another request holds the key and is still working. */
	IN_FLIGHT = 'IN_FLIGHT',
	/** The key was used before with a different request body. */
	REUSED_KEY = 'REUSED_KEY'
}

/**
 * The response a completed or failed attempt left behind.
 */
export interface IIdempotencyResponse {
	/** HTTP status of the stored response. */
	status: number;
	/** The stored response body, replayed verbatim. */
	body?: JsonData;
}

/**
 * A granted claim on an idempotency key, or the reason no claim was granted.
 */
export interface IIdempotencyClaim {
	outcome: IdempotencyOutcome;
	/** The stored row, whether it was just created or found. */
	record: IIdempotencyKey;
	/** The stored response, present when the outcome is `REPLAYED`. */
	response?: IIdempotencyResponse;
	/** How long to wait before presenting the key again, present when the outcome is `IN_FLIGHT`. */
	retryAfterMs?: number;
}

/**
 * A request to claim an idempotency key.
 */
export interface IIdempotencyStartInput {
	/** Operation namespace, for example `checkout.complete`; two operations may reuse one client key. */
	scope: string;
	/** The client-supplied key, taken from the `Idempotency-Key` header. */
	key: string;
	/** Hash of the canonicalised request body; the same key with a different body is a conflict. */
	requestHash: string;
	/** How long the stored response stays replayable; defaults to the service's retention window. */
	retentionMs?: number;
	/** What the claim is expected to create, recorded when the work completes. */
	resourceType?: string;
	/** Id of the resource the claim is expected to create. */
	resourceId?: ID;
}

/**
 * The outcome of a claimed key.
 */
export interface IIdempotencyCompletion {
	/** HTTP status to replay. */
	responseStatus?: number;
	/** Response body to replay. */
	responseBody?: JsonData;
	/** What was created, for operators reading the row. */
	resourceType?: string;
	/** Id of what was created. */
	resourceId?: ID;
}

/**
 * A stored idempotency key.
 *
 * The row is the lock: the unique tuple `(organizationId, scope, key)` means two concurrent
 * identical requests cannot both insert, so the loser of the race learns that the work is already
 * in flight instead of repeating it. A row that holds a terminal response is replayed without the
 * work running a second time.
 */
export interface IIdempotencyKey extends IBasePerTenantAndOrganizationEntityModel {
	/** The client-supplied value. */
	key: string;

	/** Operation namespace the key was presented for. */
	scope: string;

	/** SHA-256 of the canonicalised request body. */
	requestHash: string;

	/** Where the attempt stands. */
	status: IdempotencyStatus;

	/** HTTP status of the stored response. */
	responseStatus?: number;

	/** The stored response, replayed verbatim. */
	responseBody?: JsonData;

	/** What was created, for example `order`. */
	resourceType?: string;

	/** Id of the created resource. */
	resourceId?: ID;

	/** Retention horizon; the cleanup job deletes expired rows. */
	expiresAt: Date;

	/** When the in-progress lock was taken, so a stale lock can be taken over. */
	lockedAt?: Date;
}
