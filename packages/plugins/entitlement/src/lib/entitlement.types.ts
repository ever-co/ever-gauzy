import { ID, IRuleCreateInput, JsonData } from '@gauzy/contracts';
import {
	EntitlementActivationStatus,
	EntitlementKeyStatus,
	EntitlementKind,
	EntitlementStatus,
	LicenceKeyFormat
} from './entitlement.enums';
import { Entitlement } from './entitlement/entitlement.entity';
import { EntitlementActivation } from './entitlement-activation/entitlement-activation.entity';
import { EntitlementKey } from './entitlement-key/entitlement-key.entity';

/*
|--------------------------------------------------------------------------
| Why an entitlement check answered what it answered
|--------------------------------------------------------------------------
*/

/**
 * The stable outcome codes the check answers with.
 *
 * The codes are the contract: a consumer branches on them, and the REST and GraphQL surfaces carry
 * the same string, so a denial is never a message a client has to parse. `ALLOWED` is the only
 * positive value, and it is present so that "allowed" and "no reason recorded" cannot be confused.
 */
export const EntitlementCheckReason = {
	/** The right is in force, inside its term, below both limits and its conditions matched. */
	ALLOWED: 'ALLOWED',
	/** Nothing matched the reference, or the row belongs to another tenant. */
	NOT_FOUND: 'ENTITLEMENT_NOT_FOUND',
	/** Granted but not yet in force: the payment has not settled. */
	PENDING: 'ENTITLEMENT_PENDING',
	/** Withdrawn temporarily — dunning, a dispute, an operator pause. */
	SUSPENDED: 'ENTITLEMENT_SUSPENDED',
	/** Past `endsAt + gracePeriodDays`, or terminated with `EXPIRED`. */
	EXPIRED: 'ENTITLEMENT_EXPIRED',
	/** Terminated deliberately. Never reactivated; a new right is issued instead. */
	REVOKED: 'ENTITLEMENT_REVOKED',
	/** The term has not started yet. */
	TERM_NOT_STARTED: 'ENTITLEMENT_TERM_NOT_STARTED',
	/** The live activations already fill the granted `quantity`. */
	QUANTITY_EXHAUSTED: 'ENTITLEMENT_QUANTITY_EXHAUSTED',
	/** The entitlement's own simultaneous-activation ceiling is reached. */
	ACTIVATION_LIMIT_REACHED: 'ENTITLEMENT_ACTIVATION_LIMIT_REACHED',
	/** The request named neither an entitlement nor a key. */
	REFERENCE_REQUIRED: 'ENTITLEMENT_REFERENCE_REQUIRED',
	/** The key is not a key this organization issued. */
	KEY_NOT_FOUND: 'ENTITLEMENT_KEY_NOT_FOUND',
	/** The key was withdrawn. */
	KEY_REVOKED: 'ENTITLEMENT_KEY_REVOKED',
	/** The key is past its own `expiresAt`. */
	KEY_EXPIRED: 'ENTITLEMENT_KEY_EXPIRED',
	/** The key was already consumed by an activation of another device. */
	KEY_USED: 'ENTITLEMENT_KEY_USED',
	/** The `rule` rows attached to the entitlement did not match the request. */
	CONDITIONS_NOT_MET: 'ENTITLEMENT_CONDITIONS_NOT_MET'
} as const;

/** One of the stable outcome codes above. */
export type EntitlementCheckReasonValue =
	(typeof EntitlementCheckReason)[keyof typeof EntitlementCheckReason];

/**
 * What a check answered.
 *
 * A denial is an answer with `allowed: false` and a code, never an error: a caller asking whether it
 * may run is asking a question, and answering it with a transport failure would make "no" and "the
 * licensing service is down" indistinguishable.
 */
