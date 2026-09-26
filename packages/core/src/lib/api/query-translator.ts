import {
	Between,
	Equal,
	ILike,
	In,
	IsNull,
	JsonContains,
	LessThan,
	LessThanOrEqual,
	Like,
	MoreThan,
	MoreThanOrEqual,
	Not
} from 'typeorm';
import {
	API_QUERY_LIMITS,
	ApiQuery,
	ApiQueryError,
	FieldSelection,
	FilterNode,
	FilterOperator,
	SortKey
} from './query-ast';
import type { CursorPayload } from './cursor';
import type { ApiQuerySchema } from './query-schema';
import { toSkip } from './query-parser';

/**
 * The one place a query becomes storage options.
 *
 * The parsers decide what a caller asked for; this module decides what that means to the engines.
 * Both ORMs are served from here, from the same filter tree, so a filter cannot mean one thing on
 * TypeORM and another on MikroORM — which is exactly the defect the platform carries today, where
 * the same `skip` is a page number on one branch and an offset on the other.
 *
 * Three decisions are load-bearing:
 *
 * 1. **The offset is computed here.** `page[number]` becomes `skip = (number − 1) × limit` before
 *    either engine sees it, so the historical `take × (skip − 1)` arithmetic in the list service is
 *    no longer where the semantics live, and a route that adopted the protocol cannot inherit the
 *    divergence.
 * 2. **A null test is never a bare `null`.** `isNull` becomes the engine's own null operator in both
 *    directions, because a bare `null` in a where clause was dropped by one driver version and read
 *    as `IS NULL` by the next — the ambiguity the platform closed deliberately.
 * 3. **A group is distributed for TypeORM and kept as a group for MikroORM.** TypeORM reads a
 *    disjunction as a list of conjunctions and has no cross-column boolean tree, so the filter is
 *    normalised into that shape; MikroORM understands the tree, so it is handed the tree. The
 *    distribution is bounded, so many groups cannot turn one query into a large one.
 */

/** The storage options a list read needs, in the shape the TypeORM branch consumes. */
export interface ApiFindOptions {
	/** The compiled filter, ready for `find` / `findAndCount`. */
	where?: Record<string, unknown> | Array<Record<string, unknown>>;
	/** The ordering, in the effective sort's key order. */
	order: Record<string, unknown>;
	/** The sparse fieldset, when the caller asked for one. */
	select?: Record<string, unknown>;
	/** The relations to load, as the nested object the engine expects. */
	relations: Record<string, unknown>;
	/** The rows to skip: `(number − 1) × limit`, or zero for a cursor page. */
	skip: number;
	/** The page size. */
	take: number;
	/** Whether soft-deleted rows are included. */
	withDeleted: boolean;
}

/**
 * The same read, in the shape the MikroORM branch consumes.
 *
 * `withDeleted` is carried as a flag rather than translated: soft deletes are expressed by this
 * platform's own filter on that engine, and inventing a find-option key for it here would guess at
 * something the repository pair already decides.
 */
export interface ApiMikroOrmFindOptions {
	where?: Record<string, unknown>;
	orderBy: Record<string, unknown>;
	populate: string[];
	fields?: string[];
	offset: number;
	limit: number;
	withDeleted: boolean;
}

/** The value a containment test takes: a JSON document or an array, never a scalar. */
type ContainmentOperand = readonly unknown[] | Record<string | number | symbol, unknown>;

/**
 * Whether a filter value is the shape a containment test is defined over.
 *
 * A `Date` is excluded on purpose: it is an object to `typeof`, but it is not a JSON document, and
 * passing one on would reach the engine as something its containment operator cannot take.
 */
function isContainmentOperand(value: unknown): value is ContainmentOperand {
	if (Array.isArray(value)) {
		return true;
	}
	return !!value && typeof value === 'object' && !(value instanceof Date);
}

/**
 * The error a containment filter whose operand is not a document is refused with.
 *
 * Both engines read this filter through {@link isContainmentOperand}, so the refusal is written once
 * and the two translations cannot answer the same filter differently.
 */
function invalidContainmentOperand(value: unknown): ApiQueryError {
	return new ApiQueryError(
		'VALIDATION_FAILED',
		`The "contains" filter takes a JSON document or an array, not a ${value === null ? 'null' : typeof value}.`,
		{ operator: 'contains' }
	);
}

