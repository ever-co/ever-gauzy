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
 * @param where - The caller's `where`; left as it is.
 * @returns A copy whose `isArchived` is one state, or `In` the two.
 */
export function withArchivedScope<W extends object>(where?: W): W & { isArchived: unknown } {
	const states = archivedStates((where as { isArchived?: unknown })?.isArchived);
	return { ...(where ?? ({} as W)), isArchived: states.length === 1 ? states[0] : In(states) };
}
