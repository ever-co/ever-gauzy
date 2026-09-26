import { API_QUERY_LIMITS, ApiQueryError, FieldSelection } from './query-ast';
import type { ApiQuerySchema } from './query-schema';

/**
 * Sparse fieldsets and explicit relation expansion.
 *
 * Both parameters name paths, and both are measured against the same declaration the filter uses,
 * so a path a client may select is a path the resource promised to serve — never a column somebody
 * guessed by reading the table. The projection itself is a pure function over plain rows: it
 * removes keys a caller did not ask for and never adds one, which is the property that makes it
 * safe to apply to a response that has already been assembled.
 */

/** Reads a comma-separated path list, or a list already split. */
function toPathList(raw: unknown): string[] {
	if (raw === undefined || raw === null || raw === '') {
		return [];
	}
	if (Array.isArray(raw)) {
		return raw.flatMap((entry) => toPathList(entry));
	}
	if (typeof raw === 'string') {
		return raw
			.split(',')
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);
	}
	return [];
}

/** Splits a dotted path and checks it against the segment cap. */
function splitPath(path: string, limit: number, code: 'QUERY_FIELD_NOT_SELECTABLE' | 'QUERY_EXPAND_DEPTH_EXCEEDED'): string[] {
	const segments = path.split('.').filter((segment) => segment.length > 0);
	if (segments.length === 0) {
		throw new ApiQueryError('VALIDATION_FAILED', 'A field path must name something.');
	}
	if (segments.length > limit) {
		throw new ApiQueryError(code, `"${path}" has ${segments.length} segments; at most ${limit} are allowed.`, {
			path,
			limit,
			actual: segments.length
		});
	}
	return segments;
}

/** Checks every path against an allow-list, naming the list it was measured against. */
function assertAllowed(paths: readonly string[], allowed: readonly string[] | undefined, resource: string, code: 'QUERY_FIELD_NOT_SELECTABLE' | 'QUERY_EXPAND_NOT_ALLOWED'): void {
	if (!allowed) {
		return;
	}
	for (const path of paths) {
		if (!allowed.includes(path)) {
			throw new ApiQueryError(code, `"${path}" is not available on "${resource}".`, { path, allowed: [...allowed] });
		}
	}
}

/**
 * Parses the `fields` parameter into a sparse fieldset.
 *
 * The object form is accepted as well as the comma-separated one, because the legacy alias carries
 * `data.select` as an object and both spellings have to produce the same selection.
 *
 * @param raw The raw value: `id,title,lines.sku`, a list, or an object with truthy leaves.
 * @param schema The resource's declaration, when it has one.
 * @returns The selection, deduplicated in caller order, or `undefined` when nothing was selected.
 * @throws ApiQueryError `QUERY_FIELD_NOT_SELECTABLE` for too many paths, a path that is too deep,
 *   or a path outside the resource's `selectable` list.
 */
export function parseFields(raw: unknown, schema?: ApiQuerySchema): FieldSelection | undefined {
	const paths = raw && typeof raw === 'object' && !Array.isArray(raw) ? flattenSelectObject(raw) : toPathList(raw);
	if (paths.length === 0) {
		return undefined;
	}
	if (paths.length > API_QUERY_LIMITS.fieldPaths) {
		throw new ApiQueryError(
			'QUERY_FIELD_NOT_SELECTABLE',
			`The request selects ${paths.length} paths; at most ${API_QUERY_LIMITS.fieldPaths} are allowed.`,
			{ limit: API_QUERY_LIMITS.fieldPaths, actual: paths.length }
		);
	}
	for (const path of paths) {
		splitPath(path, API_QUERY_LIMITS.fieldPathSegments, 'QUERY_FIELD_NOT_SELECTABLE');
	}
	assertAllowed(paths, schema?.selectable, schema?.resource ?? 'this resource', 'QUERY_FIELD_NOT_SELECTABLE');
	return { paths: Array.from(new Set(paths)) };
}

