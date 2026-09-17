import {
	API_QUERY_LIMITS,
	ApiQuery,
	ApiQueryContext,
	ApiQueryError,
	FilterNode,
	PageRequest,
	SortKey,
	resolveMaxPageSize,
	resolveDefaultPageSize
} from './query-ast';
import { parseFilter } from './filter-parser';
import { parseSortFromLegacyOrder } from './sort-parser';
import { flattenSelectObject } from './field-selection';
import type { ApiQuerySchema } from './query-schema';

/**
 * The legacy `?data=` parameter, mapped onto the query protocol.
 *
 * Callers have sent `?data={"relations":[…],"findInput":{…}}` — and its
 * `{"where":{…},"relations":[…]}` variant — for as long as the API has existed. The parameter is
 * not being removed and it is not being kept as a second query implementation either: it is
 * translated here, once, into exactly the {@link ApiQuery} a caller would have got by writing the
 * new grammar by hand. Downstream there is one query, whichever door it came through.
 *
 * The translations are deliberately forgiving wherever forgiving cannot change a result:
 *
 * - a relation the resource does not allow expanding is dropped and named in a response header,
 *   because a caller that has been asking for it for years must not start receiving an error;
 * - an order key the resource does not allow is dropped for the same reason;
 * - a `where` entry the resource does not declare filterable is dropped and named, because
 *   refusing it would break exactly the callers the alias exists for. The header is the migration
 *   notice — silence would be the only unacceptable outcome;
 * - a `where` *shape* the grammar cannot express is refused, because guessing at it would change
 *   which rows the caller gets.
 *
 * A legacy payload also carries a tenant and an organization. Those are compared with the scope
 * the guard chain resolved, never trusted: the request is refused when they disagree, and ignored
 * when they agree, which is what makes the alias no weaker than the new grammar.
 */

/** The response header every `?data=` response carries. */
export const DEPRECATED_PARAM_HEADER = 'X-Deprecated-Param';

/** The response header naming a legacy relation that was dropped. */
export const DEPRECATED_RELATION_HEADER = 'X-Deprecated-Relation';

/** The response header naming a legacy field that was dropped. */
export const DEPRECATED_FIELD_HEADER = 'X-Deprecated-Field';

/** The name of the legacy parameter itself. */
export const LEGACY_DATA_PARAM = 'data';

/** The property a request carries its recorded deprecation notices under. */
const DEPRECATION_NOTICES_PROPERTY = 'apiQueryDeprecationNotices';

/** The operators a legacy `where` clause may spell with a `$` prefix. */
const LEGACY_OPERATORS: Readonly<Record<string, string>> = {
	$eq: 'eq',
	$ne: 'ne',
	$in: 'in',
	$nin: 'nin',
	$notin: 'nin',
	$like: 'like',
	$ilike: 'ilike',
	$gt: 'gt',
	$gte: 'gte',
	$lt: 'lt',
	$lte: 'lte',
	$between: 'between',
	$isnull: 'isNull',
	$contains: 'contains'
};

/** The keys a legacy payload may carry, once normalised. */
interface LegacyFindInput {
	where?: Record<string, unknown>;
	order?: unknown;
	take?: unknown;
	skip?: unknown;
	relations?: unknown;
	select?: unknown;
	withDeleted?: unknown;
	tenantId?: unknown;
	organizationId?: unknown;
}

/** The scope the guard chain resolved for the request. */
export interface ApiLegacyScope {
	readonly tenantId?: string | null;
	readonly organizationId?: string | null;
}

/** Everything the adapter needs beyond the payload itself. */
export interface ApiLegacyDataOptions {
	/** The resource's declaration. Without one no allow-list is applied. */
	readonly schema?: ApiQuerySchema;
	/** The concept root word, when the caller knows it independently of the schema. */
	readonly resource?: string;
	/** The scope the guard chain resolved. */
	readonly scope?: ApiLegacyScope;
	/** The `page[limit]` the caller also sent; the alias lets it win over `findInput.take`. */
	readonly pageLimit?: number;
	/** The request-scoped overrides, forwarded as they are on the new grammar. */
	readonly context?: ApiQueryContext;
}

/** What the alias produced, and what it had to leave out. */
export interface ApiLegacyDataResult {
	/** The query, indistinguishable from one written in the new grammar. */
	readonly query: ApiQuery;
	/** Relations the payload asked for that the resource does not expand. */
	readonly droppedRelations: readonly string[];
	/** Fields the payload filtered or selected on that the resource does not declare. */
	readonly droppedFields: readonly string[];
}

