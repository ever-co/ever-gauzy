import { BadRequestException } from '@nestjs/common';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { API_QUERY_LIMITS, SortKey, isApiQueryError } from './query-ast';
import { CursorCodec } from './cursor';

/**
 * The connection contract, as one implementation.
 *
 * The GraphQL surface answers every list root field with a connection — `nodes`, `edges`,
 * `totalCount` and `pageInfo` — and the contract is the REST one: the same filters, the same
 * operators, the same caps, the same opaque cursors and the same `total`. `CursorCodec` already
 * makes a cursor obtained over one surface valid on the other; this module is the other half, so
 * that a list root field is not three hundred lines of pagination arithmetic repeated per domain.
 *
 * **Why the work happens over rows rather than over a query builder.** The kernel's list methods
 * answer with the filtered set — `ChannelService.listChannels`, `RegionService.listRegions` and the
 * membership lists all return every matching row and fix their own order because that order is part
 * of what they mean (the default channel first, the primary host first). A resolver therefore
 * cannot push a caller's `filter`, `sort` or page into the store without changing a service
 * signature, which the delivery is not allowed to do. Applying the protocol to the rows the service
 * returned is not a compromise: it is exactly the set the service decided the caller may see, and
 * the operators below are the platform's own.
 *
 * **What a refusal carries.** Every refusal here is a `BadRequestException` whose message leads with
 * the platform error code — the shape the kernel services themselves raise and the shape a GraphQL
 * caller reads in `extensions.code`. The codes are the query protocol's own, so a client that
 * branches on them over REST branches on the same strings here.
 */

/**
 * The value domain of a filterable field.
 *
 * Deliberately the same vocabulary the query schema uses, so a resource declares its filterable
 * fields once and both surfaces understand them.
 */
export type ConnectionFieldKind = 'ID' | 'STRING' | 'NUMBER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'ENUM' | 'JSON';

/**
 * One field's condition, as a generated filter input states it.
 *
 * A member that is absent does not narrow; a member that is present always does. `isNull` is a
 * condition of its own rather than a bare `null`, because the two mean different things to a
 * client: `isNull: true` selects the rows where the column is absent, and omitting the field
 * selects every row.
 */
export interface ConnectionCondition {
	readonly eq?: unknown;
	readonly ne?: unknown;
	readonly in?: readonly unknown[];
	readonly nin?: readonly unknown[];
	readonly like?: string;
	readonly ilike?: string;
	readonly gt?: unknown;
	readonly gte?: unknown;
	readonly lt?: unknown;
	readonly lte?: unknown;
	readonly between?: readonly unknown[];
	readonly isNull?: boolean;
	readonly contains?: readonly string[];
}

/**
 * A filter as it arrives over GraphQL: one member per declared field, plus the three boolean groups.
 */
export interface ConnectionFilter {
	readonly [field: string]: unknown;
}

/**
 * One sort key, as the generated sort input states it.
 */
export interface ConnectionSortKey {
	readonly field: string;
	readonly direction: 'ASC' | 'DESC';
}

/**
 * How a caller asked for a page.
 *
 * Both styles are available and they are mutually exclusive: a cursor walk is stable while rows are
 * inserted around it and an offset walk is not, so a request that states both is refused rather
 * than silently preferring one.
 */
export interface ConnectionPageRequest {
	readonly first?: number;
	readonly after?: string;
	readonly last?: number;
	readonly before?: string;
}

/**
 * Everything a list root field receives, in one object.
 */
export interface ConnectionRequest {
	readonly filter?: ConnectionFilter;
	readonly sort?: readonly ConnectionSortKey[];
	readonly page?: ConnectionPageRequest;
	readonly first?: number;
	readonly after?: string;
	readonly last?: number;
	readonly before?: string;
	readonly limit?: number;
	readonly offset?: number;
	readonly withDeleted?: boolean;
}

/**
 * What a connection answers with.
 */
