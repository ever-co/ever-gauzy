/**
 * The query protocol's vocabulary.
 *
 * One grammar serves both API surfaces. REST spells it as a query string, GraphQL as generated
 * input types, and both have to mean the same thing; everything they must agree on lives here —
 * the filter tree, the sort keys, the page request, the sparse fieldset, the protocol's caps, and
 * the error a caller gets when a query steps outside them.
 *
 * This module imports nothing at runtime. The parsers that build these shapes are pure functions, so
 * the request pipe, the build-time input generator and a test all run the same code with no
 * container and no database behind it. That is not a stylistic preference: a query grammar whose
 * behaviour can only be observed through an HTTP request is a grammar nobody can regression-test.
 */

import type { ApiErrorCode } from '../core/errors/api-error-codes';

/** Every operator the query protocol understands. */
export type FilterOperator =
	| 'eq'
	| 'ne'
	| 'in'
	| 'nin'
	| 'like'
	| 'ilike'
	| 'gt'
	| 'gte'
	| 'lt'
	| 'lte'
	| 'between'
	| 'isNull'
	| 'contains';

/**
 * A compiled filter.
 *
 * A node is either one condition or one boolean group. The tree is deliberately small: a
 * condition's path is at most two segments, a group nests at most two levels, and `not` is a
 * property of a group rather than its own node kind, which is what keeps the whole grammar
 * statically bounded instead of dependent on how deep a caller is willing to nest brackets.
 */
export type FilterNode =
	| {
			readonly kind: 'condition';
			/** The path from the resource root, one or two segments. */
			readonly path: readonly string[];
			readonly op: FilterOperator;
			/** The value, already coerced to the field's kind. Never a bare `null` — see `isNull`. */
			readonly value: unknown;
	  }
	| { readonly kind: 'and'; readonly children: readonly FilterNode[]; readonly negated?: boolean }
	| { readonly kind: 'or'; readonly children: readonly FilterNode[]; readonly negated?: boolean };

/** One sort key: a field the resource allows sorting by, and the direction. */
export interface SortKey {
	readonly field: string;
	readonly direction: 'ASC' | 'DESC';
}

/**
 * How a caller asked for a page.
 *
 * `OFFSET.number` is one-based, matching the platform's existing list routes. `CURSOR` carries
 * opaque cursors minted by {@link CursorCodec}; the two modes are mutually exclusive and mixing
 * them is refused rather than resolved.
 */
export type PageRequest =
	| { readonly mode: 'OFFSET'; readonly number: number; readonly limit: number }
	| { readonly mode: 'CURSOR'; readonly limit: number; readonly after?: string; readonly before?: string };

/** A sparse fieldset: the paths a caller asked for, in the order they asked for them. */
export interface FieldSelection {
	readonly paths: readonly string[];
}

/** The request-scoped overrides the protocol forwards without interpreting. */
export interface ApiQueryContext {
	readonly locale?: string;
	readonly currency?: string;
	readonly channelId?: string;
	readonly regionId?: string;
}

/** Everything a list route needs, in one object, after validation and normalisation. */
export interface ApiQuery {
	/** The concept root word: `role`, never a storage-qualified name. */
	readonly resource: string;
	readonly filter?: FilterNode;
	readonly sort: readonly SortKey[];
	readonly page: PageRequest;
	readonly fields?: FieldSelection;
	readonly expand: readonly string[];
	readonly q?: string;
	readonly withDeleted: boolean;
	readonly context: ApiQueryContext;
	/** True when the caller used the legacy single-JSON parameter, so the response can say so. */
	readonly legacy: boolean;
}

/**
 * The protocol's caps, in one place.
 *
 * The REST parser enforces them on a query string, the translator enforces the page limits again
 * when it turns a page request into an offset, and the GraphQL generator documents them on the
 * inputs it emits. One table means a limit cannot be raised on one surface and forgotten on the
 * other.
 */