/**
 * Flattens a `select` object into dotted paths.
 *
 * @param value The object form, for example `{ id: true, customer: { name: true } }`.
 * @returns The paths whose leaves are truthy.
 */
export function flattenSelectObject(value: unknown): string[] {
	const paths: string[] = [];
	const walk = (node: unknown, prefix: string): void => {
		if (!node || typeof node !== 'object') {
			if (prefix && node) {
				paths.push(prefix);
			}
			return;
		}
		for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
			const path = prefix ? `${prefix}.${key}` : key;
			if (child && typeof child === 'object' && !Array.isArray(child)) {
				walk(child, path);
				continue;
			}
			if (child) {
				paths.push(path);
			}
		}
	};
	walk(value, '');
	return paths;
}

/**
 * Parses the `expand` parameter.
 *
 * Every path must appear in the resource's `expandable` list as written. Accepting a prefix of a
 * listed path would make a typo indistinguishable from a deliberate partial expansion, and the
 * whole point of the list is that an expansion is a query the server has agreed to run.
 *
 * @param raw The raw value: `customer,lines.variant`, a list, or a single path.
 * @param schema The resource's declaration, when it has one.
 * @returns The expansion paths, deduplicated in caller order.
 * @throws ApiQueryError `QUERY_EXPAND_NOT_ALLOWED` for a relation outside the list,
 *   `QUERY_EXPAND_DEPTH_EXCEEDED` for too many paths or a path that is too deep.
 */
export function parseExpand(raw: unknown, schema?: ApiQuerySchema): string[] {
	const paths = toPathList(raw);
	if (paths.length === 0) {
		return [];
	}
	if (paths.length > API_QUERY_LIMITS.expandPaths) {
		throw new ApiQueryError(
			'QUERY_EXPAND_DEPTH_EXCEEDED',
			`The request expands ${paths.length} relations; at most ${API_QUERY_LIMITS.expandPaths} are allowed.`,
			{ limit: API_QUERY_LIMITS.expandPaths, actual: paths.length }
		);
	}
	for (const path of paths) {
		splitPath(path, API_QUERY_LIMITS.expandDepth, 'QUERY_EXPAND_DEPTH_EXCEEDED');
	}
	assertAllowed(paths, schema?.expandable, schema?.resource ?? 'this resource', 'QUERY_EXPAND_NOT_ALLOWED');
	return Array.from(new Set(paths));
}

/**
 * Keeps only the selected paths in each row.
 *
 * The projection walks the selection rather than the row, so it cannot leak a key the caller did
 * not name; a selected path whose parent is not present is skipped rather than invented, which is
 * what keeps a projection over an unexpanded relation from producing an empty object where the
 * caller expected nothing at all.
 *
 * @param rows The rows to project.
 * @param selection The selection, or `undefined` to return the rows untouched.
 * @returns New row objects carrying only the selected paths.
 */
export function applyProjection<T extends Record<string, unknown>>(rows: readonly T[], selection?: FieldSelection): T[] {
	if (!selection || selection.paths.length === 0) {
		return rows as T[];
	}
	return rows.map((row) => projectRow(row, selection.paths));
}

/** Projects one row onto a set of dotted paths. */
function projectRow<T extends Record<string, unknown>>(row: T, paths: readonly string[]): T {
	const projected: Record<string, unknown> = {};
	for (const path of paths) {
		const segments = path.split('.').filter((segment) => segment.length > 0);
		let source: unknown = row;
		let target: Record<string, unknown> = projected;
		let reachable = true;

		for (let index = 0; index < segments.length; index += 1) {
			const segment = segments[index];
			if (!source || typeof source !== 'object' || !Object.prototype.hasOwnProperty.call(source, segment)) {
				reachable = false;
				break;
			}
			const value = (source as Record<string, unknown>)[segment];
			if (index === segments.length - 1) {
				target[segment] = value;
			} else {
				const next = (target[segment] as Record<string, unknown>) ?? {};
				target[segment] = next;
				target = next;
				source = value;
			}
		}

		if (!reachable) {
			continue;
		}
	}
	return projected as T;
}