export interface GraphqlConnection<T> {
	readonly nodes: readonly T[];
	readonly edges: readonly { readonly node: T; readonly cursor: string }[];
	readonly totalCount: number;
	readonly pageInfo: {
		readonly hasNextPage: boolean;
		readonly hasPreviousPage: boolean;
		readonly startCursor: string | null;
		readonly endCursor: string | null;
	};
}

/**
 * The declaration of one resource's list surface.
 */
export interface ConnectionDefinition<T> {
	/** The rows the service answered with, in the service's own order. */
	readonly rows: readonly T[];
	/** The fields a caller may filter on, and the kind that decides the operators each accepts. */
	readonly filterable: Readonly<Record<string, ConnectionFieldKind>>;
	/** The fields a caller may sort by. */
	readonly sortable: readonly string[];
	/** The order applied when the caller states none. */
	readonly defaultSort: readonly ConnectionSortKey[];
	/** What the caller asked for. */
	readonly request?: ConnectionRequest;
}

/** The three boolean group members, which are not field names. */
const BOOLEAN_GROUP_MEMBERS = ['and', 'or', 'not'] as const;

/**
 * Reads the value a row carries at a field path.
 *
 * A path is the field name; the connection protocol caps a filter path at two segments, and a
 * resource that declares a relation path gets the relation read one level deep. A row whose
 * relation is absent has no value there, which is the `isNull` case rather than an error.
 *
 * @param row The row.
 * @param path The dotted path.
 * @returns The value, or `undefined`.
 */
function readPath(row: unknown, path: string): unknown {
	const [head, tail] = path.split('.');

	if (!tail) {
		return (row as Record<string, unknown>)?.[head];
	}

	return readPath((row as Record<string, unknown>)?.[head], tail);
}

/**
 * Renders a value for comparison.
 *
 * Dates compare as instants, booleans as their truth, everything else as text. A `null` stays
 * distinguishable from the empty string, because the two are different questions.
 *
 * @param value The value.
 * @returns A comparable primitive.
 */
function comparable(value: unknown): string | number | boolean | null {
	if (value === null || value === undefined) {
		return null;
	}

	if (value instanceof Date) {
		return value.getTime();
	}

	if (typeof value === 'boolean' || typeof value === 'number') {
		return value;
	}

	return String(value);
}

/**
 * Compares two values of one field under a direction.
 *
 * @param left The row's value.
 * @param right The requested value.
 * @returns A negative, zero or positive number.
 */
function compare(left: unknown, right: unknown): number {
	const a = comparable(left);
	const b = comparable(right);

	if (a === null && b === null) {
		return 0;
	}
	// An absent value sorts last in both directions, which is what a client that asked for the
	// column expects to find at the end of the walk rather than interleaved with the values.
	if (a === null) {
		return 1;
	}
	if (b === null) {
		return -1;
	}
	if (typeof a === 'number' && typeof b === 'number') {
		return a - b;
	}
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return Number(a) - Number(b);
	}

	return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'variant' });
}

/**
 * Translates a `like`/`ilike` pattern into a regular expression.
 *
 * `%` and `_` are the protocol's wildcards and nothing else is: a pattern is text a caller wrote,
 * not a regular expression, so the pattern is escaped before the two wildcards are reinstated.
 *
 * @param pattern The pattern.
 * @param caseInsensitive Whether the match ignores case.
 * @returns The expression.
 */
function patternToRegExp(pattern: string, caseInsensitive: boolean): RegExp {
	const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const translated = escaped.split('%').join('.*').split('_').join('.');

	return new RegExp(`^${translated}$`, caseInsensitive ? 'i' : '');
}

/**
 * Whether one row matches one condition.
 *
 * @param value The row's value for the field.
 * @param condition The condition.
 * @param kind The field's kind, which decides nothing here but is carried for the error message.
 * @param field The field name, for the error message.
 * @returns True when the row satisfies the condition.
 */
