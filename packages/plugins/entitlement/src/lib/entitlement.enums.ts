/**
 * The whole vocabulary of the entitlement domain.
 *
 * Four enums, and deliberately no fifth: the *subject* of an entitlement — which product, which
 * plan, which variant — is a foreign key, and the *conditions* attached to it are `rule` rows
 * evaluated by the platform rule engine. A closed value set exists here only where a consumer has to
 * branch on the value and where "entitled or not" must mean the same thing to every reader.
 */

/**
 * Where a right is in its life.
 *
 * The set is closed because the entitlement check, the renewal path and the revocation path each
 * branch on it, and a consumer that invented a sixth value could not be answered.
 */
export enum EntitlementStatus {
	/** Granted by a placed order whose payment has not settled, or drafted by an operator. Nothing may be activated against it. */
	PENDING = 'PENDING',
	/** In force. Activations may be created while activations remain below `quantity` and the term has not ended. */
	ACTIVE = 'ACTIVE',
	/** Temporarily withdrawn — a failed renewal, a dispute, an operator pause. Reversible; existing activations are retained but refused at use. */
	SUSPENDED = 'SUSPENDED',
	/** Past `endsAt + gracePeriodDays`. Terminal apart from an explicit renewal, which extends the same row and returns it to `ACTIVE`. */
	EXPIRED = 'EXPIRED',
	/** Terminated deliberately — a refund, a fraud decision, a breach of terms. Terminal and irreversible through the API. */
	REVOKED = 'REVOKED'
}

/**
 * What a device, instance or named user is doing with a slot.
 *
 * Seat arithmetic reads exactly one value (`ACTIVE`), and each of the other three has a different
 * cause and a different audit meaning — a boolean would make "released" and "revoked"
 * indistinguishable in a report, which is precisely the question a licence audit asks.
 */
export enum EntitlementActivationStatus {
	/** Holding a seat or a named activation. Only `ACTIVE` rows count against `entitlement.quantity`. */
	ACTIVE = 'ACTIVE',
	/** Given back by the holder: an uninstall, a device reset. The available count rises again. */
	RELEASED = 'RELEASED',
	/** Terminated by an operator or by the platform — a suspected key share. Distinct from `RELEASED` because the release was not the holder's decision. */
	REVOKED = 'REVOKED',
	/** The activation carried its own term, which ended before the entitlement did. */
	EXPIRED = 'EXPIRED'
}

/**
 * What an issued credential may still be used for.
 *
 * A key is a bearer credential, so the value is the acceptance rule of the activation endpoint and
 * the gate on re-issue. The key material itself is a column, never a value.
 */
export enum EntitlementKeyStatus {
	/** Generated and delivered; not yet activated. May be re-issued while in this state, which is what makes a lost delivery recoverable. */
	ISSUED = 'ISSUED',
	/** Consumed by an activation. A key is activated at most once; a second attempt is refused. */
	ACTIVATED = 'ACTIVATED',
	/** Withdrawn before or after activation by an operator. Never reactivated. */
	REVOKED = 'REVOKED',
	/** Past its own `expiresAt`, which may be earlier than the entitlement's. */
	EXPIRED = 'EXPIRED'
}

/**
 * What the purchase granted, which decides what `quantity` counts and which check the activation
 * path runs.
 */
export enum EntitlementKind {
	/** A named right, usually delivered as a key. One right, activated by whoever holds the credential. */
	LICENCE = 'LICENCE',
	/** A countable unit: `quantity` seats may be held at once, and an activation above that count is refused. */
	SEAT = 'SEAT',
	/** A right that exists only while a period is paid. `endsAt` is what a subscription renewal extends, and a lapsed subscription suspends the right rather than revoking it. */
	TERM = 'TERM',
	/** A metered allowance: `quantity` counts the permitted uses, and the activation path counts consumption rather than concurrency. */
	USAGE = 'USAGE'
}

/**
 * The licence-key formats this package can generate.
 *
 * The format is recorded on every row so that a future generator does not invalidate the keys
 * already in the field: a key is validated by its digest, and the format only ever decides how a new
 * one is rendered.
 */
export enum LicenceKeyFormat {
	/** A canonical UUID, lower case, hyphenated. */
	UUID = 'UUID',
	/** Four groups of four upper-case alphanumerics, hyphen separated. */
	GROUPED_16 = 'XXXX-XXXX-XXXX-XXXX',
	/** Twenty characters of an unambiguous upper-case alphabet, grouped in fours. */
	BASE32_20 = 'BASE32-20'
}

/**
 * The configured hash throttle for `lastSeenAt`: a client that validates on every launch must not
 * turn validation into a write storm, so the timestamp is refreshed at most once per interval.
 */
export const DEFAULT_LAST_SEEN_THROTTLE_MS = 15 * 60 * 1000;

/** Days of grace applied to a right whose `gracePeriodDays` is not stated. */
export const DEFAULT_GRACE_PERIOD_DAYS = 0;

/** The series key entitlement numbers are allocated from. */
export const ENTITLEMENT_NUMBER_KEY = 'ENTITLEMENT';

/** The default number of characters kept in clear as a key's display prefix. */
export const DEFAULT_KEY_PREFIX_LENGTH = 8;