/**
 * The protocol parameters the alias refuses to be combined with.
 *
 * `page[limit]` is the one exception: a caller migrating a page size is doing the right thing, and
 * the new value wins over the legacy `take`.
 */
const CONFLICTING_PARAMETERS: readonly string[] = [
	'filter',
	'sort',
	'fields',
	'expand',
	'q',
	'withDeleted',
	'page[number]',
	'page[after]',
	'page[before]'
];

/** Whether a value is a plain object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
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

/** Reads a positive integer, or `undefined` when the value is not one. */
function toPositiveInteger(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return undefined;
	}
	return Math.floor(parsed);
}

/**
 * Normalises the payload's two historical shapes into one.
 *
 * @param data The raw `data` value: the object form, or a JSON string carrying one.
 * @returns The find input to translate.
 */
function toFindInput(data: unknown): LegacyFindInput {
	let payload = data;
	if (typeof payload === 'string') {
		try {
			payload = JSON.parse(payload);
		} catch {
			throw new ApiQueryError('QUERY_LEGACY_DATA_PARAM_INVALID', 'The data parameter is not valid JSON.');
		}
	}
	if (!isPlainObject(payload)) {
		throw new ApiQueryError('QUERY_LEGACY_DATA_PARAM_INVALID', 'The data parameter must be an object.');
	}

	const nested = isPlainObject(payload.findInput) ? payload.findInput : {};
	// The `{"where":…,"relations":[…]}` variant puts the same keys one level up. Merging keeps one
	// translation path instead of two that drift.
	const merged: LegacyFindInput = { ...(payload as LegacyFindInput), ...nested };
	if (payload.where !== undefined && nested.where === undefined) {
		merged.where = payload.where as Record<string, unknown>;
	}
	return merged;
}

/**
 * Translates a legacy `where` clause into the protocol's raw filter object.
 *
 * @param where The legacy clause.
 * @param dropped Collects the names of entries the resource does not declare, so the caller can be
 *   told rather than left guessing.
 * @param schema The resource's declaration.
 * @returns The raw filter object the filter parser consumes, or `undefined` when nothing is left.
 */
function whereToRawFilter(
	where: unknown,
	dropped: string[],
	schema?: ApiQuerySchema
): Record<string, unknown> | undefined {
	if (where === undefined || where === null) {
		return undefined;
	}
	if (!isPlainObject(where)) {
		throw new ApiQueryError('QUERY_LEGACY_DATA_PARAM_INVALID', 'The where clause of the data parameter must be an object.');
	}

	const raw: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(where)) {
		if (value === null || value === undefined) {
			continue;
		}

		// A relation's own condition is one level deep. Anything deeper is a shape the protocol
		// does not express, and pretending otherwise would silently drop half the condition.
		if (isPlainObject(value) && !Object.keys(value).some((entry) => entry.startsWith('$'))) {
			for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
				if (isPlainObject(nestedValue)) {
					throw new ApiQueryError(
						'QUERY_LEGACY_DATA_PARAM_INVALID',
						`The where clause nests "${key}.${nestedKey}" deeper than the query protocol allows.`,
						{ path: `${key}.${nestedKey}` }
					);
				}
				raw[`${key}.${nestedKey}`] = { eq: nestedValue };
			}
			continue;
		}

		if (isPlainObject(value)) {
			const operators: Record<string, unknown> = {};
			for (const [rawOperator, operatorValue] of Object.entries(value as Record<string, unknown>)) {
				const operator = LEGACY_OPERATORS[rawOperator.toLowerCase()];
				if (!operator) {
					throw new ApiQueryError(
						'QUERY_LEGACY_DATA_PARAM_INVALID',
						`"${rawOperator}" is not an operator the query protocol understands.`,
						{ field: key, operator: rawOperator, allowed: Object.values(LEGACY_OPERATORS) }
					);
				}
				operators[operator] = operatorValue;
			}
			raw[key] = operators;
			continue;
		}

		// A scalar, an array or a date: the shapes a legacy clause has always used for equality and
		// membership.
		raw[key] = Array.isArray(value) ? { in: value } : { eq: value };
	}

	if (!schema?.filterable) {
		return Object.keys(raw).length > 0 ? raw : undefined;
	}

	const allowed: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(raw)) {
		if (schema.filterable.includes(key)) {
			allowed[key] = value;
			continue;
		}
		dropped.push(key);
	}
	return Object.keys(allowed).length > 0 ? allowed : undefined;
}