function matchesCondition(value: unknown, condition: ConnectionCondition, kind: ConnectionFieldKind, field: string): boolean {
	const members = Object.entries(condition).filter(([, stated]) => stated !== undefined && stated !== null);

	for (const [operator, stated] of members) {
		switch (operator) {
			case 'eq':
				if (compare(value, stated) !== 0) return false;
				break;
			case 'ne':
				if (value === null || value === undefined || compare(value, stated) === 0) return false;
				break;
			case 'in':
				if (!Array.isArray(stated) || !stated.some((candidate) => compare(value, candidate) === 0)) return false;
				break;
			case 'nin':
				if (value === null || value === undefined) return false;
				if (Array.isArray(stated) && stated.some((candidate) => compare(value, candidate) === 0)) return false;
				break;
			case 'like':
				if (typeof value !== 'string' || !patternToRegExp(String(stated), false).test(value)) return false;
				break;
			case 'ilike':
				if (typeof value !== 'string' || !patternToRegExp(String(stated), true).test(value)) return false;
				break;
			case 'gt':
				if (value === null || value === undefined || compare(value, stated) <= 0) return false;
				break;
			case 'gte':
				if (value === null || value === undefined || compare(value, stated) < 0) return false;
				break;
			case 'lt':
				if (value === null || value === undefined || compare(value, stated) >= 0) return false;
				break;
			case 'lte':
				if (value === null || value === undefined || compare(value, stated) > 0) return false;
				break;
			case 'between': {
				if (!Array.isArray(stated) || stated.length !== 2) {
					throw new BadRequestException(
						`${ApiErrorCode.VALIDATION_INVALID_DATE_RANGE}: '${field}' takes exactly two bounds, lower first.`
					);
				}
				if (value === null || value === undefined) return false;
				if (compare(value, stated[0]) < 0 || compare(value, stated[1]) > 0) return false;
				break;
			}
			case 'isNull':
				if (Boolean(stated) !== (value === null || value === undefined)) return false;
				break;
			case 'contains': {
				const text = value === null || value === undefined ? '' : JSON.stringify(value);
				if (!Array.isArray(stated) || !stated.every((needle) => text.includes(String(needle)))) return false;
				break;
			}
			default:
				throw new BadRequestException(
					`${ApiErrorCode.QUERY_UNSUPPORTED_OPERATOR}: '${operator}' is not an operator this platform offers on '${field}' (${kind}).`
				);
		}
	}

	return true;
}

/**
 * The fields a filter names, so an undeclared one is refused rather than ignored.
 *
 * @param filter The filter.
 * @returns The field names it names, excluding the three boolean groups.
 */
function filterFieldsOf(filter: ConnectionFilter): string[] {
	return Object.keys(filter ?? {}).filter(
		(field) => !(BOOLEAN_GROUP_MEMBERS as readonly string[]).includes(field)
	);
}

/**
 * Whether one row matches one filter.
 *
 * `and` is the default: the members of a filter are conjoined. `or` requires any of its members and
 * `not` excludes those that match it, both recursively, so a client can express what the REST query
 * protocol expresses with `$and`/`$or`.
 *
 * @param row The row.
 * @param filter The filter.
 * @param filterable The declared fields.
 * @param path The path the filter sits at, for the refusal message.
 * @returns True when the row matches.
 */
function matchesFilter(
	row: unknown,
	filter: ConnectionFilter,
	filterable: Readonly<Record<string, ConnectionFieldKind>>,
	path = ''
): boolean {
	for (const field of filterFieldsOf(filter)) {
		if (!(field in filterable)) {
			throw new BadRequestException(
				`${ApiErrorCode.QUERY_UNKNOWN_FILTER_FIELD}: '${path}${field}' cannot be used as a filter here. Allowed: ${Object.keys(filterable).join(', ')}.`
			);
		}

		const condition = filter[field] as ConnectionCondition;

		if (!condition || typeof condition !== 'object') {
			throw new BadRequestException(
				`${ApiErrorCode.QUERY_UNSUPPORTED_OPERATOR}: '${path}${field}' is stated without an operator object.`
			);
		}

		if (!matchesCondition(readPath(row, field), condition, filterable[field], `${path}${field}`)) {
			return false;
		}
	}

	const anyOf = filter['or'];

	if (Array.isArray(anyOf) && anyOf.length > 0) {
		const matched = anyOf.some((one) => matchesFilter(row, one as ConnectionFilter, filterable, path));
		if (!matched) return false;
	}

	const allOf = filter['and'];

	if (Array.isArray(allOf)) {
		for (const one of allOf) {
			if (!matchesFilter(row, one as ConnectionFilter, filterable, path)) return false;
		}
	}

	const noneOf = filter['not'];

	if (noneOf && typeof noneOf === 'object') {
		if (matchesFilter(row, noneOf as ConnectionFilter, filterable, path)) return false;
	}

	return true;
}

