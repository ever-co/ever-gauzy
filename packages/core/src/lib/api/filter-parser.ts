import {
	API_QUERY_LIMITS,
	ApiQueryError,
	FilterNode,
	FilterOperator
} from './query-ast';
import type { ApiQueryFieldKind, ApiQuerySchema } from './query-schema';

/**
 * The filter grammar, in one pure function.
 *
 * A REST query string is parsed by the HTTP layer into a nested object — `filter[status][in]=A,B`
 * arrives as `{ status: { in: 'A,B' } }` — and GraphQL arrives as a filter input object with the
 * same shape. Both are handed to {@link parseFilter}, which is why the two surfaces cannot
 * disagree about what a filter means: there is one function, and it takes values rather than a
 * request.
 *
 * What the parser does, and what it deliberately does not:
 *
 * - it validates the *shape* of the query against the resource's declared allow-lists and caps,
 *   and coerces each value to the field's kind;
 * - it does not decide SQL. `isNull: true` becomes a condition whose value is the boolean `true`,
 *   not a bare `null`, so the translator can only ever emit `IS NULL` explicitly. That distinction
 *   is what keeps the platform's historical null-semantics trap closed;
 * - it does not look at permissions. A filter is accepted or refused on its own terms; whether the
 *   caller may read the rows is the guard chain's business.
 */

/**
 * The operators each field kind accepts.
 *
 * The table is the grammar. `like`/`ilike` are text operations, the four comparisons and the range
 * are ordered-value operations, `contains` is containment and therefore belongs to structured
 * values — and, because the generated `StringFilter` offered to GraphQL clients includes
 * `contains`, text as well; a schema that advertises an operator the parser refuses is a schema
 * that lies, and the parity check in the input generator asserts that every operator the GraphQL
 * projection emits appears in this table.
 */
