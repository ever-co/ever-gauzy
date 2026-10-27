import { In } from 'typeorm';
import { parseToBoolean } from '@gauzy/utils';

/**
 * The archive states a list read answers, from the `isArchived` its caller states.
 *
 * An archived project or team is one the organization finished with: it stays readable by its id (its page, its
 * history, the time logged on it), but no list offers it — not the pickers, the timers, the dashboards, nor the
 * apps built on the API — unless the caller asks for it. So:
 *
 *   - no `isArchived` → the rows that are not archived;
 *   - a boolean, or its text in a query string (`'true'` / `'false'`) → the rows in that state;
 *   - a list of them (`[false, true]`, the Projects page's "Include Archived") → the rows in any of those states.
 *
 * @param isArchived - The `isArchived` of the caller's `where`, as it arrived.
 * @returns The states to read, never empty.
 */
export function archivedStates(isArchived: unknown): boolean[] {
	if (isArchived === undefined || isArchived === null || isArchived === '') {
		return [false];
	}
	const values = Array.isArray(isArchived) ? isArchived : [isArchived];
	const states = [...new Set(values.map((value) => parseToBoolean(value)))];
	return states.length ? states : [false];
}

/**
 * The caller's `where`, reading only the archive states {@link archivedStates} answers.
 *
 * A list of `where` objects (TypeORM's OR form) is scoped branch by branch, each keeping the states it states.
 *
 * @param where - The caller's `where`; left as it is.
 * @returns A copy whose `isArchived` is one state, or `In` the two — per branch for the OR form.
 */
export function withArchivedScope<W extends object>(
	where?: W | W[]
): (W & { isArchived: unknown }) | Array<W & { isArchived: unknown }> {
	if (Array.isArray(where)) {
		return where.length ? where.map((branch) => scopeBranch(branch)) : [scopeBranch(undefined)];
	}
	return scopeBranch(where);
}

/** One `where` object, reading only the archive states it states, or the rows that are not archived. */
function scopeBranch<W extends object>(where?: W): W & { isArchived: unknown } {
	const states = archivedStates((where as { isArchived?: unknown } | undefined)?.isArchived);
	return { ...(where ?? ({} as W)), isArchived: states.length === 1 ? states[0] : In(states) };
}

/**
 * The `where` of a GraphQL list read for its connection `filter`.
 *
 * The list fields read the rows first and apply the connection `filter` to what was read, so the default above
 * would leave an `isArchived` filter nothing archived to select. A filter that names `isArchived` anywhere — in a
 * boolean group too — is read from both states and narrows them itself; any other reads the default.
 *
 * @param filter - The connection `filter` the caller sent.
 * @returns `{ isArchived: [false, true] }` when the filter names `isArchived`, otherwise an empty `where`.
 */
export function archivedScopeOfFilter(filter: unknown): Record<string, unknown> {
	return namesField(filter, 'isArchived') ? { isArchived: [false, true] } : {};
}

/** Whether a filter names a field at any depth. */
function namesField(value: unknown, field: string, depth = 0): boolean {
	if (!value || typeof value !== 'object' || depth > 32) {
		return false;
	}
	if (Array.isArray(value)) {
		return value.some((item) => namesField(item, field, depth + 1));
	}
	return Object.entries(value).some(([key, item]) => key === field || namesField(item, field, depth + 1));
}

/**
 * The rows an edit links a record to: the ones it states, and the archived ones the record is already linked to.
 *
 * The lists offer no archived row, so a client that edits a project's teams or a team's projects never sends back
 * an archived one it is linked to. Saving the stated list as it is would remove that link; it is kept instead,
 * and unarchiving the row shows it linked again.
 *
 * @param stated - The rows the edit states.
 * @param linked - The rows the record is linked to now, as stored.
 * @returns The stated rows, and the linked archived rows the edit did not state.
 */
export function withArchivedLinks<T extends { id?: string; isArchived?: boolean }>(stated: T[], linked: T[] = []): T[] {
	const statedIds = new Set(stated.filter(Boolean).map(({ id }) => id));
	const kept = (linked ?? []).filter((row) => !!row && row.isArchived === true && !statedIds.has(row.id));
	return [...stated, ...kept];
}