/**
 * Narrows a set of rows by a filter.
 *
 * @param rows The rows.
 * @param filter The filter, when the caller stated one.
 * @param filterable The declared fields.
 * @returns The matching rows.
 */
export function applyConnectionFilter<T>(
	rows: readonly T[],
	filter: ConnectionFilter | undefined,
	filterable: Readonly<Record<string, ConnectionFieldKind>>
): T[] {
	if (!filter || Object.keys(filter).length === 0) {
		return [...rows];
	}

	return rows.filter((row) => matchesFilter(row, filter, filterable));
}

/**
 * Orders a set of rows by the effective sort.
 *
 * @param rows The rows.
 * @param sort The sort keys to apply.
 * @param sortable The declared sortable fields.
 * @param stated The keys the **caller** stated, when the effective sort also carries the resource's
 * own default. Only what a caller asked for is measured against the allow-list: the default is the
 * resource's declaration and may name a key — the id tie-break, for instance — that a caller may not
 * sort by, which is exactly what makes the default order total without widening the contract.
 * @returns The ordered rows.
 * @throws BadRequestException `QUERY_SORT_NOT_ALLOWED` for an undeclared field or more than three
 * keys, which is the same refusal the REST query protocol raises for the same request.
 */
export function applyConnectionSort<T>(
	rows: readonly T[],
	sort: readonly ConnectionSortKey[],
	sortable: readonly string[],
	stated: readonly ConnectionSortKey[] = sort
): T[] {
	if (!sort || sort.length === 0) {
		return [...rows];
	}

	if (stated.length > API_QUERY_LIMITS.sortKeys) {
		throw new BadRequestException(
			`${ApiErrorCode.QUERY_SORT_NOT_ALLOWED}: at most ${API_QUERY_LIMITS.sortKeys} sort keys are allowed; ${stated.length} were stated. Allowed: ${sortable.join(', ')}.`
		);
	}

	for (const key of stated) {
		if (!sortable.includes(key?.field)) {
			throw new BadRequestException(
				`${ApiErrorCode.QUERY_SORT_NOT_ALLOWED}: '${String(key?.field)}' cannot be used for sorting here. Allowed: ${sortable.join(', ')}.`
			);
		}
	}

	return [...rows].sort((left, right) => {
		for (const key of sort) {
			const order = compare(readPath(left, key.field), readPath(right, key.field));

			if (order !== 0) {
				return key.direction === 'DESC' ? -order : order;
			}
		}

		// The id is the tie-break that makes the order total, which is what a cursor needs to name a
		// row rather than a position among equals.
		return compare(readPath(left, 'id'), readPath(right, 'id')) * (sort[0]?.direction === 'DESC' ? -1 : 1);
	});
}

/**
 * The sort a request runs under: the caller's, or the resource's own default.
 *
 * @param request The request.
 * @param defaultSort The resource's default order.
 * @returns The effective sort keys.
 */
export function effectiveSort(
	request: ConnectionRequest | undefined,
	defaultSort: readonly ConnectionSortKey[]
): ConnectionSortKey[] {
	const stated = request?.sort ?? [];

	return stated.length > 0 ? [...stated] : [...defaultSort];
}

