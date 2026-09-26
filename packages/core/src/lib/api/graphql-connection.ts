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
	/**
	 * Whether retired rows are included.
	 *
	 * **`buildConnection` does not read this, and cannot.** It is handed the rows a service already read, so
	 * soft-delete visibility was decided by that read — the member is here because the request mirrors the
	 * query protocol's own shape, and a resource that offers the flag states it on the field and passes it to
	 * its read (the tax resolvers are the worked example:
	 * `...(withDeleted ? { withDeleted: true } : {})`). A resolver that declared the argument and expected
	 * this function to apply it would answer the same rows either way, and nothing would say so.
	 */
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
 * **An absent value is the largest value**, in both directions: a null sorts after every present
 * value ascending, and before every present value descending. That is one rule rather than two, it is
 * the rule the platform's own store applies on the primary dialect, and — because a cursor walk is
 * only stable if the order it walks is — it is stated here rather than left to whichever store an
 * installation runs: the alternative, a dialect-dependent placement, would make the same walk return
 * different rows on two installations and would let the GraphQL answer disagree with the REST one.
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
 * One side of a comparison on a date field, as epoch milliseconds.
 *
 * A store returns a `timestamp` column as a `Date` and the wire carries an instant as RFC 3339 text,
 * so the two sides of one comparison arrive in two different shapes. This brings either of them to
 * the one scale they can be compared on. A value that is not an instant at all — a text column that
 * merely looks like one, or a value a caller stated in a shape the calendar cannot read — is
 * answered with `undefined`, and the caller falls back to comparing it as it stands rather than
 * silently treating it as the epoch.
 *
 * @param value The row's value, or the value the caller stated.
 * @returns The instant in milliseconds, or undefined when the value is not one.
 */
function instantMillis(value: unknown): number | undefined {
	if (value instanceof Date) {
		return value.getTime();
	}

	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : undefined;
	}

	if (typeof value === 'string') {
		const parsed = Date.parse(value.trim());

		return Number.isFinite(parsed) ? parsed : undefined;
	}

	return undefined;
}

/**
 * Whether one row matches one condition.
 *
 * @param value The row's value for the field.
 * @param condition The condition.
 * @param kind The field's kind: a `DATE` field's two sides are compared as instants, everything else
 * as it stands.
 * @param field The field name, for the error message.
 * @returns True when the row satisfies the condition.
 */