export interface IEntitlementCheckResult {
	/** Whether the right may be exercised. */
	readonly allowed: boolean;
	/** Why it may or may not be, as one of the stable codes. */
	readonly reason: EntitlementCheckReasonValue;
	/** The right the answer is about, when one was found. */
	readonly entitlementId?: ID;
	/** The kind of the right, when one was found. */
	readonly kind?: EntitlementKind;
	/** The state of the right at the moment of the check. */
	readonly status?: EntitlementStatus;
	/**
	 * Seats or uses still available, as a whole number; null when the right is unlimited
	 * (`quantity = 0`) or when no right was found.
	 */
	readonly remainingQuantity?: number | null;
	/** The instant the right stops being exercisable; null is the perpetual case. */
	readonly validUntil?: Date | null;
	/** Whether the `rule` rows attached to the right matched. */
	readonly conditionsMatched: boolean;
	/** The rules that did not match, by id or attribute, so a denial is explainable. */
	readonly failedRules?: Array<string | ID>;
	/** Attributes the evaluation context did not carry, which make their rule not match. */
	readonly unresolvedAttributes?: string[];
}

/**
 * A check request.
 *
 * Either a key or an entitlement is named; when both are, the key is resolved first and the
 * entitlement it belongs to is what is checked, because that is the pair a client actually holds.
 */
