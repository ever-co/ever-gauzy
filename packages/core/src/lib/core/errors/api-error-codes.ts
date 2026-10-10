/**
 * The platform's error codes, and the mapping from an HTTP status to the code a response carries
 * when the throw site named none.
 *
 * A code is part of the public contract in a way a message is not: `message` is human-facing and
 * may be reworded at any time, while a client branches on `code` forever. That is why the
 * catalogue is ONE plain object, in ONE file, with no runtime registration:
 *
 * - it can be read, diffed and asserted without booting Nest, a database or an ORM, which is what
 *   the contract gate in `tools/scripts/` does;
 * - a code cannot be introduced by a package at import time, so "which codes exist" has exactly
 *   one answer for the whole product;
 * - a domain package that needs its own codes adds a block to this object — `ORDER_VERSION_CONFLICT`,
 *   `STOCK_INSUFFICIENT`, `PAYMENT_AUTHORIZATION_FAILED` — in the domain's own block. Shared
 *   infrastructure carries no domain prefix, and a domain code carries no surface prefix: there is
 *   one API surface, so nothing may be named after the fact that it happened to be emitted by a
 *   resolver rather than a controller.
 *
 * Naming: `SCREAMING_SNAKE_CASE`, `<AREA>_<REASON>`. The area is the concern the caller can act on
 * (`VALIDATION`, `QUERY`, `IDEMPOTENCY`, `ENTITY`, `BULK`, `OPERATION`, `PERMISSION`, `CHANNEL`,
 * `GRAPHQL`, `SEARCH`), never the layer that raised it.
 */

/**
 * Every code the platform may return. The keys and the values are deliberately identical: the key
 * is what a caller writes in TypeScript (`ApiErrorCode.VALIDATION_FAILED`) and the value is what
 * travels on the wire, and keeping them the same string means a log line, a ticket, a client
 * constant and a `switch` arm are all greppable by one token.
 */