/**
 * The page size a request asks for, within the protocol's caps.
 *
 * @param request The request.
 * @returns The page size.
 * @throws BadRequestException `QUERY_PAGE_LIMIT_EXCEEDED` above the cap.
 */
function resolveLimit(request: ConnectionRequest): number {
	const stated = request.limit ?? request.page?.first ?? request.page?.last ?? request.first ?? request.last;
	const size = stated === undefined || stated === null ? API_QUERY_LIMITS.defaultPageSize : Number(stated);

	if (!Number.isFinite(size) || size <= 0) {
		throw new BadRequestException(
			`${ApiErrorCode.QUERY_PAGE_LIMIT_EXCEEDED}: page[limit] must be between 1 and ${API_QUERY_LIMITS.maxPageSize}.`
		);
	}

	if (size > API_QUERY_LIMITS.maxPageSize) {
		throw new BadRequestException(
			`${ApiErrorCode.QUERY_PAGE_LIMIT_EXCEEDED}: page[limit] must not exceed ${API_QUERY_LIMITS.maxPageSize}.`
		);
	}

	return Math.floor(size);
}

/**
 * Refuses a request that states both pagination styles.
 *
 * @param request The request.
 * @throws BadRequestException `QUERY_NESTING_LIMIT_EXCEEDED` when both styles are stated.
 */
function assertSinglePaginationStyle(request: ConnectionRequest): void {
	const cursorStyle = Boolean(request.page) || request.first !== undefined || request.after !== undefined || request.last !== undefined || request.before !== undefined;
	const offsetStyle = request.limit !== undefined || request.offset !== undefined;

	if (cursorStyle && offsetStyle) {
		throw new BadRequestException(
			`${ApiErrorCode.QUERY_NESTING_LIMIT_EXCEEDED}: cursor pagination (page, first, after, last, before) cannot be combined with offset pagination (limit, offset).`
		);
	}
}

/**
 * Reads a cursor, answering the refusal the catalogue names rather than a decoder's message.
 *
 * @param cursor The cursor.
 * @param sort The effective sort.
 * @returns The row id the cursor points at.
 * @throws BadRequestException `QUERY_CURSOR_INVALID` / `QUERY_CURSOR_SORT_MISMATCH`.
 */
function readCursor(cursor: string, sort: readonly SortKey[]): { id: string; sortValue: string } {
	try {
		const payload = CursorCodec.decodeForSort(cursor, sort);

		return { id: payload.id, sortValue: payload.sortValue };
	} catch (error) {
		if (isApiQueryError(error)) {
			throw new BadRequestException(`${error.code}: ${error.message}`);
		}

		throw error;
	}
}

/**
 * Reads the connection contract over a set of rows.
 *
 * @param definition The resource's list surface and the caller's request.
 * @returns The connection: the page's rows, their per-item cursors, the filtered total and the
 * boundary cursors.
 * @throws BadRequestException for every refusal the query protocol names.
 */
