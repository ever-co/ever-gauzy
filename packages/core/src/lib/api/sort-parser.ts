import { API_QUERY_LIMITS, ApiQueryError, SortKey } from './query-ast';
import type { ApiQuerySchema } from './query-schema';

/**
 * Ordering, parsed once for every surface.
 *
 * The wire form is `sort=-createdAt,name`: a leading `-` means descending, the comma separates
 * keys, and the order of the keys is the order of the ORDER BY. GraphQL sends the same thing as a
 * list of `{ field, direction }` inputs and the legacy alias sends a TypeORM-style order object;
 * all three arrive here, and all three leave as the same list of keys, so a page is ordered
 * identically whichever door the caller came through.
 *
 * Two rules are worth stating because they are what make cursor pagination possible at all: the
 * effective sort is never empty when the resource declares a default, and the keys are the only
 * thing a cursor's fingerprint is computed over.
 */

/** Reads a sort key's wire spelling into a field and a direction. */
function parseSortToken(token: string): SortKey | undefined {
	const trimmed = token.trim();
	if (trimmed.length === 0) {
		return undefined;
	}
	if (trimmed.startsWith('-')) {
		return { field: trimmed.slice(1), direction: 'DESC' };
	}
	if (trimmed.startsWith('+')) {
		return { field: trimmed.slice(1), direction: 'ASC' };
	}
	return { field: trimmed, direction: 'ASC' };
}

/** How deep the sort value may nest before it is refused rather than walked. */
const MAX_SORT_NESTING = 4;

/** Normalises anything that can carry sort tokens into a list of them. */
function toSortTokens(raw: unknown, depth = 0): string[] {
	if (raw === undefined || raw === null || raw === '') {
		return [];
	}
	if (depth > MAX_SORT_NESTING) {
		// Refused rather than ignored: a sort that silently disappears returns rows in an order the
		// caller did not ask for, which is worse than an error they can read.
		throw new ApiQueryError('VALIDATION_FAILED', `The sort parameter is nested more than ${MAX_SORT_NESTING} levels deep.`, {
			limit: MAX_SORT_NESTING
		});
	}
	if (Array.isArray(raw)) {
		// Every element goes back through this function, whatever its shape. A GraphQL connection
		// sends a list of `{ field, direction }` objects and a REST caller sends a list of tokens;
		// recursing rather than handling only strings is what makes both lists work. An element of a
		// shape this function cannot read contributes nothing, and the cap and the allow-list are
		// then checked on what was understood.
		return raw.flatMap((entry) => toSortTokens(entry, depth + 1));
	}
	if (typeof raw === 'string') {
		return raw.split(',');
	}
	// A GraphQL connection sends `[{ field, direction }]`. Accepting the shape here rather than in
	// the resolver keeps the two surfaces on one implementation of the cap and the allow-list.
	if (typeof raw === 'object') {
		const candidate = raw as { field?: unknown; direction?: unknown };
		if (typeof candidate.field === 'string') {
			const direction = String(candidate.direction ?? 'ASC').toUpperCase() === 'DESC' ? '-' : '';
			return [`${direction}${candidate.field}`];
		}
	}
	return [];
}

/**
 * Checks a field against the resource's sort allow-list.
 *
 * @param field The field the caller asked to sort by.
 * @param schema The resource's declaration, when it has one.
 */
function assertSortable(field: string, schema?: ApiQuerySchema): void {
	if (!schema?.sortable) {
		return;
	}
	if (!schema.sortable.includes(field)) {
		throw new ApiQueryError('QUERY_SORT_NOT_ALLOWED', `"${field}" is not a sortable field of "${schema.resource}".`, {
			field,
			allowed: [...schema.sortable]
		});
	}
}

/** Refuses more keys than the protocol allows. */
function assertSortKeyCount(count: number): void {
	if (count > API_QUERY_LIMITS.sortKeys) {
		throw new ApiQueryError(
			'QUERY_SORT_NOT_ALLOWED',
			`The request sorts by ${count} fields; at most ${API_QUERY_LIMITS.sortKeys} are allowed.`,
			{ limit: API_QUERY_LIMITS.sortKeys, actual: count }
		);
	}
}