export const ApiErrorCode = {
	/* ------------------------------------------------------------------ *
	 * Validation — the request itself is malformed
	 * ------------------------------------------------------------------ */

	/** Class-validator rejected the body or the query. `details.violations` carries the fields. */
	VALIDATION_FAILED: 'VALIDATION_FAILED',
	/** A field the operation cannot proceed without was absent. */
	VALIDATION_REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
	/** Whitelist rejection: the field is not part of the DTO. */
	VALIDATION_UNKNOWN_FIELD: 'VALIDATION_UNKNOWN_FIELD',
	/** A value outside the enum, or an empty `in` list. */
	VALIDATION_INVALID_ENUM: 'VALIDATION_INVALID_ENUM',
	/** A range whose ends are reversed or unparseable. */
	VALIDATION_INVALID_DATE_RANGE: 'VALIDATION_INVALID_DATE_RANGE',
	/** A monetary value arrived as a float, or with more fraction digits than the currency allows. */
	VALIDATION_MONEY_PRECISION: 'VALIDATION_MONEY_PRECISION',
	/** The body exceeded the parser limit, or a bulk payload exceeded its own cap. */
	VALIDATION_PAYLOAD_TOO_LARGE: 'VALIDATION_PAYLOAD_TOO_LARGE',
	/** The query string exceeded the length the platform accepts. */
	VALIDATION_URI_TOO_LONG: 'VALIDATION_URI_TOO_LONG',
	/** A path segment that is meant to be an identifier is not one. */
	VALIDATION_INVALID_PATH_ID: 'VALIDATION_INVALID_PATH_ID',

	/* ------------------------------------------------------------------ *
	 * Query protocol — the request is well-formed but asks for something the resource does not allow
	 * ------------------------------------------------------------------ */

	/** The field is not in the resource's `filterable` list. */
	QUERY_UNKNOWN_FILTER_FIELD: 'QUERY_UNKNOWN_FILTER_FIELD',
	/** The operator does not apply to the field's kind. */
	QUERY_UNSUPPORTED_OPERATOR: 'QUERY_UNSUPPORTED_OPERATOR',
	/** The filter path is deeper than the protocol allows, or an `in` list is too wide. */
	QUERY_FILTER_DEPTH_EXCEEDED: 'QUERY_FILTER_DEPTH_EXCEEDED',
	/** `$and`/`$or` nesting, or the number of keys, is above the limit. */
	QUERY_NESTING_LIMIT_EXCEEDED: 'QUERY_NESTING_LIMIT_EXCEEDED',
	/** The field is not sortable, or more sort keys were given than the cap allows. */
	QUERY_SORT_NOT_ALLOWED: 'QUERY_SORT_NOT_ALLOWED',
	/** The `fields` path is not in the resource's `selectable` list. */
	QUERY_FIELD_NOT_SELECTABLE: 'QUERY_FIELD_NOT_SELECTABLE',
	/** The `expand` relation is not in the resource's `expandable` list. */
	QUERY_EXPAND_NOT_ALLOWED: 'QUERY_EXPAND_NOT_ALLOWED',
	/** Expansion went deeper than the allowed depth. */
	QUERY_EXPAND_DEPTH_EXCEEDED: 'QUERY_EXPAND_DEPTH_EXCEEDED',
	/** The page size or page number is above the cap. */
	QUERY_PAGE_LIMIT_EXCEEDED: 'QUERY_PAGE_LIMIT_EXCEEDED',
	/** The cursor could not be decoded. */
	QUERY_CURSOR_INVALID: 'QUERY_CURSOR_INVALID',
	/** The cursor was minted for a different sort than the one requested. */
	QUERY_CURSOR_SORT_MISMATCH: 'QUERY_CURSOR_SORT_MISMATCH',
	/** The legacy single-JSON parameter could not be mapped onto the protocol. */
	QUERY_LEGACY_DATA_PARAM_INVALID: 'QUERY_LEGACY_DATA_PARAM_INVALID',
	/** The legacy parameter was combined with the parameters that replaced it. */
	QUERY_LEGACY_DATA_PARAM_CONFLICT: 'QUERY_LEGACY_DATA_PARAM_CONFLICT',

	/* ------------------------------------------------------------------ *
	 * Idempotency — a retry that cannot be answered safely
	 * ------------------------------------------------------------------ */

	/** The operation requires an `Idempotency-Key` and none was sent. */
	IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
	/** The key was already used for a different request. */
	IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
	/** The first attempt with this key is still running. */
	IDEMPOTENCY_IN_PROGRESS: 'IDEMPOTENCY_IN_PROGRESS',
	/** The key belongs to a different operation scope. */
	IDEMPOTENCY_SCOPE_MISMATCH: 'IDEMPOTENCY_SCOPE_MISMATCH',
	/** The stored outcome of the first attempt was a failure. */
	IDEMPOTENCY_FAILED_PREVIOUSLY: 'IDEMPOTENCY_FAILED_PREVIOUSLY',

	/* ------------------------------------------------------------------ *
	 * Concurrency — a write against a state the caller no longer holds
	 * ------------------------------------------------------------------ */

	/** The supplied version does not match the stored one. `details` names both. */
	ENTITY_VERSION_CONFLICT: 'ENTITY_VERSION_CONFLICT',
	/** The operation is conditional and the caller sent no `If-Match`. */
	VERSION_REQUIRED: 'VERSION_REQUIRED',
	/** A lost update on a resource that is not versioned. */
	CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
	/** A precondition the operation demands was not supplied. */
	PRECONDITION_REQUIRED: 'PRECONDITION_REQUIRED',
	/** A unique column already holds the value. */
	UNIQUE_CONSTRAINT_VIOLATION: 'UNIQUE_CONSTRAINT_VIOLATION',

	/* ------------------------------------------------------------------ *
	 * Bulk and long-running operations
	 * ------------------------------------------------------------------ */

	/** More items than the bulk cap allows. */
	BULK_LIMIT_EXCEEDED: 'BULK_LIMIT_EXCEEDED',
	/** Every item of the batch failed, so the batch is a failure. */
	BULK_ALL_ITEMS_FAILED: 'BULK_ALL_ITEMS_FAILED',
	/** The operation id is unknown, or its record has been cleaned up. */
	OPERATION_NOT_FOUND: 'OPERATION_NOT_FOUND',
	/** The operation is still running and cannot be cancelled at its current step. */
	OPERATION_IN_PROGRESS: 'OPERATION_IN_PROGRESS',
	/** The operation is terminal and cannot be cancelled. */
	OPERATION_NOT_CANCELABLE: 'OPERATION_NOT_CANCELABLE',
	/** The operation cannot be replayed — it is not idempotent. */
	OPERATION_NOT_REPLAYABLE: 'OPERATION_NOT_REPLAYABLE',
	/** The operation exceeded the deadline it was accepted with. */
	OPERATION_DEADLINE_EXCEEDED: 'OPERATION_DEADLINE_EXCEEDED',

	/* ------------------------------------------------------------------ *
	 * Authorisation, scope and capability
	 * ------------------------------------------------------------------ */

	/** No credential was presented on a route that requires one. */
	AUTH_REQUIRED: 'AUTH_REQUIRED',
	/** The caller holds no permission for the operation. */
	PERMISSION_DENIED: 'PERMISSION_DENIED',
	/** The record belongs to another tenant. */
	TENANT_MISMATCH: 'TENANT_MISMATCH',
	/** The record belongs to another organization. */
	ORGANIZATION_MISMATCH: 'ORGANIZATION_MISMATCH',
	/** The capability is off for this tenant or organization. */
	FEATURE_DISABLED: 'FEATURE_DISABLED',
	/** A channel-scoped request could not resolve a channel. */
	CHANNEL_NOT_RESOLVED: 'CHANNEL_NOT_RESOLVED',
	/** The channel is outside what the credential may act on. */
	CHANNEL_SCOPE_VIOLATION: 'CHANNEL_SCOPE_VIOLATION',
	/** The caller exceeded the request rate. `Retry-After` says when to come back. */
	RATE_LIMITED: 'RATE_LIMITED',

	/* ------------------------------------------------------------------ *
	 * GraphQL — the two codes the query surface adds to the catalogue
	 * ------------------------------------------------------------------ */

	/** The selection set went deeper than the configured maximum. */
	GRAPHQL_DEPTH_LIMIT_EXCEEDED: 'GRAPHQL_DEPTH_LIMIT_EXCEEDED',
	/** The operation costs more than the configured maximum. */
	GRAPHQL_COMPLEXITY_LIMIT_EXCEEDED: 'GRAPHQL_COMPLEXITY_LIMIT_EXCEEDED',
	/** Introspection is disabled in this environment. */
	GRAPHQL_INTROSPECTION_DISABLED: 'GRAPHQL_INTROSPECTION_DISABLED',
	/** A persisted-query hash was presented and the query is not registered. */
	PERSISTED_QUERY_NOT_FOUND: 'PERSISTED_QUERY_NOT_FOUND',

	/* ------------------------------------------------------------------ *
	 * Search
	 * ------------------------------------------------------------------ */

	/** The query cannot be expressed against the entity's index definition. */
	SEARCH_QUERY_INVALID: 'SEARCH_QUERY_INVALID',
	/** A reindex for the same scope is already running. */
	SEARCH_REINDEX_IN_PROGRESS: 'SEARCH_REINDEX_IN_PROGRESS',
	/** No index provider is reachable, or the index has not been built. */
	SEARCH_INDEX_UNAVAILABLE: 'SEARCH_INDEX_UNAVAILABLE',
	/** The field is not part of the index definition. */
	SEARCH_FIELD_UNKNOWN: 'SEARCH_FIELD_UNKNOWN',

	/* ------------------------------------------------------------------ *
	 * Tax — a breakdown the ledger cannot describe
	 * ------------------------------------------------------------------ */

	/**
	 * One owner's tax lines mix an inclusive and an exclusive line of the same rate: the group cannot
	 * be described by one basis, and a totals writer told "inclusive" would add the exclusive half a
	 * second time. Documented in `docs/06-api-specification.md`, which assigns it `409`.
	 */
	TAX_INCLUSIVE_MISMATCH: 'TAX_INCLUSIVE_MISMATCH',

	/* ------------------------------------------------------------------ *
	 * Measurement — a quantity whose meaning the rows do not support
	 * ------------------------------------------------------------------ */

	/**
	 * Two units of different measurement families were used together. Conversion is defined only
	 * inside one family, so "10 pieces" and "120 grams" cannot be added, compared or converted, and a
	 * request that implies they can is refused rather than answered with a number that means nothing.
	 */
	UNIT_CATEGORY_MISMATCH: 'UNIT_CATEGORY_MISMATCH',
	/** A family was created, or reached, without the reference unit that defines its base quantity. */
	UNIT_CATEGORY_NO_REFERENCE: 'UNIT_CATEGORY_NO_REFERENCE',
	/**
	 * A column that names a unit names one that does not exist.
	 *
	 * The code the measurement audit reports a reference its dialect could not constrain — a row
	 * imported, restored or hand-corrected past the write path that guards the column.
	 */
	UNIT_REFERENCE_DANGLING: 'UNIT_REFERENCE_DANGLING',
	/** A variant's stock unit is not its family's reference unit, which the stock ledger's sum requires. */
	STOCK_UNIT_NOT_REFERENCE: 'STOCK_UNIT_NOT_REFERENCE',
	/** A variant level's family disagrees with the family of the product level above it. */
	PRODUCT_LEVEL_UNIT_CATEGORY_MISMATCH: 'PRODUCT_LEVEL_UNIT_CATEGORY_MISMATCH',

	/* ------------------------------------------------------------------ *
	 * Settlement terms — a schedule the document total cannot support
	 * ------------------------------------------------------------------ */

	/**
	 * A term's instalments allocate more than the document total. Returned with `422`, the status the
	 * API specification assigns it, because the request is well-formed and the resource is understood
	 * — it is the arithmetic that does not close.
	 */
	PAYMENT_TERM_OVERALLOCATED: 'PAYMENT_TERM_OVERALLOCATED',
	/** A term's percentage lines do not total 100 when the term carries no fixed line. */
	PAYMENT_TERM_PERCENT_SUM: 'PAYMENT_TERM_PERCENT_SUM',
	/** A term's instalment lines are not addressable: no lines, or two lines sharing a sequence. */
	PAYMENT_TERM_LINES_INVALID: 'PAYMENT_TERM_LINES_INVALID',

	/* ------------------------------------------------------------------ *
	 * The address book — a role or a default the rows contradict
	 * ------------------------------------------------------------------ */

	/** One owner holds two default addresses for one role, which only a service check can catch. */
	ADDRESS_DEFAULT_MISMATCH: 'ADDRESS_DEFAULT_MISMATCH',
	/** An address's buyer-scoped owner column disagrees with its polymorphic owner pair. */
	ADDRESS_OWNER_MISMATCH: 'ADDRESS_OWNER_MISMATCH',

	/* ------------------------------------------------------------------ *
	 * The remembered payer — an account at a provider, and the instruments under it
	 * ------------------------------------------------------------------ */

	/**
	 * No account at a provider matches what the caller named. Distinct from the restricted code below
	 * because the two call for different handling: a miss is a configuration defect or a stale
	 * identifier, while a restriction is a state the provider put the account in and which the next
	 * attempt may find lifted.
	 */
	PAYMENT_ACCOUNT_HOLDER_NOT_FOUND: 'PAYMENT_ACCOUNT_HOLDER_NOT_FOUND',
	/**
	 * The account exists but may not be used: it is not `ACTIVE`, or it is a recurring-debit account
	 * that carries no mandate.
	 *
	 * The same code covers "the provider accepts no new charge while an existing mandate is still
	 * honoured" and "nothing may be charged at all", because a caller's response to both is identical —
	 * do not charge this payer — and the qualifier in the accompanying reason distinguishes them for a
	 * human.
	 */
	PAYMENT_ACCOUNT_HOLDER_RESTRICTED: 'PAYMENT_ACCOUNT_HOLDER_RESTRICTED',
	/** A move the account's own lifecycle does not allow: a status it cannot reach, a terminal state reopened. */
	PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID: 'PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID',
	/** A mandate write that carries a reference without its acceptance instant, or the reverse. */
	PAYMENT_ACCOUNT_HOLDER_MANDATE_INVALID: 'PAYMENT_ACCOUNT_HOLDER_MANDATE_INVALID',
	/** The account still has live instruments, so it may not be removed; the supported path is disabling it. */
	PAYMENT_ACCOUNT_HOLDER_IN_USE: 'PAYMENT_ACCOUNT_HOLDER_IN_USE',
	/** The party already holds a live account of this kind with this provider. */
	PAYMENT_ACCOUNT_HOLDER_ACTIVE_EXISTS: 'PAYMENT_ACCOUNT_HOLDER_ACTIVE_EXISTS',
	/** No saved instrument matches what the caller named. */
	PAYMENT_METHOD_TOKEN_NOT_FOUND: 'PAYMENT_METHOD_TOKEN_NOT_FOUND',
	/** The instrument was removed. Terminal, and the only removal path there is. */
	PAYMENT_METHOD_TOKEN_REVOKED: 'PAYMENT_METHOD_TOKEN_REVOKED',
	/** The instrument's expiry has passed. Terminal. */
	PAYMENT_METHOD_TOKEN_EXPIRED: 'PAYMENT_METHOD_TOKEN_EXPIRED',
	/**
	 * The instrument cannot be used, and no more specific code applies: it is in the recoverable refused
	 * state, it was not confirmed against the provider, it carries facts its kind cannot carry, or it
	 * does not belong to the account the caller named.
	 */
	PAYMENT_METHOD_VALIDATION_FAILED: 'PAYMENT_METHOD_VALIDATION_FAILED',
	/** The provider's reference is already saved against this provider and is still reusable. */
	PAYMENT_METHOD_TOKEN_ALREADY_SAVED: 'PAYMENT_METHOD_TOKEN_ALREADY_SAVED',
	/** The currency of the charge contradicts the currency the account settles in. */
	PAYMENT_CURRENCY_MISMATCH: 'PAYMENT_CURRENCY_MISMATCH',

	/* ------------------------------------------------------------------ *
	 * Party data — the group, its membership, the login and the company account
	 * ------------------------------------------------------------------ */

	/** No contact group matches what the caller named, inside the caller's organization. */
	CONTACT_GROUP_NOT_FOUND: 'CONTACT_GROUP_NOT_FOUND',
	/**
	 * No party matches what the caller named, inside the caller's organization.
	 *
	 * Documented in `docs/06-api-specification.md` as the customer-contact miss, and emitted by the party
	 * reads this set's own services make — a company account that has to exist before a buyer is attached
	 * to it, for instance.
	 */
	CONTACT_NOT_FOUND: 'CONTACT_NOT_FOUND',
	/**
	 * The group's shape is not one the platform can store: a code that is blank once trimmed, or a
	 * discount that is not a fraction.
	 *
	 * The discount is the case worth naming — it is stored as a fraction and not as a percentage, so a
	 * caller that sent `10` meaning ten per cent is refused rather than handed a group that discounts
	 * everything by a thousand per cent.
	 */
	CONTACT_GROUP_INVALID: 'CONTACT_GROUP_INVALID',
	/**
	 * The group's code is already used by a live group of this organization.
	 *
	 * A code is how an integration and a rule address a group, so two live rows sharing one would make
	 * a price list resolve to whichever row the planner reached first.
	 */
	CONTACT_GROUP_CODE_TAKEN: 'CONTACT_GROUP_CODE_TAKEN',
	/**
	 * The group is one the platform maintains, so an operator may neither delete it nor change its code.
	 *
	 * The refusal is deliberately a named code rather than a generic one: "you may not delete this" and
	 * "this row is gone" call for different handling on the client, and only the first is recoverable by
	 * editing something else.
	 */
	CONTACT_GROUP_SYSTEM: 'CONTACT_GROUP_SYSTEM',
	/**
	 * The membership write the request describes is not one this group may hold: a hand-written
	 * membership of a rule-based group (whose membership is computed and never materialised), a second
	 * live membership for the same pair, or a window that has already closed.
	 */
	CONTACT_GROUP_MEMBER_INVALID: 'CONTACT_GROUP_MEMBER_INVALID',
	/** No membership matches what the caller named. */
	CONTACT_GROUP_MEMBER_NOT_FOUND: 'CONTACT_GROUP_MEMBER_NOT_FOUND',
	/** No credential matches what the caller named. */
	CONTACT_CREDENTIAL_NOT_FOUND: 'CONTACT_CREDENTIAL_NOT_FOUND',
	/** The contact already holds a credential; one contact is one login. */
	CONTACT_CREDENTIAL_EXISTS: 'CONTACT_CREDENTIAL_EXISTS',
	/** The login identifier is already taken inside this tenant, which is the scope a login is resolved in. */
	CONTACT_CREDENTIAL_EMAIL_TAKEN: 'CONTACT_CREDENTIAL_EMAIL_TAKEN',
	/**
	 * Too many consecutive failed authentications. The credential refuses every login until
	 * `lockedUntil` passes, whatever password is presented. Documented in `docs/06-api-specification.md`,
	 * which assigns it `423`.
	 */
	CONTACT_CREDENTIAL_LOCKED: 'CONTACT_CREDENTIAL_LOCKED',
	/** A single-use token was presented after it lapsed, or a body that carried one carried no expiry with it. */
	CONTACT_CREDENTIAL_TOKEN_INVALID: 'CONTACT_CREDENTIAL_TOKEN_INVALID',
	/**
	 * A credential body carried a plaintext password, or asked a row to expose one of its secrets.
	 *
	 * The hash is produced by the platform's password hasher before the row is written, and the secrets
	 * are absent from every projection by construction, so a request naming one is refused rather than
	 * quietly ignored — a caller that believes it set a password has a bug it would otherwise never see.
	 */
	CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED: 'CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED',
	/** No company-account membership matches what the caller named. */
	CONTACT_BUYER_NOT_FOUND: 'CONTACT_BUYER_NOT_FOUND',
	/**
	 * A row named as a company account is not one declared `COMPANY`, or a change would leave live buyer
	 * rows hanging off an individual. Documented in `docs/06-api-specification.md`, which assigns it `409`.
	 */
	COMPANY_ACCOUNT_REQUIRED: 'COMPANY_ACCOUNT_REQUIRED',
	/** A party cannot be its own buyer: purchasing authority is not a relationship with oneself. */
	CONTACT_BUYER_SELF: 'CONTACT_BUYER_SELF',
	/** The pair already has a live membership. */
	CONTACT_BUYER_EXISTS: 'CONTACT_BUYER_EXISTS',
	/** The buyer already belongs to another live company account, which is one relationship at a time. */
	CONTACT_BUYER_COMPANY_EXISTS: 'CONTACT_BUYER_COMPANY_EXISTS',
	/** A membership's role, limit or period start day is not one the account can hold. */
	CONTACT_BUYER_TERMS_INVALID: 'CONTACT_BUYER_TERMS_INVALID',
	/** The buyer's role may not place an order on the company account at all. */
	BUYER_NOT_AUTHORISED: 'BUYER_NOT_AUTHORISED',
	/** The order exceeds the buyer's per-order ceiling or the rolling-period ceiling. */
	BUYER_LIMIT_EXCEEDED: 'BUYER_LIMIT_EXCEEDED',
	/**
	 * The party is blocked: checkout and login are refused while the profile and the order history stay
	 * readable. Documented in the schema chapter's `organization_contact` invariants.
	 */
	CONTACT_BLOCKED: 'CONTACT_BLOCKED',

	/* ------------------------------------------------------------------ *
	 * The job runtime — the scheduler's run ledger and its dead-letter store
	 * ------------------------------------------------------------------ */

	/** No run in the ledger matches what the caller named, inside the caller's scope. */
	JOB_EXECUTION_NOT_FOUND: 'JOB_EXECUTION_NOT_FOUND',
	/**
	 * An attempt was not opened because a live run of the same job and scope is still in flight.
	 *
	 * The refusal is a fact rather than a fault: the caller records it as a `SKIPPED_OVERLAP` row, which
	 * is what makes "the job did not run" a different fact from "the job ran and did nothing".
	 */
	JOB_EXECUTION_ALREADY_RUNNING: 'JOB_EXECUTION_ALREADY_RUNNING',
	/**
	 * The write contradicts what a run is: an outcome that is not an outcome, a run that has already
	 * ended, an attempt count that would go backwards, or a job id that was not presented.
	 */
	JOB_EXECUTION_STATE_INVALID: 'JOB_EXECUTION_STATE_INVALID',
	/** No dead letter matches what the caller named, inside the caller's scope. */
	JOB_DEAD_LETTER_NOT_FOUND: 'JOB_DEAD_LETTER_NOT_FOUND',
	/**
	 * The write contradicts the dead letter's lifecycle: a row replayed or discarded twice, a discard
	 * without a reason, a row recorded without its payload, or a name or attempt count that is missing.
	 */
	JOB_DEAD_LETTER_STATE_INVALID: 'JOB_DEAD_LETTER_STATE_INVALID',

	/* ------------------------------------------------------------------ *
	 * Platform — the floor every route falls back to
	 * ------------------------------------------------------------------ */

	/** The requested resource does not exist, or is not visible to this caller. */
	RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
	/** An unclassified failure. Never carries driver text, SQL or a stack. */
	INTERNAL_ERROR: 'INTERNAL_ERROR',
	/** The endpoint exists but its phase is not enabled in this deployment. */
	NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
	/** A dependency (queue, cache, index, provider) is unavailable. */
	SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
} as const;