/**
 * Reads the tenant and organization a legacy payload claims.
 *
 * @param findInput The normalised find input.
 * @returns The claimed scope, with only the keys the payload actually carried.
 */
function claimedScope(findInput: LegacyFindInput): ApiLegacyScope {
	const where = isPlainObject(findInput.where) ? findInput.where : {};
	const tenantId = findInput.tenantId ?? where.tenantId;
	const organizationId = findInput.organizationId ?? where.organizationId;
	return {
		tenantId: typeof tenantId === 'string' ? tenantId : undefined,
		organizationId: typeof organizationId === 'string' ? organizationId : undefined
	};
}

/**
 * Translates the legacy parameter.
 *
 * The adapter is a class because it is constructed per route with the resource's declaration
 * already resolved, exactly like the pipe that owns it; every translation inside is a pure
 * function of the payload and those options.
 */
export class ApiLegacyDataAdapter {
	constructor(private readonly options: ApiLegacyDataOptions = {}) {}

	/**
	 * Refuses a payload that mixes the alias with the new grammar.
	 *
	 * @param parameters The protocol parameters the request carried.
	 * @throws ApiQueryError `QUERY_LEGACY_DATA_PARAM_CONFLICT` when one of them cannot be combined
	 *   with `data`.
	 */
	static assertNoConflict(parameters: readonly string[]): void {
		const conflicting = parameters.filter((parameter) => CONFLICTING_PARAMETERS.includes(parameter));
		if (conflicting.length > 0) {
			throw new ApiQueryError(
				'QUERY_LEGACY_DATA_PARAM_CONFLICT',
				`The data parameter cannot be combined with ${conflicting.join(', ')}.`,
				{ parameters: conflicting, allowed: ['page[limit]'] }
			);
		}
	}

	/**
	 * Translates one payload.
	 *
	 * @param data The raw `data` value.
	 * @returns The query the payload means, and what the resource refused to apply.
	 * @throws ApiQueryError `QUERY_LEGACY_DATA_PARAM_INVALID` for a shape the grammar cannot
	 *   express, or `TENANT_MISMATCH` when the payload claims another scope.
	 */
	toApiQuery(data: unknown): ApiLegacyDataResult {
		const { schema, scope, pageLimit } = this.options;
		const findInput = toFindInput(data);
		const droppedFields: string[] = [];
		const droppedRelations: string[] = [];

		// Scope first: a payload that names somebody else's tenant is refused before any of it is
		// translated, so nothing downstream has to remember to check.
		const claimed = claimedScope(findInput);
		if (scope?.tenantId && claimed.tenantId && claimed.tenantId !== scope.tenantId) {
			throw new ApiQueryError('TENANT_MISMATCH', 'The data parameter names a tenant the request is not scoped to.', {
				claimed: claimed.tenantId
			});
		}
		if (scope?.organizationId && claimed.organizationId && claimed.organizationId !== scope.organizationId) {
			throw new ApiQueryError('TENANT_MISMATCH', 'The data parameter names an organization the request is not scoped to.', {
				claimed: claimed.organizationId
			});
		}

		const filter = this.toFilter(findInput, claimed, droppedFields);
		const sort = parseSortFromLegacyOrder(findInput.order, schema);
		const page = this.toPage(findInput, pageLimit);
		const expand = this.toExpand(findInput.relations, droppedRelations);
		const fields = this.toFields(findInput.select, droppedFields);

		const query: ApiQuery = {
			resource: this.options.resource ?? schema?.resource ?? 'unknown',
			filter,
			sort,
			page,
			fields,
			expand,
			q: undefined,
			withDeleted: toBoolean(findInput.withDeleted),
			context: this.options.context ?? {},
			legacy: true
		};

		return { query, droppedRelations, droppedFields };
	}

	/** Builds the filter, leaving the scope keys out of it. */
	private toFilter(
		findInput: LegacyFindInput,
		claimed: ApiLegacyScope,
		dropped: string[]
	): FilterNode | undefined {
		const where = isPlainObject(findInput.where) ? { ...findInput.where } : undefined;
		if (!where) {
			return undefined;
		}
		// The scope keys belong to the guard chain, not to the filter: they are compared above and
		// never turned into a condition of their own.
		for (const key of ['tenantId', 'organizationId']) {
			if (claimed[key as 'tenantId' | 'organizationId']) {
				delete where[key];
			}
		}
		return parseFilter(whereToRawFilter(where, dropped, this.options.schema), this.options.schema);
	}