/** One condition, translated for TypeORM. */
function typeOrmCondition(op: FilterOperator, value: unknown, negate: boolean): unknown {
	switch (op) {
		case 'eq':
			return negate ? Not(Equal(value)) : Equal(value);
		case 'ne':
			return negate ? Equal(value) : Not(Equal(value));
		case 'in':
			return negate ? Not(In(value as unknown[])) : In(value as unknown[]);
		case 'nin':
			return negate ? In(value as unknown[]) : Not(In(value as unknown[]));
		case 'isNull': {
			// Written as its own operator in both directions: "not null" is not the negation of a
			// comparison, it is a null test with the opposite answer, and the two differ for NULL rows.
			const wantsNull = (value === true) !== negate;
			return wantsNull ? IsNull() : Not(IsNull());
		}
		case 'like':
			return negate ? Not(Like(String(value))) : Like(String(value));
		case 'ilike':
			return negate ? Not(ILike(String(value))) : ILike(String(value));
		case 'gt':
			return negate ? Not(MoreThan(value)) : MoreThan(value);
		case 'gte':
			return negate ? Not(MoreThanOrEqual(value)) : MoreThanOrEqual(value);
		case 'lt':
			return negate ? Not(LessThan(value)) : LessThan(value);
		case 'lte':
			return negate ? Not(LessThanOrEqual(value)) : LessThanOrEqual(value);
		case 'between': {
			const bounds = value as readonly [unknown, unknown];
			return negate ? Not(Between(bounds[0], bounds[1])) : Between(bounds[0], bounds[1]);
		}
		case 'contains': {
			// Containment is defined over a document, not over a scalar: both engines translate it to
			// their storage's containment operator, which takes a JSON value or an array. A scalar
			// operand therefore has no translation, and is refused here with the protocol's own error
			// rather than handed to the engine to fail on.
			if (!isContainmentOperand(value)) {
				throw invalidContainmentOperand(value);
			}
			return negate ? Not(JsonContains(value)) : JsonContains(value);
		}
		default:
			throw new ApiQueryError('QUERY_UNSUPPORTED_OPERATOR', `The operator "${String(op)}" has no translation.`, {
				operator: String(op)
			});
	}
}

/** Assigns a value at a dotted path, creating the intermediate objects. */
function setPath(target: Record<string, unknown>, path: readonly string[], value: unknown): Record<string, unknown> {
	let node = target;
	for (let index = 0; index < path.length - 1; index += 1) {
		const segment = path[index];
		const next = node[segment];
		if (!next || typeof next !== 'object') {
			node[segment] = {};
		}
		node = node[segment] as Record<string, unknown>;
	}
	const last = path[path.length - 1];
	const existing = node[last];
	// Two conditions on the same relation share one relation object; two conditions on the same field
	// cannot, and silently keeping one of them would drop half the filter.
	if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
		Object.assign(existing as Record<string, unknown>, value as Record<string, unknown>);
		return target;
	}
	node[last] = value;
	return target;
}

/** Merges the right conjunction into the left one. */
function mergeConjunctions(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
	const merged: Record<string, unknown> = { ...left };
	for (const [key, value] of Object.entries(right)) {
		setPath(merged, [key], value);
	}
	return merged;
}

/** The error a filter that distributes too far is refused with. */
function disjunctionLimitExceeded(): ApiQueryError {
	return new ApiQueryError(
		'QUERY_NESTING_LIMIT_EXCEEDED',
		`The filter expands to more than ${API_QUERY_LIMITS.filterDisjunctions} conjunctions.`,
		{ limit: API_QUERY_LIMITS.filterDisjunctions }
	);
}

/**
 * Distributes a filter into the list-of-conjunctions shape TypeORM reads as a disjunction.
 *
 * @param node The filter node.
 * @param negate Whether this node is reached under an odd number of negations.
 * @returns One entry per conjunction; a single entry for a filter without disjunctions.
 * @throws ApiQueryError `QUERY_NESTING_LIMIT_EXCEEDED` when distribution exceeds its bound.
 */
function toTypeOrmAlternatives(node: FilterNode, negate: boolean): Array<Record<string, unknown>> {
	if (node.kind === 'condition') {
		return [setPath({}, node.path, typeOrmCondition(node.op, node.value, negate))];
	}

	// De Morgan: negating a group flips the connective and negates each member. This is the only
	// place a negation is interpreted, so a caller cannot smuggle in a reading the grammar lacks.
	const flipped = negate !== (node.negated === true);
	const connective = flipped ? (node.kind === 'and' ? 'or' : 'and') : node.kind;
	const childNegate = flipped;

	if (connective === 'or') {
		const alternatives: Array<Record<string, unknown>> = [];
		for (const child of node.children) {
			const childAlternatives = toTypeOrmAlternatives(child, childNegate);
			if (alternatives.length + childAlternatives.length > API_QUERY_LIMITS.filterDisjunctions) {
				throw disjunctionLimitExceeded();
			}
			alternatives.push(...childAlternatives);
		}
		return alternatives;
	}

	let alternatives: Array<Record<string, unknown>> = [{}];
	for (const child of node.children) {
		const childAlternatives = toTypeOrmAlternatives(child, childNegate);
		if (alternatives.length * childAlternatives.length > API_QUERY_LIMITS.filterDisjunctions) {
			throw disjunctionLimitExceeded();
		}
		const distributed: Array<Record<string, unknown>> = [];
		for (const left of alternatives) {
			for (const right of childAlternatives) {
				distributed.push(mergeConjunctions(left, right));
			}
		}
		alternatives = distributed;
	}
	return alternatives;
}

