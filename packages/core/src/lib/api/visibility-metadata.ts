// A per-property metadata write needs the metadata store to exist, and this module is also loaded by
// isolated specs and by the projection's own execution check. Importing the polyfill here is what
// makes the module work whatever loaded it, instead of depending on the application's entry point.
import 'reflect-metadata';

import { VISIBLE_WITH_FIELDS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';

/**
 * One property of a resource that only some callers may see, and the permission that decides it.
 */
export interface VisibleWithField {
	/** The property name as it appears on the response: `costPrice`. */
	readonly property: string;
	/** The permission a caller must hold for the property to be readable or writable. */
	readonly permission: PermissionsEnum;
}

/**
 * Decides whether the current caller holds a permission.
 *
 * It is a parameter rather than a global lookup so the projection is a plain function: a caller's
 * grants are resolved once per request and the same predicate drives REST, GraphQL and the write
 * check.
 */
export type VisibilityPredicate = (permission: PermissionsEnum) => boolean;

/**
 * How deep a response is walked.
 *
 * An expanded relation carries rows of its own and a gated field on one of them must not leak just
 * because it arrived nested. The walk is bounded because an unbounded one over a cyclic object
 * graph is a denial of service, and because a relation deeper than the protocol's own expansion
 * limit cannot be requested in the first place.
 */
export const DEFAULT_PROJECTION_DEPTH = 4;

/** Options of {@link projectValue}. */
export interface IProjectionWalkOptions {
	/** Relation levels below the response root that are projected; defaults to 4. */
	readonly maxDepth?: number;
}

/** A memoised answer, so a list of rows costs one reflection per class and not one per row. */
const visibleFieldsByType = new WeakMap<object, readonly VisibleWithField[]>();

/**
 * The gated properties of a resource, read once per class.
 *
 * The declaration is written by `@VisibleWith` on the property itself, which also appends it to the
 * class's own declaration list — the list is what is read here, because a property cannot be
 * discovered by enumerating a class: an instance field is not on the prototype, so a scan of
 * prototype names would find a computed field and miss every stored column. The walk starts at the
 * prototype and moves up, so a field declared on a base entity is found by the same scan as one
 * declared on the resource itself, and the most derived declaration of a name wins. The result is
 * memoised per class and frozen, which is what makes the projection a property delete against a
 * precomputed set rather than a reflection pass per row.
 *
 * @param entityType The class to inspect: an entity, or the DTO a write body was validated as.
 * @returns The gated properties, in declaration order from the most derived class upwards.
 */
export function collectVisibleWithFields(entityType: unknown): readonly VisibleWithField[] {
	if (typeof entityType !== 'function') {
		return [];
	}

	const cached = visibleFieldsByType.get(entityType);

	if (cached) {
		return cached;
	}

	const fields: VisibleWithField[] = [];
	const prototype = (entityType as { prototype?: object }).prototype;

	if (prototype && typeof prototype === 'object') {
		const seen = new Set<string>();

		let level: object | null = prototype;

		while (level && level !== Object.prototype) {
			const declared = Reflect.getOwnMetadata(VISIBLE_WITH_FIELDS_METADATA, level) as
				| readonly VisibleWithField[]
				| undefined;

			for (const field of declared ?? []) {
				if (seen.has(field.property)) {
					// A subclass that re-declares a gated property keeps the most derived declaration;
					// the base class's is the same field and is not a second gate.
					continue;
				}

				seen.add(field.property);
				fields.push({ property: field.property, permission: field.permission });
			}

			level = Object.getPrototypeOf(level);
		}
	}

	const collected = Object.freeze(fields);
	visibleFieldsByType.set(entityType, collected);

	return collected;
}

/**
 * Removes every gated property the caller may not see from one row.
 *
 * The property is **deleted**, never nulled and never zeroed: a key that is present with a null
 * value tells the caller the field exists and invites a client to render an empty cell, while an
 * absent key tells it nothing at all. For a stored column the key really goes away; a computed
 * field lives on the prototype, where `delete` cannot reach it, so it is shadowed by a
 * non-enumerable own property that carries no value and that no serializer picks up.
 *
 * @param entity The row to project, mutated in place.
 * @param fields The gated properties of the row's class.
 * @param canSee The caller's permission predicate.
 * @returns True when at least one property was removed.
 */
export function projectEntity(
	entity: object,
	fields: readonly VisibleWithField[],
	canSee: VisibilityPredicate
): boolean {
	if (!entity || fields.length === 0) {
		return false;
	}

	let removed = false;

	for (const field of fields) {
		if (canSee(field.permission)) {
			continue;
		}

		if (dropProperty(entity, field.property)) {
			removed = true;
		}
	}

	return removed;
}

/**
 * Projects a whole response: one row, a list of rows, or a pagination envelope around either.
 *
 * The walk follows own enumerable properties only, so a relation that was expanded is projected
 * too — a gated field on a nested row is exactly as unreadable as one on the root row. It is
 * bounded by {@link DEFAULT_PROJECTION_DEPTH} and keeps a set of the objects it has already seen,
 * so a cyclic or unexpectedly deep object graph terminates instead of hanging the request.
 *
 * @param value The value a handler returned.
 * @param canSee The caller's permission predicate.
 * @param options Walk options.
 * @returns The same value, projected in place; a primitive is returned untouched.
 */
export function projectValue<T>(value: T, canSee: VisibilityPredicate, options: IProjectionWalkOptions = {}): T {
	const maxDepth = options.maxDepth ?? DEFAULT_PROJECTION_DEPTH;

	walk(value, canSee, 0, maxDepth, new WeakSet<object>());

	return value;
}

/**
 * The first gated property a request asked for by name in its field selection.
 *
 * An explicit ask is treated differently from a projection: the caller named the field, so silently
 * returning a response without it hides a permission problem behind a shape that looks correct. The
 * caller is told instead. Only the root segment of a dot path is matched, because a path into a
 * relation names a field of that relation, which the walk projects rather than the selection check.
 *
 * @param paths The requested field paths.
 * @param fields The gated properties of the response's class.
 * @returns The field the selection named, or undefined.
 */
export function findWithheldField(
	paths: readonly string[],
	fields: readonly VisibleWithField[]
): VisibleWithField | undefined {
	if (paths.length === 0 || fields.length === 0) {
		return undefined;
	}

	for (const path of paths) {
		const root = path.split('.')[0].trim();

		const named = fields.find((field) => field.property === root);

		if (named) {
			return named;
		}
	}

	return undefined;
}

/**
 * The field paths a parsed query carries.
 *
 * A selection arrives as a list of paths, or as the selection object the protocol parser builds
 * around one; both are accepted because a route may mount the projection before it adopts the
 * query protocol, and a request that names no fields simply has nothing to check.
 *
 * @param selection The request's parsed field selection, of either shape.
 * @returns The paths, empty when the request named none.
 */
export function readRequestedFields(selection: unknown): readonly string[] {
	const entries = Array.isArray(selection)
		? selection
		: selection && typeof selection === 'object' && Array.isArray((selection as { paths?: unknown }).paths)
			? ((selection as { paths: unknown[] }).paths as unknown[])
			: [];

	return entries.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * `OrderLine` becomes `orderLine`, which is how a resource is named in an error's details.
 *
 * @param value The type name as the schema spells it.
 * @returns The same name starting in lower case.
 */
export function lowerFirst(value: string): string {
	return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

/**
 * Deletes one property, reaching a computed field that `delete` alone cannot remove.
 *
 * @param target The row.
 * @param property The property name.
 * @returns True when the value is no longer readable from the row.
 */
function dropProperty(target: object, property: string): boolean {
	if (!(property in target)) {
		return false;
	}

	delete (target as Record<string, unknown>)[property];

	if (property in target) {
		Object.defineProperty(target, property, {
			value: undefined,
			enumerable: false,
			configurable: true,
			writable: true
		});
	}

	return true;
}

/**
 * Walks one node of a response.
 *
 * @param node The node.
 * @param canSee The caller's permission predicate.
 * @param depth The node's depth below the response root.
 * @param maxDepth The walk's bound.
 * @param seen The nodes already projected.
 */
function walk(node: unknown, canSee: VisibilityPredicate, depth: number, maxDepth: number, seen: WeakSet<object>): void {
	if (!node || typeof node !== 'object' || depth > maxDepth || seen.has(node)) {
		return;
	}

	seen.add(node);

	if (Array.isArray(node)) {
		// A list is not a row: its entries are projected at the same depth as the list itself.
		for (const entry of node) {
			walk(entry, canSee, depth, maxDepth, seen);
		}

		return;
	}

	projectEntity(node, collectVisibleWithFields(node.constructor), canSee);

	if (depth === maxDepth) {
		return;
	}

	for (const key of Object.keys(node)) {
		const child = (node as Record<string, unknown>)[key];

		if (child && typeof child === 'object') {
			walk(child, canSee, depth + 1, maxDepth, seen);
		}
	}
}
