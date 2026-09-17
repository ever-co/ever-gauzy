import {
	API_QUERY_LIMITS,
	ApiQuery,
	ApiQueryContext,
	ApiQueryError,
	PageRequest,
	SortKey,
	resolveDefaultPageSize,
	resolveMaxPageSize
} from './query-ast';
import { parseFilter } from './filter-parser';
import { parseSort, resolveEffectiveSort } from './sort-parser';
import { parseExpand, parseFields } from './field-selection';
import { CursorCodec } from './cursor';
import type { ApiQuerySchema } from './query-schema';

/**
 * The protocol pipeline: raw request values in, one normalised query out.
 *
 * Everything the two API surfaces must agree on is decided here and nowhere else. REST hands in the
 * values the query-string parser produced, GraphQL hands in its argument values, a script hands in
 * a literal object — and each gets back an {@link ApiQuery} that is indistinguishable from the
 * others. That is the mechanism behind the parity the platform promises: there is no second
 * implementation to keep in step, because there is no second implementation.
 *
 * The module is pure. It imports the parsers and nothing else, so it runs without a container, a
 * database or a framework, which is what makes the grammar testable as a grammar.
 */

/** The raw wire values a request carries, before any of them have been interpreted. */
export interface ApiQueryParams {
	/** Filter conditions: the nested object the query-string parser produced, or a JSON string. */
	readonly filter?: unknown;
	/** Sort keys: `-createdAt,name`, a list of tokens, or a list of `{ field, direction }`. */
	readonly sort?: unknown;
	/** The page: `{ number, limit, after, before }`, in any of the shapes the wire allows. */
	readonly page?: unknown;
	/** Sparse fieldset: `id,title,lines.sku`, a list, or an object with truthy leaves. */
	readonly fields?: unknown;
	/** Relation expansion: `customer,lines.variant`, or a list. */
	readonly expand?: unknown;
	/** Free text over the resource's declared searchable fields. */
	readonly q?: unknown;
	/** Whether soft-deleted rows are included. */
	readonly withDeleted?: unknown;
	/** The concept root word, when the caller knows it independently of the schema. */
	readonly resource?: string;
	/** Request-scoped overrides, forwarded rather than interpreted. */
	readonly context?: ApiQueryContext;
	/** Whether the values came from the legacy single-JSON parameter. */
	readonly legacy?: boolean;
}

/** Reads a positive integer from a wire value. */
function toInteger(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	const parsed = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
	return Number.isFinite(parsed) ? Math.floor(parsed) : undefined;
}

/** Reads the page object out of whatever the wire produced. */
function toPageObject(raw: unknown): Record<string, unknown> {
	if (raw === undefined || raw === null || raw === '') {
		return {};
	}
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
		} catch {
			throw new ApiQueryError('VALIDATION_FAILED', 'The page parameter is not valid JSON.');
		}
	}
	if (typeof raw === 'object' && !Array.isArray(raw)) {
		return raw as Record<string, unknown>;
	}
	throw new ApiQueryError('VALIDATION_FAILED', 'The page parameter must be an object.');
}

/**
 * Reads the page request.
 *
 * The two pagination styles are mutually exclusive, and the refusal is deliberate rather than
 * resolved: a request that asks for page three *and* a position in the middle of page three has
 * two readings, and quietly picking one would return a page the caller did not ask for.
 *
 * @param raw The page value: `{ number, limit, after, before }`.
 * @param schema The resource's declaration, when it has one.
 * @param sort The effective sort, which a cursor is validated against.
 * @returns The page request.
 * @throws ApiQueryError `QUERY_PAGE_LIMIT_EXCEEDED` for conflicting or out-of-range paging,
 *   `QUERY_CURSOR_INVALID` for a cursor on a resource that cannot be cursor-paginated.
 */