/**
 * Compiles a filter into the where clause TypeORM reads.
 *
 * @param filter The filter tree, or `undefined` when the caller filtered on nothing.
 * @returns A single object for a filter without disjunctions, a list of conjunctions otherwise, or
 *   `undefined` when there is no filter to apply.
 */
export function toWhereClause(
	filter?: FilterNode
): Record<string, unknown> | Array<Record<string, unknown>> | undefined {
	if (!filter) {
		return undefined;
	}
	const alternatives = toTypeOrmAlternatives(filter, false);
	// An empty conjunction means "no condition", which is what a group with nothing in it means.
	const meaningful = alternatives.filter((alternative) => Object.keys(alternative).length > 0);
	if (meaningful.length === 0) {
		return undefined;
	}
	return meaningful.length === 1 ? meaningful[0] : meaningful;
}

/**
 * The MikroORM spelling of the operators the engine has.
 *
 * `between` and `isNull` are absent because that engine has no such operator: they are expressed as
 * a two-sided range and as equality with null, which {@link mikroOrmCondition} writes out.
 */
const MIKRO_ORM_OPERATOR: Partial<Record<FilterOperator, string>> = {
	eq: '$eq',
	ne: '$ne',
	in: '$in',
	nin: '$nin',
	like: '$like',
	ilike: '$ilike',
	gt: '$gt',
	gte: '$gte',
	lt: '$lt',
	lte: '$lte',
	contains: '$contains'
};

/** One condition, translated for MikroORM. */
function mikroOrmCondition(op: FilterOperator, value: unknown, negate: boolean): Record<string, unknown> {
	if (op === 'isNull') {
		// The engine spells a null test as equality with null, in both directions — which is why it is
		// written out rather than left to the generic mapping.
		return (value === true) !== negate ? { $eq: null } : { $ne: null };
	}
	if (op === 'between') {
		const bounds = value as readonly [unknown, unknown];
		const range = { $gte: bounds[0], $lte: bounds[1] };
		return negate ? { $not: range } : range;
	}
	if (op === 'eq' || op === 'ne' || op === 'in' || op === 'nin') {
		const flipped = negate ? (op === 'eq' ? 'ne' : op === 'ne' ? 'eq' : op === 'in' ? 'nin' : 'in') : op;
		return { [MIKRO_ORM_OPERATOR[flipped] as string]: value };
	}
	if (op === 'contains') {
		// The operand rule of the TypeORM branch, applied here too: this engine spells containment as
		// an array operator just as that one does, and one filter may not be refused by one branch and
		// accepted by the other.
		if (!isContainmentOperand(value)) {
			throw invalidContainmentOperand(value);
		}
		const containment = { [MIKRO_ORM_OPERATOR.contains as string]: value };
		return negate ? { $not: containment } : containment;
	}
	const mapped = { [MIKRO_ORM_OPERATOR[op] as string]: value };
	return negate ? { $not: mapped } : mapped;
}

/**
 * Compiles a filter into the where clause MikroORM reads.
 *
 * The tree is passed through rather than distributed: that engine understands `$and` and `$or`
 * across columns, so there is no reason to expand a query into a shape with more parts than the
 * caller wrote.
 *
 * @param filter The filter tree, or `undefined` when the caller filtered on nothing.
 * @returns The where clause, or `undefined` when there is no filter to apply.
 */
export function toMikroOrmWhere(filter?: FilterNode): Record<string, unknown> | undefined {
	if (!filter) {
		return undefined;
	}
	const build = (node: FilterNode, negate: boolean): Record<string, unknown> | undefined => {
		if (node.kind === 'condition') {
			return setPath({}, node.path, mikroOrmCondition(node.op, node.value, negate));
		}
		const flipped = negate !== (node.negated === true);
		const sameKind = node.kind === 'and';
		const connective = flipped === sameKind ? '$or' : '$and';
		const children = node.children
			.map((child) => build(child, flipped))
			.filter((child): child is Record<string, unknown> => !!child && Object.keys(child).length > 0);
		if (children.length === 0) {
			return undefined;
		}
		if (children.length === 1) {
			return children[0];
		}
		return { [connective]: children };
	};

	const where = build(filter, false);
	return where && Object.keys(where).length > 0 ? where : undefined;
}