export function buildConnection<T>(definition: ConnectionDefinition<T>): GraphqlConnection<T> {
	const { rows, filterable, sortable, defaultSort } = definition;
	const request = definition.request ?? {};

	assertSinglePaginationStyle(request);

	const sort = effectiveSort(request, defaultSort);
	const filtered = applyConnectionFilter(rows, request.filter, filterable);
	const ordered = applyConnectionSort(filtered, sort, sortable, request.sort ?? []);
	const totalCount = ordered.length;
	const limit = resolveLimit(request);

	const sortKey = sort[0]?.field ?? 'id';
	const cursorOf = (row: T): string => CursorCodec.encode(readPath(row, sortKey), readPath(row, 'id'), sort);

	let start = 0;
	let end = ordered.length;
	let hasPreviousPage = false;
	let hasNextPage = false;

	const after = request.page?.after ?? request.after;
	const before = request.page?.before ?? request.before;

	if (after !== undefined) {
		const { id, sortValue } = readCursor(after, sort);
		const index = ordered.findIndex((row) => String(readPath(row, 'id')) === id);
		// A row that has since been deleted cannot name a position, so the cursor's own sort value
		// decides where the walk resumes — which is what makes cursor pagination stable under
		// concurrent deletes rather than merely under inserts.
		start =
			index >= 0
				? index + 1
				: ordered.findIndex((row) => compare(readPath(row, sortKey), sortValue) > 0);
		if (start < 0) {
			start = ordered.length;
		}
		hasPreviousPage = true;
	} else if (request.offset !== undefined) {
		const offset = Number(request.offset);

		if (!Number.isFinite(offset) || offset < 0 || offset > API_QUERY_LIMITS.maxPageNumber * limit) {
			throw new BadRequestException(
				`${ApiErrorCode.QUERY_PAGE_LIMIT_EXCEEDED}: page[number] must not exceed ${API_QUERY_LIMITS.maxPageNumber}.`
			);
		}

		start = Math.floor(offset);
		hasPreviousPage = start > 0;
	}

	if (before !== undefined) {
		const { id, sortValue } = readCursor(before, sort);
		const index = ordered.findIndex((row) => String(readPath(row, 'id')) === id);
		end =
			index >= 0
				? index
				: ordered.findIndex((row) => compare(readPath(row, sortKey), sortValue) >= 0);
		if (end < 0) {
			end = ordered.length;
		}
		hasNextPage = true;
	}

	const window = ordered.slice(start, Math.max(start, end));
	const isBackward = (request.page?.last ?? request.last) !== undefined || before !== undefined;
	const page = isBackward ? window.slice(Math.max(0, window.length - limit)) : window.slice(0, limit);

	if (!isBackward) {
		hasNextPage = hasNextPage || start + page.length < end;
	} else {
		hasPreviousPage = hasPreviousPage || page.length < window.length;
	}

	const edges = page.map((node) => ({ node, cursor: cursorOf(node) }));

	return {
		nodes: page,
		edges,
		totalCount,
		pageInfo: {
			hasNextPage,
			hasPreviousPage,
			startCursor: edges.length > 0 ? edges[0].cursor : null,
			endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
		}
	};
}

/**
 * The page size a REST list route was asked for.
 *
 * The delivered query protocol spells a page as `take`/`skip`, and the platform's own default is
 * twenty rows. A route that receives neither answers the protocol's default rather than every row,
 * so the REST and GraphQL answers to one question have one size.
 *
 * @param take The stated size, if any.
 * @param skip The stated offset, if any.
 * @returns The slice bounds.
 */
export function resolveRestPage(take?: number, skip?: number): { readonly take: number; readonly skip: number } {
	const size = take === undefined || take === null ? API_QUERY_LIMITS.defaultPageSize : Number(take);

	if (!Number.isFinite(size) || size <= 0 || size > API_QUERY_LIMITS.maxPageSize) {
		throw new BadRequestException(
			`${ApiErrorCode.QUERY_PAGE_LIMIT_EXCEEDED}: page[limit] must be between 1 and ${API_QUERY_LIMITS.maxPageSize}.`
		);
	}

	const offset = skip === undefined || skip === null ? 0 : Number(skip);

	if (!Number.isFinite(offset) || offset < 0) {
		throw new BadRequestException(
			`${ApiErrorCode.QUERY_PAGE_LIMIT_EXCEEDED}: page[number] must not be negative.`
		);
	}

	return { take: Math.floor(size), skip: Math.floor(offset) };
}

/**
 * Slices the rows a kernel list method answered with into the page the caller asked for.
 *
 * The list methods return the filtered set in the order they mean, and the route reports `total` as
 * the size of that set — the count of the filtered rows rather than the count of the page, which is
 * what the list envelope has always carried.
 *
 * @param rows The rows.
 * @param take The page size.
 * @param skip The offset.
 * @returns The page, and the filtered total.
 */
export function paginateRows<T>(rows: readonly T[], take: number, skip: number): { items: T[]; total: number } {
	return { items: rows.slice(skip, skip + take), total: rows.length };
}