/**
 * Parses the `sort` parameter.
 *
 * @param raw The raw value: a comma-separated string, a list of tokens, a list of
 *   `{ field, direction }` objects, or a nested `sort[0]=…` object form.
 * @param schema The resource's declaration, when it has one.
 * @returns The sort keys, in caller order. Empty when the caller asked for none and the resource
 *   declares no default.
 * @throws ApiQueryError `QUERY_SORT_NOT_ALLOWED` for a field outside the allow-list, or too many
 *   keys.
 */
export function parseSort(raw: unknown, schema?: ApiQuerySchema): SortKey[] {
	const keys: SortKey[] = [];

	// The nested form arrives as an array under a numeric key (`sort[0]`, `sort[1]`), which the
	// query-string parser hands over as a plain object. Walking it in key order preserves the
	// caller's ordering, which is the whole meaning of a multi-key sort.
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
		const candidate = raw as Record<string, unknown>;
		if (typeof candidate.field === 'string') {
			const tokens = toSortTokens(raw);
			for (const token of tokens) {
				const key = parseSortToken(token);
				if (key) {
					keys.push(key);
				}
			}
		} else {
			for (const key of Object.keys(candidate).sort((left, right) => Number(left) - Number(right))) {
				const parsed = parseSortToken(String(candidate[key]));
				if (parsed) {
					keys.push(parsed);
				}
			}
		}
	} else {
		for (const token of toSortTokens(raw)) {
			const key = parseSortToken(token);
			if (key) {
				keys.push(key);
			}
		}
	}

	assertSortKeyCount(keys.length);
	for (const key of keys) {
		assertSortable(key.field, schema);
	}
	return keys;
}

/**
 * Parses the legacy `order` object into sort keys.
 *
 * The alias is deliberately forgiving in one direction only: a field the resource does not allow
 * sorting by is dropped rather than refused, because callers of the legacy parameter have been
 * sending the same order objects for years and must not start receiving errors for them.
 *
 * @param order The legacy order value: `{ createdAt: 'DESC' }`, a list of such objects, or a
 *   `{ field: direction }` map.
 * @param schema The resource's declaration, when it has one.
 * @returns The sort keys the resource allows, in the order the caller listed them.
 */
export function parseSortFromLegacyOrder(order: unknown, schema?: ApiQuerySchema): SortKey[] {
	const keys: SortKey[] = [];

	const pushEntry = (field: string, direction: unknown): void => {
		const normalised = String(direction ?? 'ASC').trim().toUpperCase();
		// TypeORM accepts `ASC NULLS LAST`; only the leading direction matters to the protocol.
		const descending = normalised.startsWith('DESC') || normalised.startsWith('-');
		keys.push({ field, direction: descending ? 'DESC' : 'ASC' });
	};

	const walk = (value: unknown): void => {
		if (!value || typeof value !== 'object') {
			return;
		}
		if (Array.isArray(value)) {
			value.forEach(walk);
			return;
		}
		for (const [field, direction] of Object.entries(value as Record<string, unknown>)) {
			if (direction && typeof direction === 'object' && !Array.isArray(direction)) {
				// A nested order object names a relation's own ordering, which the protocol does not
				// express; dropping it keeps the alias's promise that it never fails on shape.
				continue;
			}
			pushEntry(field, direction);
		}
	};

	walk(order);

	return keys
		.filter((key) => !schema?.sortable || schema.sortable.includes(key.field))
		.slice(0, API_QUERY_LIMITS.sortKeys);
}

/**
 * The sort a request is actually ordered by.
 *
 * A caller who asks for no sort gets the resource's declared default, which is what makes an
 * unparameterised page reproducible and what makes a cursor resumable: a cursor is only valid
 * under the sort it was minted for.
 *
 * @param requested The keys the caller asked for, already parsed.
 * @param schema The resource's declaration, when it has one.
 * @returns The effective sort keys.
 */
export function resolveEffectiveSort(requested: readonly SortKey[], schema?: ApiQuerySchema): SortKey[] {
	if (requested.length > 0) {
		return [...requested];
	}
	// The resource's own declaration is trusted rather than re-validated against its allow-list: a
	// default sort outside `sortable` is a schema mistake, and answering every unparameterised list
	// request with a 400 would blame the caller for it.
	return toSortTokens(schema?.defaultSort)
		.map((token) => parseSortToken(token))
		.filter((key): key is SortKey => !!key);
}