/** The union of every catalogued code, so a consumer can exhaustively switch on it. */
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/**
 * The code a status answers with when the exception named none.
 *
 * Only the statuses this platform actually emits are listed. A status that is absent — 422 is the
 * one worth naming, because the specification assigns it to a dozen unrelated domain conditions —
 * has no single honest meaning, so an exception that means something at such a status carries its
 * own code instead of inheriting a guess. The fallback for an unmapped status is `INTERNAL_ERROR`,
 * which is wrong in the same direction for everything: it tells a caller "do not branch on this".
 */
export const DEFAULT_CODE_BY_STATUS: Readonly<Record<number, ApiErrorCode>> = {
	400: ApiErrorCode.VALIDATION_FAILED,
	401: ApiErrorCode.AUTH_REQUIRED,
	403: ApiErrorCode.PERMISSION_DENIED,
	404: ApiErrorCode.RESOURCE_NOT_FOUND,
	406: ApiErrorCode.VALIDATION_INVALID_PATH_ID,
	409: ApiErrorCode.CONCURRENT_MODIFICATION,
	413: ApiErrorCode.VALIDATION_PAYLOAD_TOO_LARGE,
	414: ApiErrorCode.VALIDATION_URI_TOO_LONG,
	428: ApiErrorCode.PRECONDITION_REQUIRED,
	429: ApiErrorCode.RATE_LIMITED,
	500: ApiErrorCode.INTERNAL_ERROR,
	501: ApiErrorCode.NOT_IMPLEMENTED,
	502: ApiErrorCode.SERVICE_UNAVAILABLE,
	503: ApiErrorCode.SERVICE_UNAVAILABLE,
	504: ApiErrorCode.OPERATION_DEADLINE_EXCEEDED
};

/** Every catalogued code, as a flat array — the shape a gate or a test wants to iterate. */
export const API_ERROR_CODES: readonly ApiErrorCode[] = Object.values(ApiErrorCode);