export interface IEntitlementCheckInput {
	/** The right to check. */
	readonly entitlementId?: ID;
	/** The licence key the caller holds, in clear; it is digested once for a single indexed probe. */
	readonly key?: string;
	/** The device or instance asking; used to report whether it already holds a slot. */
	readonly deviceId?: string;
	/** The named seat asking. */
	readonly seatReference?: string;
	/** Attributes the attached `rule` rows are evaluated against, merged over the derived context. */
	readonly context?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Inputs and results of the write paths
|--------------------------------------------------------------------------
*/

/**
 * The tenant and organization a write belongs to.
 *
 * A request carries them in its context; an event carries them in its envelope, and a consumer runs
 * outside any request at all. Every write path therefore accepts the scope explicitly and falls back
 * to the request context, so the same implementation serves an operator's call and a replayed order
 * event without one of them having to pretend to be the other.
 */
export interface IEntitlementScope {
	readonly tenantId?: ID;
	readonly organizationId?: ID;
}

/**
 * What grants a right.
 *
 * The provenance is `orderLineId` when the purchase has lines, or `subscriptionId` when a billing
 * cycle is what keeps the right alive; both may be absent when an operator grants a right that no
 * purchase produced, which is the one case the `ENTITLEMENTS_GRANT` permission exists for.
 */
export interface IEntitlementGrantInput {
	/** The party the right is granted to. */
	readonly customerId?: ID;
	/** The order that granted it. */
	readonly orderId?: ID;
	/** The line that granted it — with `orderId` this is the full provenance of the right. */
	readonly orderLineId?: ID;
	/** The subscription that renews it, when one does. */
	readonly subscriptionId?: ID;
	/** The catalogue item the right is over. */
	readonly productId?: ID;
	/** The variant the right is over, when it is over one. */
	readonly variantId?: ID;
	/** What the purchase granted. Defaults to `LICENCE`. */
	readonly kind?: EntitlementKind;
	/** The ceiling: seats for `SEAT`, allowed uses for `USAGE`, `1` for a single right, `0` for unlimited. */
	readonly quantity?: number;
	/** The instant the right becomes exercisable; defaults to now. */
	readonly startsAt?: Date;
	/** The instant it stops; null is the perpetual case. */
	readonly endsAt?: Date;
	/** Days after `endsAt` during which the right stays in force while a renewal is chased. */
	readonly gracePeriodDays?: number;
	/** Maximum simultaneous activations, when that is tighter than `quantity`. */
	readonly activationLimit?: number;
	/** Tenant extras: the licence tier, the feature flags the right carries. */
	readonly metadata?: JsonData;
	/** Conditions attached to the right, stored as `rule` rows against it. */
	readonly conditions?: IRuleCreateInput[];
	/** An explicit number; when absent one is allocated from the `ENTITLEMENT` series. */
	readonly number?: string;
	/** Issue a licence key in the same transaction and return its plaintext once. */
	readonly issueKey?: boolean;
	/** The format of the key to issue, when one is. */
	readonly keyFormat?: LicenceKeyFormat;
	/** The holder the issued key is assigned to, when it is not the caller. */
	readonly assignedToEmail?: string;
	/** Grant the right already in force instead of `PENDING`. */
	readonly activateImmediately?: boolean;
}

/** What a grant produced. */
export interface IEntitlementGrantResult {
	/** The right, newly granted or the one a replayed grant returned. */
	readonly entitlement: Entitlement;
	/** Whether this call created the right, or returned one an earlier call created. */
	readonly created: boolean;
	/** The key that was issued, when one was. */
	readonly key?: EntitlementKey;
	/** The plaintext of that key. Present exactly once, in the response to this call, and never again. */
	readonly plaintextKey?: string;
}

/** An activation request. */
export interface IEntitlementActivationInput {
	/** The right being activated against. */
	readonly entitlementId: ID;
	/** The stable device or instance identifier the limit is counted over. */
	readonly deviceId: string;
	/** Human-readable name shown to support. */
	readonly deviceName?: string;
	/** Hash of the hardware or instance fingerprint. */
	readonly fingerprint?: string;
	/** The named seat this activation occupies, when the right is seat-based. */
	readonly seatReference?: string;
	/** The licence key presented, when activation goes through one. */
	readonly key?: string;
	/** The buyer performing the activation, when it came from a logged-in customer. */
	readonly activatedByCustomerId?: ID;
	/** Address of the call that created the activation. */
	readonly ipAddress?: string;
	/** Client identification, retained for support. */
	readonly userAgent?: string;
	/** Tenant extras: product version, OS, locale. */
	readonly metadata?: JsonData;
	/**
	 * How long a refresh of `lastSeenAt` is throttled for, in seconds.
	 *
	 * Stated per call rather than stored: the interval is a property of how chatty the client is, and
	 * a client that validates once a day should not write a timestamp on every launch just because
	 * another client does.
	 */
	readonly seenIntervalSeconds?: number;
}

/** What an activation produced. */
export interface IEntitlementActivationResult {
	/** The activation row — a new one, or the live one a retried first run already created. */
	readonly activation: EntitlementActivation;
	/** The right it occupies a slot of. */
	readonly entitlement: Entitlement;
	/** Whether this call created the activation. */
	readonly created: boolean;
	/** Seats or uses still available afterwards, or null when the right is unlimited. */
	readonly remainingQuantity: number | null;
}

/** A licence-key issuance request. */
export interface IEntitlementKeyIssueInput {
	/** The right the key is issued against. */
	readonly entitlementId: ID;
	/** Which generator renders it. Defaults to `UUID`. */
	readonly format?: LicenceKeyFormat;
	/** The recipient, when the key is delivered to someone. */
	readonly assignedToEmail?: string;
	/** The party the key is assigned to. */
	readonly assignedToCustomerId?: ID;
	/** Per-key override of the entitlement's activation limit; null inherits. */
	readonly activationLimit?: number;
	/** The key's own expiry, which may be earlier than the entitlement's. */
	readonly expiresAt?: Date;
	/**
	 * Store a recoverable ciphertext of the key so an operator can re-display it to its holder.
	 *
	 * Off by default: a key issued write-only is unrecoverable by design, and the recovery path for a
	 * lost key is a re-issue, which revokes the old one and leaves an audit trail.
	 */
	readonly storeKey?: boolean;
	/** Tenant extras. */
	readonly metadata?: JsonData;
}

/** What an issuance produced. */
export interface IEntitlementKeyIssueResult {
	/** The stored key row: digest, prefix and status, never the plaintext. */
	readonly key: EntitlementKey;
	/** The plaintext. Returned once, in the response to this call, and never persisted in clear. */
	readonly plaintext: string;
}

/** What a re-issue produced. */
export interface IEntitlementKeyReissueResult extends IEntitlementKeyIssueResult {
	/** The key that was revoked to replace it. */
	readonly replacedKey: EntitlementKey;
}

/*
|--------------------------------------------------------------------------
| Capabilities this plugin reaches but does not own
|--------------------------------------------------------------------------
*/

/**
 * The catalogue capability, reached through an optional port.
 *
 * An entitlement names the product and the variant it is over by identifier, and this plugin never
 * maps another package's tables. When the catalogue capability registers a provider under this
 * token, a GraphQL read can resolve the referenced product; when it does not, the identifier is
 * still returned and the reference resolves to null rather than to a second, staler copy of a row
 * this package has no business reading.
 */
export const ENTITLEMENT_CATALOG_PORT = 'ENTITLEMENT_CATALOG_PORT';

/** What the catalogue port answers about a referenced item. */
export interface IEntitlementCatalogItem {
	readonly id: ID;
	readonly name?: string;
	readonly sku?: string;
}

/** The catalogue capability as this package consumes it. */
export interface IEntitlementCatalogPort {
	/** Reads one product by identifier. */
	findProduct(id: ID): Promise<IEntitlementCatalogItem | null>;
	/** Reads one variant by identifier. */
	findVariant(id: ID): Promise<IEntitlementCatalogItem | null>;
}

/*
|--------------------------------------------------------------------------
| The events this domain consumes and produces
|--------------------------------------------------------------------------
*/

/**
 * The order, payment and subscription events the grant path consumes.
 *
 * Consumption is by event *name*, through the platform's consumer registry, which is what lets this
 * package act on another domain's facts without importing its classes and without reading its
 * tables. The payload is the projection the producing domain published; anything this package needs
 * and the payload does not carry is reported rather than looked up.
 */
export const ENTITLEMENT_CONSUMED_EVENTS: string[] = [
	'order.placed',
	'order.completed',
	'order.canceled',
	'payment.captured',
	'payment.refunded',
	'subscription.activated',
	'subscription.renewed',
	'subscription.payment-failed',
	'subscription.canceled',
	'subscription.expired'
];

/** The event names this domain writes to the outbox. */
export const EntitlementEventName = {
	CREATED: 'entitlement.created',
	ACTIVATED: 'entitlement.activated',
	DEACTIVATED: 'entitlement.deactivated',
	SUSPENDED: 'entitlement.suspended',
	RENEWED: 'entitlement.renewed',
	REDUCED: 'entitlement.reduced',
	REVOKED: 'entitlement.revoked',
	EXPIRED: 'entitlement.expired',
	KEY_ISSUED: 'entitlement-key.issued',
	KEY_REVOKED: 'entitlement-key.revoked'
} as const;

/** The reasons a right is withdrawn with, when the platform rather than an operator decided. */
export const EntitlementRevocationReason = {
	/** The order that granted it was refunded in full. */
	REFUNDED: 'REFUNDED',
	/** The payment was reversed by the customer's bank. */
	CHARGEBACK: 'CHARGEBACK',
	/** The goods came back. */
	RETURNED: 'RETURNED',
	/** The customer asked for their data to be erased. */
	DATA_ERASURE: 'DATA_ERASURE',
	/** The subscription that kept it alive ended. */
	SUBSCRIPTION_ENDED: 'SUBSCRIPTION_ENDED'
} as const;

/** The reason a right is suspended with. */
export const EntitlementSuspensionReason = {
	/** Dunning suspended it; a successful payment resumes it. */
	PAYMENT_FAILED: 'PAYMENT_FAILED'
} as const;

/** The key statuses that still represent a usable credential. */
export const USABLE_KEY_STATUSES: EntitlementKeyStatus[] = [
	EntitlementKeyStatus.ISSUED,
	EntitlementKeyStatus.ACTIVATED
];

/** The activation statuses that occupy a slot of an entitlement. */
export const LIVE_ACTIVATION_STATUSES: EntitlementActivationStatus[] = [EntitlementActivationStatus.ACTIVE];

/** The entitlement statuses a right may still be activated against. */
export const ACTIVATABLE_STATUSES: EntitlementStatus[] = [
	EntitlementStatus.PENDING,
	EntitlementStatus.ACTIVE
];