	/** Builds the page request, keeping the legacy one-based page number. */
	private toPage(findInput: LegacyFindInput, pageLimit?: number): PageRequest {
		const ceiling = resolveMaxPageSize(this.options.schema?.maxPageSize);
		const legacyTake = toPositiveInteger(findInput.take);
		const requestedLimit = toPositiveInteger(pageLimit);

		// `page[limit]` wins when both are present; the legacy default of ten rows applies only when
		// neither is, which is what makes the alias return exactly what it returned before.
		const limit = Math.min(
			requestedLimit ?? legacyTake ?? resolveDefaultPageSize(API_QUERY_LIMITS.legacyDefaultPageSize, ceiling),
			ceiling
		);

		const skip = toPositiveInteger(findInput.skip);
		// `skip` is one-based on this platform and stays one-based through the alias; `skip: 0` has
		// always meant the first page, not a zero-th one.
		const number = skip ?? 1;
		if (number > API_QUERY_LIMITS.maxPageNumber) {
			throw new ApiQueryError(
				'QUERY_PAGE_LIMIT_EXCEEDED',
				`Page ${number} is beyond the highest page an offset query may ask for.`,
				{ limit: API_QUERY_LIMITS.maxPageNumber, actual: number }
			);
		}

		return { mode: 'OFFSET', number, limit };
	}

	/** Keeps the legacy relations the resource allows expanding. */
	private toExpand(relations: unknown, dropped: string[]): string[] {
		if (relations === undefined || relations === null) {
			return [];
		}
		const list = Array.isArray(relations) ? relations : Object.keys(relations as Record<string, unknown>);
		const paths = list
			.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
			.slice(0, API_QUERY_LIMITS.expandPaths);

		const allowed = this.options.schema?.expandable;
		if (!allowed) {
			return Array.from(new Set(paths));
		}
		const kept: string[] = [];
		for (const path of paths) {
			if (allowed.includes(path)) {
				kept.push(path);
			} else {
				dropped.push(path);
			}
		}
		return Array.from(new Set(kept));
	}

	/** Flattens the legacy select object and keeps the paths the resource allows selecting. */
	private toFields(select: unknown, dropped: string[]): ApiQuery['fields'] {
		if (select === undefined || select === null) {
			return undefined;
		}
		const paths = (isPlainObject(select) ? flattenSelectObject(select) : Array.isArray(select) ? select : [])
			.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
			.slice(0, API_QUERY_LIMITS.fieldPaths);

		const allowed = this.options.schema?.selectable;
		const kept = allowed ? paths.filter((path) => allowed.includes(path)) : paths;
		for (const path of paths) {
			if (!kept.includes(path)) {
				dropped.push(path);
			}
		}
		return kept.length > 0 ? { paths: Array.from(new Set(kept)) } : undefined;
	}
}

/** A request that deprecation notices have been recorded on. */
type NoticeCarrier = Record<string, unknown>;

/**
 * Records a deprecation notice on the request.
 *
 * The pipe records, the interceptor writes. Keeping the two apart is what lets the notice be
 * recorded even when the response is produced by an exception filter, and it keeps the pipe free
 * of any dependency on the response object.
 *
 * @param request The request to record on. A missing request is ignored, so the pipe stays usable
 *   outside a request (a unit test, a script).
 * @param header The response header the notice will be written to.
 * @param value The value to add to that header.
 */
export function recordDeprecationNotice(request: unknown, header: string, value: string): void {
	if (!request || typeof request !== 'object') {
		return;
	}
	const carrier = request as NoticeCarrier;
	const notices = (carrier[DEPRECATION_NOTICES_PROPERTY] as Record<string, string[]> | undefined) ?? {};
	const values = notices[header] ?? [];
	if (!values.includes(value)) {
		values.push(value);
	}
	notices[header] = values;
	carrier[DEPRECATION_NOTICES_PROPERTY] = notices;
}

/**
 * Reads the deprecation notices recorded on a request.
 *
 * @param request The request to read.
 * @returns The headers to write, each with the values recorded for it. Empty when nothing was
 *   recorded.
 */
export function readDeprecationNotices(request: unknown): Record<string, string[]> {
	if (!request || typeof request !== 'object') {
		return {};
	}
	const notices = (request as NoticeCarrier)[DEPRECATION_NOTICES_PROPERTY];
	return isPlainObject(notices) ? (notices as Record<string, string[]>) : {};
}