/** Builds the nested relation object the engines expect from a list of dotted paths. */
function toRelationsObject(paths: readonly string[]): Record<string, unknown> {
	const relations: Record<string, unknown> = {};
	for (const path of paths) {
		setPath(relations, path.split('.').filter((segment) => segment.length > 0), true);
	}
	return relations;
}

/** Builds the nested select object from a sparse fieldset. */
function toSelectObject(selection?: FieldSelection): Record<string, unknown> | undefined {
	if (!selection || selection.paths.length === 0) {
		return undefined;
	}
	const select: Record<string, unknown> = {};
	for (const path of selection.paths) {
		setPath(select, path.split('.').filter((segment) => segment.length > 0), true);
	}
	return select;
}

/** Builds the ordering object, nesting a relation path the way the engines expect it. */
function toOrderObject(sort: readonly SortKey[]): Record<string, unknown> {
	const order: Record<string, unknown> = {};
	for (const key of sort) {
		setPath(order, key.field.split('.').filter((segment) => segment.length > 0), key.direction);
	}
	return order;
}

/**
 * Compiles a normalised query into the options a TypeORM read takes.
 *
 * @param query The query, as the protocol pipeline produced it.
 * @param schema The resource's declaration, when the caller has it. Both builders accept it so a
 *   call site can switch between them without changing its arguments.
 * @returns The options.
 */
export function toFindManyOptions(query: ApiQuery, schema?: ApiQuerySchema): ApiFindOptions {
	void schema;
	return {
		where: toWhereClause(query.filter),
		order: toOrderObject(query.sort),
		select: toSelectObject(query.fields),
		relations: toRelationsObject(query.expand),
		skip: toSkip(query),
		take: query.page.limit,
		withDeleted: query.withDeleted
	};
}

/**
 * Compiles a normalised query into the options a MikroORM read takes.
 *
 * @param query The query, as the protocol pipeline produced it.
 * @param schema The resource's declaration, when the caller has it.
 * @returns The options.
 */
export function toMikroOrmFindOptions(query: ApiQuery, schema?: ApiQuerySchema): ApiMikroOrmFindOptions {
	void schema;
	return {
		where: toMikroOrmWhere(query.filter),
		orderBy: toOrderObject(query.sort),
		populate: [...query.expand],
		fields: query.fields ? [...query.fields.paths] : undefined,
		offset: toSkip(query),
		limit: query.page.limit,
		withDeleted: query.withDeleted
	};
}

/**
 * Turns a cursor into the condition that resumes after it.
 *
 * A cursor points at a row by its sort value and its id, and resuming means "everything after that
 * pair in this order". The comparison is written as the tuple it is — the leading key greater, or
 * the leading key equal and the id greater — because comparing the sort value alone would skip or
 * repeat every row that shares it. That is also why a resource whose default sort can be duplicated
 * needs its id in the last key.
 *
 * A backward page is the same condition read under the reversed sort, which is why the direction
 * argument is the cursor's own: the caller reverses the ordering, not this condition.
 *
 * @param payload The decoded cursor.
 * @param sort The effective sort the cursor was minted under.
 * @returns A filter node to be AND-ed with the caller's own filter.
 * @throws ApiQueryError `QUERY_CURSOR_INVALID` when the sort cannot resume a cursor.
 */
export function cursorToFilterNode(payload: CursorPayload, sort: readonly SortKey[]): FilterNode {
	if (!sort || sort.length === 0) {
		throw new ApiQueryError('QUERY_CURSOR_INVALID', 'A cursor cannot resume a query with no sort order.');
	}

	const leading = sort[0];
	const beyond: FilterNode = {
		kind: 'condition',
		path: [leading.field],
		op: leading.direction === 'DESC' ? 'lt' : 'gt',
		value: payload.sortValue
	};
	const sameValue: FilterNode = {
		kind: 'condition',
		path: [leading.field],
		op: 'eq',
		value: payload.sortValue
	};
	const beyondId: FilterNode = { kind: 'condition', path: ['id'], op: 'gt', value: payload.id };

	return { kind: 'or', children: [beyond, { kind: 'and', children: [sameValue, beyondId] }] };
}

/**
 * The protocol pipeline, re-exported here because this is where a caller looks for the way a query
 * becomes storage work.
 *
 * The implementation lives in the pipeline module, which imports no storage library, so the whole
 * grammar stays runnable and testable without a database driver present.
 */
export { pageNumberFromOffset, parsePage, toApiQuery } from './query-parser';
export type { ApiQueryParams } from './query-parser';