export const API_QUERY_LIMITS = {
	/** Segments in a filter path: `customer.name` is two, `customer.address.city` is not allowed. */
	filterPathSegments: 2,
	/** How deep boolean groups may nest. */
	filterNestingLevels: 2,
	/** Elements in one boolean group. */
	filterGroupSize: 20,
	/** Keys in one filter object: the top level, and every boolean-group member. */
	filterTopLevelKeys: 32,
	/** Values in one `in` / `nin` list. */
	inListWidth: 200,
	/**
	 * How many conjunctions one filter may expand to.
	 *
	 * The stored engines read a disjunction as a list of conjunctions, so a filter that mixes
	 * groups is distributed before it is handed over. Two groups of twenty members already produce
	 * four hundred conjunctions, and nothing in the grammar stops a query from carrying more
	 * groups than that — this bound is what keeps distribution from becoming the cheapest way to
	 * make the server do work.
	 */
	filterDisjunctions: 256,
	/** Sort keys in one request. */
	sortKeys: 3,
	/** Paths in one `fields` selection. */
	fieldPaths: 60,
	/** Segments in one `fields` path. */
	fieldPathSegments: 2,
	/** Paths in one `expand` list. */
	expandPaths: 5,
	/** Segments in one `expand` path. */
	expandDepth: 3,
	/** Characters in the free-text parameter. */
	searchLength: 128,
	/** Bytes of the whole query string. */
	queryStringBytes: 8192,
	/** The highest one-based page number an offset page may ask for. */
	maxPageNumber: 1000,
	/** Page size when the caller does not ask for one. */
	defaultPageSize: 20,
	/**
	 * Page size for the legacy alias, which must keep returning what it returned before the
	 * protocol existed: the list service has always defaulted to ten rows.
	 */
	legacyDefaultPageSize: 10,
	/** The largest page size any resource may be read with. */
	maxPageSize: 100,
	/** Characters in one opaque cursor. A cursor is minted by this server and is never long. */
	cursorLength: 512
} as const;

/**
 * The catalogue codes the query protocol can raise.
 *
 * The catalogue is the platform's single list of codes, and this is the subset a query can produce.
 * Deriving it rather than retyping it is what keeps the two in step: a code the catalogue renames
 * stops compiling here, and a code invented here cannot exist at all. The import is type-only, so
 * the grammar still runs without loading anything.
 */
export type ApiQueryErrorCode = Extract<
	ApiErrorCode,
	| 'VALIDATION_FAILED'
	| 'VALIDATION_INVALID_ENUM'
	| 'VALIDATION_INVALID_DATE_RANGE'
	| 'VALIDATION_MONEY_PRECISION'
	| 'VALIDATION_URI_TOO_LONG'
	| 'QUERY_UNKNOWN_FILTER_FIELD'
	| 'QUERY_UNSUPPORTED_OPERATOR'
	| 'QUERY_FILTER_DEPTH_EXCEEDED'
	| 'QUERY_NESTING_LIMIT_EXCEEDED'
	| 'QUERY_SORT_NOT_ALLOWED'
	| 'QUERY_FIELD_NOT_SELECTABLE'
	| 'QUERY_EXPAND_NOT_ALLOWED'
	| 'QUERY_EXPAND_DEPTH_EXCEEDED'
	| 'QUERY_PAGE_LIMIT_EXCEEDED'
	| 'QUERY_CURSOR_INVALID'
	| 'QUERY_CURSOR_SORT_MISMATCH'
	| 'QUERY_LEGACY_DATA_PARAM_INVALID'
	| 'QUERY_LEGACY_DATA_PARAM_CONFLICT'
	| 'PERMISSION_DENIED'
	| 'TENANT_MISMATCH'
>;

/**
 * The status each query code answers with.
 *
 * A code decides its own status so that no call site can pick a different one for the same
 * violation. Two codes are not 400s: a query string over the byte cap is a 414 because the request
 * was refused before it was read, and the authorisation codes are 403s because the caller is
 * understood and refused rather than misunderstood. The catalogue's own status-to-code table is the
 * fallback for an exception that named no code; this table is the query protocol's own answer.
 */
export const API_QUERY_ERROR_STATUS: Readonly<Record<ApiQueryErrorCode, number>> = {
	VALIDATION_FAILED: 400,
	VALIDATION_INVALID_ENUM: 400,
	VALIDATION_INVALID_DATE_RANGE: 400,
	VALIDATION_MONEY_PRECISION: 400,
	VALIDATION_URI_TOO_LONG: 414,
	QUERY_UNKNOWN_FILTER_FIELD: 400,
	QUERY_UNSUPPORTED_OPERATOR: 400,
	QUERY_FILTER_DEPTH_EXCEEDED: 400,
	QUERY_NESTING_LIMIT_EXCEEDED: 400,
	QUERY_SORT_NOT_ALLOWED: 400,
	QUERY_FIELD_NOT_SELECTABLE: 400,
	QUERY_EXPAND_NOT_ALLOWED: 400,
	QUERY_EXPAND_DEPTH_EXCEEDED: 400,
	QUERY_PAGE_LIMIT_EXCEEDED: 400,
	QUERY_CURSOR_INVALID: 400,
	QUERY_CURSOR_SORT_MISMATCH: 400,
	QUERY_LEGACY_DATA_PARAM_INVALID: 400,
	QUERY_LEGACY_DATA_PARAM_CONFLICT: 400,
	PERMISSION_DENIED: 403,
	TENANT_MISMATCH: 403
};

/**
 * The error every part of the query layer raises.
 *
 * It is a plain `Error` on purpose: the parsers must be runnable without a framework, and a
 * caller that wants an HTTP exception converts it at the boundary, once. The message carries the
 * code as its prefix, so a log line names the violation without a second lookup.
 */