export const FILTER_OPERATORS_BY_KIND: Readonly<Record<ApiQueryFieldKind, readonly FilterOperator[]>> = {
	ID: ['eq', 'ne', 'in', 'nin', 'isNull'],
	STRING: ['eq', 'ne', 'in', 'nin', 'like', 'ilike', 'isNull', 'contains'],
	NUMBER: ['eq', 'ne', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull'],
	DECIMAL: ['eq', 'ne', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull'],
	DATE: ['eq', 'ne', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull'],
	BOOLEAN: ['eq', 'ne', 'in', 'nin', 'isNull'],
	ENUM: ['eq', 'ne', 'in', 'nin', 'isNull'],
	JSON: ['eq', 'ne', 'isNull', 'contains']
};

/**
 * The operators a field with no declared kind accepts.
 *
 * A resource lists a field as filterable long before anybody needs to say what type it is. Rather
 * than reject the query, the parser allows the four operators that are well defined without a
 * type: equality, inequality, membership and a null test.
 */
export const DEFAULT_FILTER_OPERATORS: readonly FilterOperator[] = ['eq', 'ne', 'in', 'nin', 'isNull'];

/** Every operator name, for the "unknown operator" message. */
const ALL_FILTER_OPERATORS: readonly FilterOperator[] = [
	'eq',
	'ne',
	'in',
	'nin',
	'like',
	'ilike',
	'gt',
	'gte',
	'lt',
	'lte',
	'between',
	'isNull',
	'contains'
];

/** The boolean group keys a filter object may carry. */
const GROUP_KEYS = ['$and', '$or'] as const;
type GroupKey = (typeof GROUP_KEYS)[number];

/** A value that is a plain object rather than an array or a scalar. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

/** The operators a field accepts, given its declared kind. */
export function operatorsForKind(kind: ApiQueryFieldKind | undefined): readonly FilterOperator[] {
	if (!kind) {
		return DEFAULT_FILTER_OPERATORS;
	}
	return FILTER_OPERATORS_BY_KIND[kind] ?? DEFAULT_FILTER_OPERATORS;
}

/** Splits a path into its segments, refusing anything the grammar does not allow. */
function parsePath(rawPath: string): readonly string[] {
	const segments = rawPath.split('.').filter((segment) => segment.length > 0);
	if (segments.length === 0) {
		throw new ApiQueryError('VALIDATION_FAILED', 'A filter key must name a field.');
	}
	if (segments.length > API_QUERY_LIMITS.filterPathSegments) {
		throw new ApiQueryError(
			'QUERY_FILTER_DEPTH_EXCEEDED',
			`The filter path "${rawPath}" has ${segments.length} segments; at most ${API_QUERY_LIMITS.filterPathSegments} are allowed.`,
			{ path: rawPath, limit: API_QUERY_LIMITS.filterPathSegments, actual: segments.length }
		);
	}
	return segments;
}

/**
 * Checks the field against the resource's allow-list.
 *
 * @param path The dotted path the caller asked for.
 * @param schema The resource's declaration, when it has one.
 * @returns The kind declared for the field, or `undefined` when the schema declares no kinds.
 */
function assertFilterable(path: string, schema?: ApiQuerySchema): ApiQueryFieldKind | undefined {
	if (!schema?.filterable) {
		return schema?.kinds?.[path];
	}
	if (!schema.filterable.includes(path)) {
		throw new ApiQueryError('QUERY_UNKNOWN_FILTER_FIELD', `"${path}" is not a filterable field of "${schema.resource}".`, {
			field: path,
			allowed: [...schema.filterable]
		});
	}
	return schema.kinds?.[path];
}

/** Checks the operator against the field's kind. */
function assertOperatorAllowed(op: string, path: string, kind: ApiQueryFieldKind | undefined): FilterOperator {
	if (!ALL_FILTER_OPERATORS.includes(op as FilterOperator)) {
		throw new ApiQueryError('QUERY_UNSUPPORTED_OPERATOR', `"${op}" is not an operator of the query protocol.`, {
			field: path,
			operator: op,
			allowed: [...ALL_FILTER_OPERATORS]
		});
	}
	const operator = op as FilterOperator;
	const allowed = operatorsForKind(kind);
	if (!allowed.includes(operator)) {
		throw new ApiQueryError(
			'QUERY_UNSUPPORTED_OPERATOR',
			`The operator "${operator}" is not supported for "${path}"${kind ? ` (${kind})` : ''}.`,
			{ field: path, operator, kind: kind ?? null, allowed: [...allowed] }
		);
	}
	return operator;
}

/** A decimal string: an optionally signed integer part and an optional fraction. */
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/** An ISO-8601 instant carrying an offset or a `Z`, which is what a date filter must be. */
const ISO_INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Whether a well-shaped date names a day that exists.
 *
 * `2026-02-31` has the shape of a date and is not one; a parser that only checked the shape would
 * hand it on, and the driver would roll it forward to the third of March — silently moving the end
 * of a range. The check reconstructs the instant from the text and compares the day back, which is
 * the only way to see the rollover.
 */
function isRealCalendarDate(text: string): boolean {
	const match = ISO_INSTANT_PATTERN.exec(text);
	if (!match) {
		return false;
	}
	const [, year, month, day] = match;
	const constructed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	return (
		!Number.isNaN(constructed.getTime()) &&
		constructed.getUTCFullYear() === Number(year) &&
		constructed.getUTCMonth() === Number(month) - 1 &&
		constructed.getUTCDate() === Number(day)
	);
}

/** Reads the values of a list operator, from a JSON array or the comma-separated wire form. */
function toList(value: unknown, path: string, op: FilterOperator): unknown[] {
	let values: unknown[];
	if (Array.isArray(value)) {
		// The explicit form: every entry is what the caller wrote, including an empty string, which is
		// a real value for a text field. Only an absent entry is meaningless.
		values = value.filter((entry) => entry !== undefined);
	} else if (typeof value === 'string') {
		// The wire form. `$`-prefixed and comma separated are both in use; the comma form is the
		// documented one. A client that builds the string by joining its values sends `''` for an
		// empty list and `'a,'` for a list with a trailing separator, so a whitespace-only entry is an
		// artifact of the encoding rather than a value — dropping it is what lets the empty-list
		// refusal below catch the case the comment there describes.
		values = value
			.split(',')
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);
	} else {
		values = [value];
	}
	if (values.length === 0) {
		// An empty membership test is not "match nothing" — it is a query that cannot be answered,
		// and answering it with zero rows (or with "match the empty string") would hide the client's
		// mistake behind a plausible page.
		throw new ApiQueryError('VALIDATION_INVALID_ENUM', `The "${op}" filter for "${path}" has no values.`, { field: path });
	}
	if (values.length > API_QUERY_LIMITS.inListWidth) {
		throw new ApiQueryError(
			'QUERY_FILTER_DEPTH_EXCEEDED',
			`The "${op}" filter for "${path}" has ${values.length} values; at most ${API_QUERY_LIMITS.inListWidth} are allowed.`,
			{ field: path, limit: API_QUERY_LIMITS.inListWidth, actual: values.length }
		);
	}
	return values;
}

/** Coerces one value to the field's kind, refusing anything that would silently change meaning. */
function coerceValue(value: unknown, kind: ApiQueryFieldKind | undefined, path: string, op: FilterOperator): unknown {
	if (op === 'isNull') {
		const flag = typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true';
		if (typeof value !== 'boolean' && !['true', 'false'].includes(String(value).toLowerCase())) {
			throw new ApiQueryError('VALIDATION_FAILED', `The "isNull" filter for "${path}" takes true or false.`, { field: path });
		}
		return flag;
	}

	if (op === 'in' || op === 'nin') {
		return toList(value, path, op).map((entry) => coerceScalar(entry, kind, path, op));
	}

	if (op === 'between') {
		const bounds = toList(value, path, op);
		if (bounds.length !== 2) {
			throw new ApiQueryError(kind === 'DATE' ? 'VALIDATION_INVALID_DATE_RANGE' : 'VALIDATION_FAILED', `The "between" filter for "${path}" takes exactly two values.`, {
				field: path,
				actual: bounds.length
			});
		}
		const coerced = bounds.map((entry) => coerceScalar(entry, kind, path, op));
		if (kind === 'DATE' && String(coerced[0]) > String(coerced[1])) {
			// An inclusive range whose ends are reversed matches nothing; the client meant the other
			// order, and a page of zero rows would not tell them so.
			throw new ApiQueryError('VALIDATION_INVALID_DATE_RANGE', `The "between" filter for "${path}" is reversed.`, {
				field: path,
				from: coerced[0],
				to: coerced[1]
			});
		}
		return coerced;
	}

	if (op === 'contains') {
		return value;
	}

	return coerceScalar(value, kind, path, op);
}

/** Coerces a scalar to the field's kind. */
function coerceScalar(value: unknown, kind: ApiQueryFieldKind | undefined, path: string, op: FilterOperator): unknown {
	// A text-valued operator takes the text as sent: a pattern is not a number, whatever the field
	// holds, and trimming or parsing it would corrupt the wildcards.
	if (op === 'like' || op === 'ilike') {
		return String(value);
	}
	if (value === null || value === undefined) {
		throw new ApiQueryError('VALIDATION_FAILED', `The "${op}" filter for "${path}" needs a value; use "isNull" to test for one.`, {
			field: path,
			operator: op
		});
	}

	switch (kind) {
		case 'NUMBER': {
			const parsed = typeof value === 'number' ? value : Number(String(value).trim());
			if (!Number.isFinite(parsed)) {
				throw new ApiQueryError('VALIDATION_FAILED', `The "${op}" filter for "${path}" needs a number.`, { field: path });
			}
			return parsed;
		}
		case 'DECIMAL': {
			// Money is never a float. A JSON number with a fraction has already lost the client's
			// precision by the time it arrives, so it is refused rather than rounded.
			if (typeof value === 'number' && !Number.isInteger(value)) {
				throw new ApiQueryError('VALIDATION_MONEY_PRECISION', `The "${op}" filter for "${path}" needs a decimal string, not a fractional number.`, {
					field: path,
					value
				});
			}
			const text = String(value).trim();
			if (!DECIMAL_PATTERN.test(text)) {
				throw new ApiQueryError('VALIDATION_MONEY_PRECISION', `The "${op}" filter for "${path}" needs a decimal string.`, {
					field: path,
					value
				});
			}
			return text;
		}
		case 'BOOLEAN': {
			if (typeof value === 'boolean') {
				return value;
			}
			const text = String(value).trim().toLowerCase();
			if (text !== 'true' && text !== 'false') {
				throw new ApiQueryError('VALIDATION_FAILED', `The "${op}" filter for "${path}" needs true or false.`, { field: path });
			}
			return text === 'true';
		}
		case 'DATE': {
			const text = String(value).trim();
			// Both halves matter: the shape check keeps a locale format out, and the calendar check
			// keeps a well-shaped day that does not exist from becoming a range whose ends move.
			if (!isRealCalendarDate(text) || Number.isNaN(Date.parse(text))) {
				throw new ApiQueryError('VALIDATION_INVALID_DATE_RANGE', `The "${op}" filter for "${path}" needs an ISO-8601 date.`, {
					field: path,
					value
				});
			}
			return text;
		}
		case 'JSON':
			return value;
		case 'ID':
		case 'STRING':
		case 'ENUM':
			return typeof value === 'string' ? value : String(value);
		default:
			// No declared kind: the value is passed through as it arrived. Guessing that a number is
			// text would change what the resource is asked for on a route whose declaration says
			// nothing about the field.
			return value;
	}
}

/** Parses one `{ op: value }` object — or a bare scalar, which is shorthand for `eq`. */
function parseConditionObject(
	segments: readonly string[],
	path: string,
	value: unknown,
	kind: ApiQueryFieldKind | undefined
): FilterNode[] {
	const normalisedPath = path;

	// A bare scalar, or an array, is the shorthand form: `filter[status]=DRAFT` and
	// `filter[status][]=A&filter[status][]=B` both mean what a client would expect them to mean.
	if (!isPlainObject(value)) {
		const op: FilterOperator = Array.isArray(value) ? 'in' : 'eq';
		assertOperatorAllowed(op, normalisedPath, kind);
		return [{ kind: 'condition', path: segments, op, value: coerceValue(value, kind, normalisedPath, op) }];
	}

	const entries = Object.entries(value);
	if (entries.length === 0) {
		throw new ApiQueryError('VALIDATION_FAILED', `The filter for "${normalisedPath}" names no operator.`, { field: normalisedPath });
	}

	return entries
		// An operator sent without a value never reached the query: the HTTP layer drops undefined
		// parameters, but a JSON body can carry an explicit null. A null here means "not filtered on
		// this key" — the ingress convention the JSON parser already documents for this platform —
		// while a null *test* is spelled `isNull`, so a caller cannot express one by accident.
		.filter(([, entry]) => entry !== null && entry !== undefined)
		.map(([rawOperator, entry]) => {
			const op = assertOperatorAllowed(rawOperator, normalisedPath, kind);
			return {
				kind: 'condition' as const,
				path: segments,
				op,
				value: coerceValue(entry, kind, normalisedPath, op)
			};
		});
}

/** Parses a boolean group. */
function parseGroup(key: GroupKey, rawGroup: unknown, schema: ApiQuerySchema | undefined, depth: number): FilterNode {
	if (depth >= API_QUERY_LIMITS.filterNestingLevels) {
		throw new ApiQueryError(
			'QUERY_NESTING_LIMIT_EXCEEDED',
			`"${key}" is nested ${depth + 1} levels deep; at most ${API_QUERY_LIMITS.filterNestingLevels} are allowed.`,
			{ limit: API_QUERY_LIMITS.filterNestingLevels, actual: depth + 1 }
		);
	}

	// `filter[$or][0][status][eq]=A` arrives as an array of filter objects. A single object is
	// accepted too, because a one-element disjunction is a shape clients produce by accident and
	// refusing it would be pedantry rather than safety.
	const members = Array.isArray(rawGroup) ? rawGroup : [rawGroup];
	if (members.length > API_QUERY_LIMITS.filterGroupSize) {
		throw new ApiQueryError(
			'QUERY_NESTING_LIMIT_EXCEEDED',
			`"${key}" carries ${members.length} members; at most ${API_QUERY_LIMITS.filterGroupSize} are allowed.`,
			{ limit: API_QUERY_LIMITS.filterGroupSize, actual: members.length }
		);
	}

	const children = members.map((member) => {
		if (!isPlainObject(member)) {
			throw new ApiQueryError('VALIDATION_FAILED', `Every member of "${key}" must be a filter object.`);
		}
		return parseFilterObject(member, schema, depth + 1);
	});

	return { kind: key === '$and' ? 'and' : 'or', children };
}

/** Parses one filter object, one level of the tree. */
function parseFilterObject(raw: Record<string, unknown>, schema: ApiQuerySchema | undefined, depth: number): FilterNode {
	const keys = Object.keys(raw).filter((key) => raw[key] !== null && raw[key] !== undefined);
	if (keys.length > API_QUERY_LIMITS.filterTopLevelKeys) {
		throw new ApiQueryError(
			'QUERY_NESTING_LIMIT_EXCEEDED',
			`The filter carries ${keys.length} keys; at most ${API_QUERY_LIMITS.filterTopLevelKeys} are allowed.`,
			{ limit: API_QUERY_LIMITS.filterTopLevelKeys, actual: keys.length }
		);
	}

	const conditions: FilterNode[] = [];
	for (const key of keys) {
		if ((GROUP_KEYS as readonly string[]).includes(key)) {
			conditions.push(parseGroup(key as GroupKey, raw[key], schema, depth));
			continue;
		}
		// The path's depth is checked before the allow-list. A path of three segments is malformed
		// whatever the resource declares — a schema cannot even name one — so reporting it as an
		// unknown field would send the caller looking for a field name instead of a wrong query shape.
		const segments = parsePath(key);
		const kind = assertFilterable(key, schema);
		conditions.push(...parseConditionObject(segments, key, raw[key], kind));
	}

	if (conditions.length === 0) {
		return { kind: 'and', children: [] };
	}
	if (conditions.length === 1) {
		return conditions[0];
	}
	// Top-level conditions are AND-ed; a group stays a group so the translator can see that the
	// caller asked for a disjunction rather than a conjunction of siblings.
	return { kind: 'and', children: conditions };
}

/**
 * Reads the raw filter value a caller sent.
 *
 * @param raw The parsed `filter` value, or a JSON string carrying one.
 * @returns The object to parse, or `undefined` when the caller sent nothing usable.
 */
function toFilterObject(raw: unknown): Record<string, unknown> | undefined {
	if (raw === undefined || raw === null || raw === '') {
		return undefined;
	}
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			return isPlainObject(parsed) ? parsed : undefined;
		} catch {
			throw new ApiQueryError('VALIDATION_FAILED', 'The filter parameter is not valid JSON.');
		}
	}
	if (isPlainObject(raw)) {
		return raw;
	}
	throw new ApiQueryError('VALIDATION_FAILED', 'The filter parameter must be an object.');
}

