import { SetMetadata } from '@nestjs/common';

/** The value domain of a filterable field, as the resource's metadata declares it. */
export type ApiQueryFieldKind = 'ID' | 'STRING' | 'NUMBER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'ENUM' | 'JSON';

/**
 * What a resource may be filtered, sorted, selected, expanded and searched by.
 *
 * This is the one declaration both API surfaces are projections of. A resource declares it beside
 * its controller; the REST pipe validates a query string against it, and the GraphQL input
 * generator emits the filter, sort and pagination types from it. Neither surface can therefore
 * offer something the other refuses, because neither one holds the list.
 *
 * A controller that declares nothing keeps the base query DTO and its behaviour in full.
 * Everything here is opt-in and nothing is inferred from the entity: an entity column is a storage
 * fact, and a filterable field is a contract decision, so the two are written down separately on
 * purpose.
 */
export interface ApiQuerySchema {
	/** The concept root word: `role`, never a storage-qualified name. */
	readonly resource: string;

	/** Fields a caller may filter on. A dotted entry is a one-level relation path. */
	readonly filterable?: readonly string[];

	/** Fields a caller may sort by. Sorting and filtering are independent allow-lists. */
	readonly sortable?: readonly string[];

	/** Paths a caller may ask for in a sparse fieldset. */
	readonly selectable?: readonly string[];

	/** Relations a caller may expand, as dotted paths. */
	readonly expandable?: readonly string[];

	/** Fields the free-text parameter searches. */
	readonly searchable?: readonly string[];

	/** The sort applied when a caller asks for none. Required for cursor pagination. */
	readonly defaultSort?: readonly string[];

	/** The kind of each filterable field, which decides the operators it accepts. */
	readonly kinds?: Readonly<Record<string, ApiQueryFieldKind>>;

	/** The page size used when a caller asks for none. Twenty when unset. */
	readonly defaultPageSize?: number;

	/** The largest page a caller may ask for. One hundred when unset, never above it. */
	readonly maxPageSize?: number;

	/** Set when counting the filtered set is an estimate rather than an exact count. */
	readonly totalIsApproximate?: boolean;

	/** Set when the resource cannot be read without a channel scope. */
	readonly requiresChannelScope?: boolean;
}

/**
 * The metadata key a resource's query schema is attached under.
 *
 * Deliberately a namespaced literal rather than a bare word: reflection metadata is shared with
 * every other decorator on the class, and a plain key would eventually collide with one.
 */
export const API_QUERY_SCHEMA_METADATA = 'api:query-schema';

/**
 * Declares a controller's query schema.
 *
 * The decorator mirrors the platform's other metadata decorators exactly — `SetMetadata` and
 * nothing else — so that reading the schema back is the familiar `Reflect.getMetadata` call and
 * nothing about the class is altered at runtime.
 *
 * @param schema The resource's declaration.
 * @returns A class decorator that attaches the declaration as metadata.
 */
export function ApiResource(schema: ApiQuerySchema): ClassDecorator {
	return SetMetadata(API_QUERY_SCHEMA_METADATA, schema);
}

/**
 * Reads the query schema a class declares.
 *
 * @param target The controller class, or any value metadata may have been attached to.
 * @returns The declared schema, or `undefined` when the class declared none.
 */
export function getApiQuerySchema(target: unknown): ApiQuerySchema | undefined {
	if (!target) {
		return undefined;
	}
	return Reflect.getMetadata(API_QUERY_SCHEMA_METADATA, target as object) as ApiQuerySchema | undefined;
}

/**
 * Whether a value is shaped like a query schema.
 *
 * Used when a set of declarations is collected from a module or from plugins, where the values
 * arrive untyped. The check is the minimum that makes the value usable — a resource name and at
 * least one allow-list — rather than a full validation, because a half-declared schema is a
 * mistake the parsers report with a better message than a collector could.
 *
 * @param value The candidate.
 * @returns True when the value can be treated as a query schema.
 */
export function isApiQuerySchema(value: unknown): value is ApiQuerySchema {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const candidate = value as Partial<ApiQuerySchema>;
	if (typeof candidate.resource !== 'string' || candidate.resource.trim().length === 0) {
		return false;
	}
	return (
		Array.isArray(candidate.filterable) ||
		Array.isArray(candidate.sortable) ||
		Array.isArray(candidate.selectable) ||
		Array.isArray(candidate.expandable)
	);
}