function matchesCondition(value: unknown, condition: ConnectionCondition, kind: ConnectionFieldKind, field: string): boolean {
	const members = Object.entries(condition).filter(([, stated]) => stated !== undefined && stated !== null);

	/**
	 * One side of a comparison, on the scale the field's kind is compared on.
	 *
	 * **This is not a nicety.** A date column reaches this function as a `Date` and a caller states an
	 * instant as RFC 3339 text, so comparing the two as they arrive compared epoch milliseconds against
	 * a calendar date: `createdAt: { eq: "2026-03-01T10:00:00.000Z" }` matched no row at all, and the
	 * range operators answered nonsense. Both sides are therefore rendered as instants when the field
	 * is a date, which is the one scale an instant has.
	 */
	const onScale = (candidate: unknown): unknown => {
		if (kind !== 'DATE') {
			return candidate;
		}

		const instant = instantMillis(candidate);

		return instant === undefined ? candidate : instant;
	};

	for (const [operator, stated] of members) {
		switch (operator) {
			case 'eq':
				if (compare(onScale(value), onScale(stated)) !== 0) return false;
				break;
			case 'ne':
				if (value === null || value === undefined || compare(onScale(value), onScale(stated)) === 0) return false;
				break;
			case 'in':
				if (!Array.isArray(stated) || !stated.some((candidate) => compare(onScale(value), onScale(candidate)) === 0)) {
					return false;
				}
				break;
			case 'nin':
				if (value === null || value === undefined) return false;
				if (Array.isArray(stated) && stated.some((candidate) => compare(onScale(value), onScale(candidate)) === 0)) {
					return false;
				}
				break;
			case 'like':
				if (typeof value !== 'string' || !patternToRegExp(String(stated), false).test(value)) return false;
				break;
			case 'ilike':
				if (typeof value !== 'string' || !patternToRegExp(String(stated), true).test(value)) return false;
				break;
			case 'gt':
				if (value === null || value === undefined || compare(onScale(value), onScale(stated)) <= 0) return false;
				break;
			case 'gte':
				if (value === null || value === undefined || compare(onScale(value), onScale(stated)) < 0) return false;
				break;
			case 'lt':
				if (value === null || value === undefined || compare(onScale(value), onScale(stated)) >= 0) return false;
				break;
			case 'lte':
				if (value === null || value === undefined || compare(onScale(value), onScale(stated)) > 0) return false;
				break;
			case 'between': {
				if (!Array.isArray(stated) || stated.length !== 2) {
					throw new BadRequestException(
						`${ApiErrorCode.VALIDATION_INVALID_DATE_RANGE}: '${field}' takes exactly two bounds, lower first.`
					);
				}
				if (value === null || value === undefined) return false;
				if (compare(onScale(value), onScale(stated[0])) < 0 || compare(onScale(value), onScale(stated[1])) > 0) {
					return false;
				}
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

/**
 * The page a service already sliced, as the connection the schema promises.
 *
 * This is the other half of {@link buildConnection}, and the difference between them is where the page
 * is decided. `buildConnection` applies the whole query protocol to rows the caller has not paged —
 * `filter`, `sort`, cursors — because a kernel list method answers the filtered set in the order it
 * means. A plugin's own list resource is paged in the store instead: `findAll({ skip, take })` answers
 * `{ items, total }`, `total` is the count of the *filtered* rows rather than of the page, and the
 * caller's filter and sort have already been applied by the criteria it was given.
 *
 * What such a resolver still owes the client is the connection: the page's rows addressable two ways,
 * the count, and the boundary information a cursor walk needs. Writing that per connection is what
 * produced three spellings of it across this branch — `{items, total}` in the payment family,
 * `{nodes, total}` beside it, and the canonical shape here — so this function is the one place it is
 * written, and a connection that answers anything else is a connection that drifted.
 *
 * The cursors are the caller's to derive, because only the resource knows what identifies a row: most
 * pass the row's id, and a resource with a natural key passes that. `hasPreviousPage` is decided by
 * the offset rather than by the rows, since the caller is the one who stated it.
 *
 * @param page The page the service returned: its rows and the count of the filtered set.
 * @param options The offset the page starts at, and how a row's cursor is derived.
 * @returns The connection, in the shape every `*Connection` type declares.
 */
export function connectionFromPage<T>(
	page: { items?: readonly T[]; total?: number } | null | undefined,
	options: { readonly skip?: number; readonly cursorOf?: (row: T) => string } = {}
): GraphqlConnection<T> {
	const nodes = page?.items ?? [];
	const totalCount = page?.total ?? nodes.length;
	const skip = Math.max(options.skip ?? 0, 0);
	const cursorOf = options.cursorOf ?? ((row: T) => String((row as { id?: unknown })?.id ?? ''));
	const cursors = nodes.map((row) => cursorOf(row));
	const end = skip + nodes.length;

	return {
		nodes,
		edges: nodes.map((node, index) => ({ node, cursor: cursors[index] })),
		totalCount,
		pageInfo: {
			hasNextPage: end < totalCount,
			hasPreviousPage: skip > 0,
			startCursor: cursors.length > 0 ? cursors[0] : null,
			endCursor: cursors.length > 0 ? cursors[cursors.length - 1] : null
		}
	};
}

/**
 * What a caller may state about the page it wants.
 *
 * Two spellings, because two are in use and both are the query protocol's: the cursor spelling
 * (`first`/`after`, `last`/`before`) and the offset spelling (`limit`/`offset`). Stating a forward and
 * a backward walk together has no defined meaning and is refused rather than resolved by preferring one.
 *
 * Every member may arrive as `null` as well as absent: every one of them is a nullable argument in the
 * schema, and GraphQL keeps an explicit `null` — a Relay client sends `after: null` on every first fetch,
 * and a generated client sends `limit: null` beside `page`. A `null` member states nothing, exactly like
 * an absent one; {@link resolveConnectionWindow} reads it that way.
 */
export interface IConnectionPageSelection {
	first?: number | null;
	after?: string | null;
	last?: number | null;
	before?: string | null;
	limit?: number | null;
	offset?: number | null;
}

/**
 * The members of a page selection that state something, with every `null` member dropped.
 *
 * GraphQL distinguishes an argument that was never written from one that was written as `null`, and the
 * window below must not: `{ first: 20, after: null }` is how a Relay client asks for the first page, and
 * reading that `null` as a stated cursor refused the first page of every store-paged connection as a
 * cursor this platform did not mint. The same reading turned `{ first: 10, last: null }` into a direction
 * conflict and `page` beside `limit: null` into a style conflict. Dropping the `null` members once, before
 * any check runs, is what makes every check below mean "the caller stated this".
 *
 * @param selection The selection as the resolver received it.
 * @returns The members the caller actually stated.
 */
function statedPageMembers(selection?: IConnectionPageSelection | null): {
	first?: number;
	after?: string;
	last?: number;
	before?: string;
	limit?: number;
	offset?: number;
} {
	return Object.fromEntries(
		Object.entries(selection ?? {}).filter(([, value]) => value !== null && value !== undefined)
	);
}

/**
 * The page size used when a caller states none.
 *
 * Taken from the query protocol rather than chosen here: a connection is the same contract over GraphQL
 * as over REST, and two constants that happened to disagree answered one request with twenty rows over
 * one surface and twenty-five over the other. A client that pages both sees the difference immediately.
 */
export const DEFAULT_CONNECTION_PAGE_SIZE = API_QUERY_LIMITS.defaultPageSize;

/**
 * The largest page a caller may ask for, so one request cannot pull a table.
 *
 * The protocol's own ceiling for the same reason the default is: REST refuses a page above it, so a
 * GraphQL field that accepted a larger one would answer a set the other surface declines to answer.
 */
export const MAX_CONNECTION_PAGE_SIZE = API_QUERY_LIMITS.maxPageSize;

/**
 * The window a caller's page selection asks for, for a resource paged in the store.
 *
 * This is the offset scheme rather than the cursor one {@link buildConnection} implements, and the
 * difference is what the caller can be told. A cursor there names a row (it carries the row's id and its
 * sort value), which is stable under inserts because the walk resumes from a value rather than a count. A
 * cursor here names a *position* — the offset of the row it was handed out for, encoded opaquely — which is
 * what a store-paged read can honour: `findAll({ skip, take })` has no way to resume from a value, and
 * inventing a cursor that looked row-addressed while behaving positionally is how a client ends up skipping
 * rows after an insert.
 *
 * **Both cursors are exclusive, which is what the schema says they are.** A cursor names the row it was
 * handed out for, so `after` resumes at the row *past* it and `before` ends the window at the row *before*
 * it — the two arithmetic operations differ, and reading both as "the offset to resume at" is what made a
 * backward walk answer the rows after its cursor, in the forward direction, instead of the rows before it.
 * A backward walk is a window that ends at the cursor rather than one that starts there, so its `skip` is
 * the page size subtracted from the cursor's offset: `last: 5, before: <offset 12>` reads rows 7 to 11.
 *
 * **A backward window never reaches the cursor it ends at.** Near the start of the list there are fewer
 * rows before the cursor than the page size asks for, so the window is shortened rather than merely
 * clamped: `last: 5, before: <offset 3>` reads rows 0 to 2. Clamping the start alone kept five rows and
 * answered rows 0 to 4 — the cursor's own row, which is exclusive, and a row after it, both of which the
 * client already had on screen. `before: <offset 0>` names the first row, so nothing lies before it and
 * the window is **empty**: `{ skip: 0, take: 0 }`. That is the one window whose `take` is zero, and it
 * means "no rows" — `CrudService.findAll` answers it with the count alone and `paginateRows` with an
 * empty slice. A caller that reads through a store of its own must do the same rather than hand a zero
 * `take` to its ORM, where a zero limit is ignored and the read is unbounded.
 *
 * A backward walk needs its anchor: `last` with no `before` means "the last n rows", and the offset that
 * starts is `total - n`, which this function cannot know before the read. It is refused rather than
 * answered from the beginning, because answering the first page to a request for the last one is a wrong
 * answer a client cannot detect.
 *
 * A member stated as `null` states nothing (see {@link statedPageMembers}), so `{ first: 20, after: null }`
 * is the first page, as a Relay client means it.
 *
 * @param selection The requested page.
 * @returns The offset the page starts at and how many rows it holds; `take` is zero only for the empty
 * backward window described above.
 * @throws BadRequestException when a caller mixes forward and backward pagination, mixes the two styles,
 * states a cursor this platform did not mint, asks for a backward walk with no anchor, or states a
 * position past the deepest page the protocol allows.
 */
export function resolveConnectionWindow(selection?: IConnectionPageSelection | null): { skip: number; take: number } {
	const stated = statedPageMembers(selection);

	if (stated.first !== undefined && stated.last !== undefined) {
		throw new BadRequestException('PAGINATION_DIRECTION_CONFLICT: state first or last, not both.');
	}

	if (stated.after !== undefined && stated.before !== undefined) {
		throw new BadRequestException('PAGINATION_DIRECTION_CONFLICT: state after or before, not both.');
	}

	if (stated.last !== undefined && stated.before === undefined) {
		throw new BadRequestException(
			'PAGINATION_ANCHOR_REQUIRED: last walks backwards from before; state before, or ask for first.'
		);
	}

	const cursorsStated =
		stated.first !== undefined || stated.after !== undefined || stated.last !== undefined || stated.before !== undefined;

	if (cursorsStated && (stated.limit !== undefined || stated.offset !== undefined)) {
		throw new BadRequestException(
			'PAGINATION_STYLE_CONFLICT: state either a cursor window (first/after/last/before) or a page window (limit/offset), not both.'
		);
	}

	const requested = stated.first ?? stated.last ?? stated.limit ?? DEFAULT_CONNECTION_PAGE_SIZE;
	const take = Math.min(Math.max(Math.trunc(requested) || DEFAULT_CONNECTION_PAGE_SIZE, 1), MAX_CONNECTION_PAGE_SIZE);
	const window =
		stated.after !== undefined
			? { skip: readCursorOffset(stated.after) + 1, take }
			: stated.before !== undefined
				? backwardWindow(readCursorOffset(stated.before), take)
				: { skip: stated.offset !== undefined ? Math.max(Math.trunc(stated.offset) || 0, 0) : 0, take };

	// Checked against the requested page size rather than the window's own `take`, which a backward
	// window near the start shortens: the cap is a statement about how deep a page may start, and the
	// page size the caller asked for is what that depth is counted in.
	assertPageInRange(window.skip, take);

	return window;
}

/**
 * The window that ends at the row before a cursor, holding at most `take` rows.
 *
 * Both edges move near the start of the list: the start is clamped to the first row, and the size shrinks
 * to the rows that actually lie before the cursor, so the window never reaches the cursor's own row. At
 * the first row the window is empty — `take` zero — because there is nothing before it.
 *
 * @param end The offset of the row the `before` cursor names; the window stops short of it.
 * @param take The page size the caller asked for.
 * @returns The window.
 */
function backwardWindow(end: number, take: number): { skip: number; take: number } {
	return { skip: Math.max(end - take, 0), take: Math.min(take, end) };
}

/**
 * The deepest offset a page of `take` rows may start at.
 *
 * One number, read by the two places that must agree on it: {@link assertPageInRange}, which refuses a
 * window that starts past it, and {@link connectionFromOffsetPage}, which must not advertise a next page
 * that the refusal would then turn away.
 *
 * @param take The page size.
 * @returns The largest accepted `skip`.
 */
function deepestPageStart(take: number): number {
	return take * API_QUERY_LIMITS.maxPageNumber;
}

/**
 * Refuses a page that starts past the deepest one the protocol allows.
 *
 * The same ceiling `buildConnection` applies to an offset, applied to the offset a cursor names: without it
 * a caller could state any position at all — and a store-paged read that has to reach that position reads
 * every row before it, so an offset is a cost, not just a number. `QUERY_PAGE_LIMIT_EXCEEDED` is the code
 * REST raises for the same request.
 *
 * **The cap applies to cursor continuation as well as to `offset`, deliberately.** A position cursor is
 * the offset encoded — anyone can mint `after: <offset 10⁹>` — so a cap that exempted cursors would be no
 * cap at all. What a walk must not meet is a refusal the connection told it to expect nothing of, and that
 * is kept on the other side: {@link connectionFromOffsetPage} reports `hasNextPage: false` on the last page
 * this cap accepts, so a client that walks while `hasNextPage` is true stops where the cap does, with
 * `totalCount` still stating how many rows the filter selects.
 *
 * @param skip The offset the page starts at.
 * @param take The page size.
 * @throws BadRequestException when the page starts beyond `maxPageNumber` pages in.
 */
function assertPageInRange(skip: number, take: number): void {
	const deepest = deepestPageStart(take);

	if (skip > deepest) {
		throw new BadRequestException(
			`${ApiErrorCode.QUERY_PAGE_LIMIT_EXCEEDED}: page[number] must not exceed ${API_QUERY_LIMITS.maxPageNumber}.`
		);
	}
}

/**
 * The offset a cursor names, refused when it is not one this platform minted.
 *
 * {@link decodeOffsetCursor} answers a miss with zero, which is right for a caller that is asking "where
 * does this resume" and wrong for a window: a cursor that cannot be read would silently become the first
 * page, and a client that asked to continue would be handed rows it already has. The value is therefore
 * round-tripped — a cursor is valid exactly when re-encoding what it decodes to reproduces it — so a
 * truncated, foreign or hand-written cursor is refused where it is stated.
 *
 * @param cursor The cursor a caller handed back.
 * @returns The offset of the row it was handed out for.
 * @throws BadRequestException `PAGINATION_CURSOR_INVALID` when it is not a cursor this platform minted.
 */
export function readCursorOffset(cursor: string): number {
	const offset = decodeOffsetCursor(cursor);

	if (encodeOffsetCursor(offset) !== cursor) {
		throw new BadRequestException('PAGINATION_CURSOR_INVALID: the cursor is not one this endpoint issued.');
	}

	return offset;
}

/**
 * @param cursor The cursor a caller handed back.
 * @returns The offset it carries; zero when there is none or when it is unreadable.
 */
export function decodeOffsetCursor(cursor?: string): number {
	if (!cursor) {
		return 0;
	}

	try {
		const offset = Number.parseInt(Buffer.from(cursor, 'base64').toString('utf8'), 10);

		return Number.isFinite(offset) && offset >= 0 ? offset : 0;
	} catch (error) {
		return 0;
	}
}

/**
 * @param offset The offset a page starts at.
 * @returns The opaque cursor that resumes at it.
 */
export function encodeOffsetCursor(offset: number): string {
	return Buffer.from(String(Math.max(offset, 0)), 'utf8').toString('base64');
}

/**
 * The store-paged page, as the connection the schema promises, with position cursors.
 *
 * {@link connectionFromPage} addresses each row by whatever identifies it, which is what a resource with
 * a natural key wants. This is the same shape with the offset scheme's cursors: every row is addressed by
 * the offset it sits at, so the next page is `first: n, after: pageInfo.endCursor` — the cursor is
 * exclusive, and the walk neither repeats nor skips a row it has already answered.
 *
 * **`hasNextPage` is a promise the next request will be answered.** The window resolver refuses a page
 * that starts past the protocol's deepest one (see {@link assertPageInRange}), and the next page of this
 * one starts at `end`. Reporting `hasNextPage: true` whenever rows remain told a client at the ceiling to
 * continue and then refused the continuation with `QUERY_PAGE_LIMIT_EXCEEDED` — a Relay client that pages
 * while `hasNextPage` is true failed on a walk the API itself had advertised. The ceiling is therefore
 * applied here too: past it `hasNextPage` is `false` while `totalCount` still states the whole count, which
 * is how a client tells a walk that ended at the ceiling from one that ran out of rows. The page size the
 * ceiling is counted in is the one the window resolver used; a caller that does not pass it has it read
 * from the page itself, which is the same number for every page that has a next one — only a full page
 * can be followed by more rows.
 *
 * @param page The page the service returned.
 * @param skip The offset the page started at.
 * @param take The page size the window was resolved with; defaults to the number of rows on the page.
 * @returns The connection, in the shape every `*Connection` type declares.
 */
export function connectionFromOffsetPage<T>(
	page: { items?: readonly T[]; total?: number } | null | undefined,
	skip = 0,
	take?: number
): GraphqlConnection<T> {
	const nodes = page?.items ?? [];
	const start = Math.max(skip, 0);
	const totalCount = page?.total ?? nodes.length;
	const end = start + nodes.length;
	const cursorOf = (offset: number): string => encodeOffsetCursor(offset);
	const pageSize = take !== undefined && take > 0 ? take : nodes.length;
	// The next page starts at `end`; it is only a next page if the window resolver would accept it. A page
	// with no rows hands out no cursor to continue from, so the ceiling has nothing to say about it.
	const nextPageAccepted = nodes.length === 0 || end <= deepestPageStart(pageSize);

	return {
		nodes: [...nodes],
		edges: nodes.map((node, index) => ({ node, cursor: cursorOf(start + index) })),
		totalCount,
		pageInfo: {
			hasNextPage: end < totalCount && nextPageAccepted,
			hasPreviousPage: start > 0,
			startCursor: nodes.length > 0 ? cursorOf(start) : null,
			// The boundary cursor is the cursor of the last row rather than the offset past it: a client
			// that walks from `edges[last].cursor` and a client that walks from `pageInfo.endCursor` are
			// then taking the same step, and `after` being exclusive makes that step land on `end`.
			endCursor: nodes.length > 0 ? cursorOf(end - 1) : null
		}
	};
}