export function parsePage(raw: unknown, schema?: ApiQuerySchema, sort?: readonly SortKey[]): PageRequest {
	const page = toPageObject(raw);
	const ceiling = resolveMaxPageSize(schema?.maxPageSize);
	const requestedLimit = toInteger(page.limit);

	if (page.limit !== undefined && page.limit !== null && page.limit !== '' && requestedLimit === undefined) {
		// A page size that is not a number is not a page size. Falling back to the default would
		// answer a request the caller did not make, with no way for them to notice.
		throw new ApiQueryError('VALIDATION_FAILED', 'The page limit must be a whole number.', { actual: page.limit });
	}
	if (requestedLimit !== undefined && requestedLimit > ceiling) {
		throw new ApiQueryError('QUERY_PAGE_LIMIT_EXCEEDED', `A page may hold at most ${ceiling} rows.`, {
			limit: ceiling,
			actual: requestedLimit
		});
	}
	if (requestedLimit !== undefined && requestedLimit <= 0) {
		throw new ApiQueryError('VALIDATION_FAILED', 'A page must hold at least one row.', { actual: requestedLimit });
	}
	const limit = requestedLimit ?? resolveDefaultPageSize(schema?.defaultPageSize, schema?.maxPageSize);

	const after = typeof page.after === 'string' && page.after.length > 0 ? page.after : undefined;
	const before = typeof page.before === 'string' && page.before.length > 0 ? page.before : undefined;
	const number = toInteger(page.number);
	if (page.number !== undefined && page.number !== null && page.number !== '' && number === undefined) {
		throw new ApiQueryError('VALIDATION_FAILED', 'The page number must be a whole number.', { actual: page.number });
	}

	if ((after || before) && number !== undefined) {
		throw new ApiQueryError('QUERY_PAGE_LIMIT_EXCEEDED', 'A cursor and a page number cannot be combined.', {
			cursor: after ? 'after' : 'before',
			number
		});
	}

	if (after || before) {
		if (!schema?.defaultSort || schema.defaultSort.length === 0) {
			// A cursor names a position in an order. Without a declared default sort there is no order
			// to name a position in, so the request cannot be answered at all.
			throw new ApiQueryError(
				'QUERY_CURSOR_INVALID',
				`"${schema?.resource ?? 'This resource'}" declares no default sort and cannot be cursor-paginated.`
			);
		}
		const effectiveSort = sort ?? resolveEffectiveSort([], schema);
		CursorCodec.decodeForSort(after ?? before, effectiveSort);
		return { mode: 'CURSOR', limit, after, before };
	}

	const resolvedNumber = number ?? 1;
	if (resolvedNumber <= 0) {
		throw new ApiQueryError('VALIDATION_FAILED', 'Page numbers are one-based.', { actual: resolvedNumber });
	}
	if (resolvedNumber > API_QUERY_LIMITS.maxPageNumber) {
		throw new ApiQueryError(
			'QUERY_PAGE_LIMIT_EXCEEDED',
			`Page ${resolvedNumber} is beyond page ${API_QUERY_LIMITS.maxPageNumber}, which is the deepest an offset query may read.`,
			{ limit: API_QUERY_LIMITS.maxPageNumber, actual: resolvedNumber }
		);
	}
	return { mode: 'OFFSET', number: resolvedNumber, limit };
}

/**
 * Reads the free-text parameter.
 *
 * @param raw The raw value.
 * @returns The trimmed text, or `undefined` when nothing was asked for.
 * @throws ApiQueryError `VALIDATION_FAILED` when the text is longer than the protocol allows.
 */
export function parseSearch(raw: unknown): string | undefined {
	if (raw === undefined || raw === null) {
		return undefined;
	}
	const text = String(raw).trim();
	if (text.length === 0) {
		return undefined;
	}
	if (text.length > API_QUERY_LIMITS.searchLength) {
		throw new ApiQueryError('VALIDATION_FAILED', `The search text may be at most ${API_QUERY_LIMITS.searchLength} characters.`, {
			limit: API_QUERY_LIMITS.searchLength,
			actual: text.length
		});
	}
	return text;
}

/** Reads a boolean the way the platform's existing query transforms read one. */
function toBoolean(value: unknown): boolean {
	if (typeof value === 'boolean') {
		return value;
	}
	if (value === undefined || value === null || value === '') {
		return false;
	}
	return String(value).trim().toLowerCase() === 'true';
}

/**
 * Compiles the wire values of a request into one query.
 *
 * @param params The raw values, exactly as they arrived.
 * @param schema The resource's declaration. Without one every field, operator and relation is
 *   accepted, which is the behaviour a route that has not adopted the protocol must keep.
 * @returns The normalised query.
 * @throws ApiQueryError With the catalogue code for the first violation found.
 */
export function toApiQuery(params: ApiQueryParams, schema?: ApiQuerySchema): ApiQuery {
	const requestedSort = parseSort(params.sort, schema);
	const sort = resolveEffectiveSort(requestedSort, schema);

	return {
		resource: params.resource ?? schema?.resource ?? 'unknown',
		filter: parseFilter(params.filter, schema),
		sort,
		page: parsePage(params.page, schema, sort),
		fields: parseFields(params.fields, schema),
		expand: parseExpand(params.expand, schema),
		q: parseSearch(params.q),
		withDeleted: toBoolean(params.withDeleted),
		context: params.context ?? {},
		legacy: params.legacy === true
	};
}

/**
 * Converts an offset into the page number the protocol pages by.
 *
 * GraphQL clients page by offset and REST clients page by number; both are the same page, and this
 * is the one place the conversion is made, so a connection and a list route cannot disagree about
 * where page two starts.
 *
 * @param offset The number of rows to skip.
 * @param limit The page size.
 * @returns The one-based page number.
 * @throws ApiQueryError `QUERY_PAGE_LIMIT_EXCEEDED` beyond the deepest page the protocol allows.
 */
export function pageNumberFromOffset(offset: unknown, limit: number): number {
	const resolved = toInteger(offset);
	if (resolved === undefined || resolved <= 0) {
		return 1;
	}
	const size = limit > 0 ? limit : resolveDefaultPageSize();
	const number = Math.floor(resolved / size) + 1;
	if (number > API_QUERY_LIMITS.maxPageNumber) {
		throw new ApiQueryError(
			'QUERY_PAGE_LIMIT_EXCEEDED',
			`An offset of ${resolved} is beyond the deepest offset an offset query may read.`,
			{ limit: API_QUERY_LIMITS.maxPageNumber * size, actual: resolved }
		);
	}
	return number;
}