export class ApiQueryError extends Error {
	/** The catalogue code. */
	readonly code: ApiQueryErrorCode;

	/** The HTTP status the code maps to, unless a call site overrides it. */
	readonly status: number;

	/**
	 * Machine-readable context. `allowed` is the key callers can act on — every allow-list refusal
	 * carries the list it was measured against, so a client can fix the query without guessing.
	 */
	readonly details?: Readonly<Record<string, unknown>>;

	constructor(
		code: ApiQueryErrorCode,
		message: string,
		details?: Readonly<Record<string, unknown>>,
		status?: number
	) {
		super(message);
		this.name = 'ApiQueryError';
		this.code = code;
		this.status = status ?? API_QUERY_ERROR_STATUS[code] ?? 400;
		this.details = details;
	}

	/** The message as a client sees it: the stable code, then the explanation. */
	get wireMessage(): string {
		return `${this.code}: ${this.message}`;
	}
}

/**
 * Whether a value is an error this layer raised.
 *
 * The check is structural as well as nominal, because the compiled output of a package can carry
 * two copies of a class and `instanceof` is then false for an error that is unmistakably ours.
 */
export function isApiQueryError(value: unknown): value is ApiQueryError {
	if (value instanceof ApiQueryError) {
		return true;
	}
	const candidate = value as { name?: unknown; code?: unknown } | null | undefined;
	return !!candidate && typeof candidate === 'object' && candidate.name === 'ApiQueryError' && typeof candidate.code === 'string';
}

/**
 * Refuses a query string longer than the protocol allows.
 *
 * The check runs before anything is parsed, so an oversized request costs one length comparison
 * rather than a parse of a document that will be rejected anyway.
 *
 * @param rawQueryString The part of the URL after `?`, or `undefined` when there is none.
 * @throws ApiQueryError `VALIDATION_URI_TOO_LONG` (414) when the query string exceeds the cap.
 */
export function validateQueryStringLength(rawQueryString?: string | null): void {
	if (!rawQueryString) {
		return;
	}
	// Count bytes rather than characters: the cap exists to bound the work a request can ask for,
	// and a percent-encoded path is carried as its decoded text here.
	const bytes = Buffer.byteLength(rawQueryString, 'utf8');
	if (bytes > API_QUERY_LIMITS.queryStringBytes) {
		throw new ApiQueryError('VALIDATION_URI_TOO_LONG', `The query string is ${bytes} bytes; the maximum is ${API_QUERY_LIMITS.queryStringBytes}.`, {
			limit: API_QUERY_LIMITS.queryStringBytes,
			actual: bytes
		});
	}
}

/**
 * Renders sort keys back to the wire form, `-createdAt,name`.
 *
 * Both surfaces and the legacy alias produce sort keys, and all three have to report the same
 * string — the cursor's sort fingerprint is taken over this rendering, so a mismatch between two
 * spellings of the same sort would invalidate cursors.
 *
 * @param sort The sort keys to render.
 * @returns The comma-separated wire form; an empty string when there is no sort.
 */
export function formatSortKeys(sort: readonly SortKey[] | undefined): string {
	if (!sort || sort.length === 0) {
		return '';
	}
	return sort.map((key) => (key.direction === 'DESC' ? `-${key.field}` : key.field)).join(',');
}

/**
 * The default page size for a resource, clamped to the protocol's maximum.
 *
 * A resource may declare a smaller default than the platform's; it may not declare one larger
 * than the platform allows, so the clamp here is the single place that rule is enforced at
 * runtime.
 *
 * @param defaultPageSize The resource's declared default, when it declares one.
 * @param maxPageSize The resource's declared maximum, when it declares one.
 * @returns The page size to use when the caller does not ask for one.
 */
export function resolveDefaultPageSize(defaultPageSize?: number, maxPageSize?: number): number {
	const ceiling = resolveMaxPageSize(maxPageSize);
	const requested = Number.isFinite(defaultPageSize) && (defaultPageSize as number) > 0 ? (defaultPageSize as number) : API_QUERY_LIMITS.defaultPageSize;
	return Math.min(Math.floor(requested), ceiling);
}

/**
 * The largest page size a resource may be read with.
 *
 * @param maxPageSize The resource's declared maximum, when it declares one.
 * @returns A page size between one and the protocol's hard maximum.
 */
export function resolveMaxPageSize(maxPageSize?: number): number {
	if (!Number.isFinite(maxPageSize) || (maxPageSize as number) <= 0) {
		return API_QUERY_LIMITS.maxPageSize;
	}
	return Math.min(Math.floor(maxPageSize as number), API_QUERY_LIMITS.maxPageSize);
}