/**
 * Checks the structural caps of a raw filter before it is parsed.
 *
 * The parser enforces the same caps as it walks, so this pass is not what makes a query safe — it
 * exists so that a caller can be told the shape of its query is too large without a tree being
 * built first, and so the caps have one documented entry point.
 *
 * @param raw The parsed `filter` value.
 * @param schema The resource's declaration, when it has one.
 * @throws ApiQueryError When a cap is exceeded.
 */
export function validateFilterLimits(raw: unknown, schema?: ApiQuerySchema): void {
	const filter = toFilterObject(raw);
	if (!filter) {
		return;
	}
	parseFilterObject(filter, schema, 0);
}

/**
 * Compiles a filter into a node tree.
 *
 * @param raw The parsed `filter` value — the nested object the query-string parser produced, a
 *   JSON string carrying the same, or `undefined` when the caller filtered on nothing.
 * @param schema The resource's declaration. Without one every field and operator is accepted,
 *   which is what a route that has not adopted the protocol yet must keep doing.
 * @returns The filter tree, or `undefined` when there is no filter.
 * @throws ApiQueryError With the catalogue code for the violation.
 */
export function parseFilter(raw: unknown, schema?: ApiQuerySchema): FilterNode | undefined {
	const filter = toFilterObject(raw);
	if (!filter) {
		return undefined;
	}
	return parseFilterObject(filter, schema, 0);
}
