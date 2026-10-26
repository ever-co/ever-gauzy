import { BadRequestException } from '@nestjs/common';
import { restatesStoredValue } from '@gauzy/common';

/**
 * The members of a write that would move a value the caller may not move, given the row as stored (the same rule as
 * `@gauzy/plugin-subscription`'s `subscription.writable.ts`; each plugin states its own, as purchasing does).
 *
 * A member the write does not name, or names with the value the row already holds, is not a move: a client that
 * echoes the record back is not refused for stating what is there. What counts as the value already held is
 * `restatesStoredValue`'s rule (`@gauzy/common`): a date by its instant, a decimal by its value (`'10'` restates
 * `'10.000000'`, the column's scale), an object or an array by its content, anything else as text.
 *
 * @param stored The row as stored.
 * @param patch The members the write states.
 * @param writable The members a caller may move.
 * @returns The members the write would move that are not writable.
 */
export function movedReadOnlyMembers(
	stored: Record<string, unknown>,
	patch: Record<string, unknown>,
	writable: readonly string[]
): string[] {
	return Object.keys(patch).filter(
		(member) =>
			patch[member] !== undefined &&
			!writable.includes(member) &&
			!restatesStoredValue(stored[member], patch[member])
	);
}

/**
 * The refusal of a write that would move a member only the record's own operations move.
 *
 * @param code The error code.
 * @param message What was refused and the way to do it instead.
 * @param details The record and the members.
 * @returns The exception to throw.
 */
export function notWritable(code: string, message: string, details: Record<string, unknown>): BadRequestException {
	return new BadRequestException({ message: `${code}: ${message}`, code, details });
}


/**
 * The members of a patch a caller may move, and nothing else: a member checked as a restatement is not written back,
 * so an edit cannot put back a value a lifecycle move changed between the check and the write (Greptile).
 *
 * @param patch The members the write states.
 * @param writable The members a caller may move.
 * @returns A new patch holding only the writable members.
 */
export function writableOnly(patch: Record<string, unknown>, writable: readonly string[]): Record<string, unknown> {
	return Object.fromEntries(Object.entries(patch ?? {}).filter(([member]) => writable.includes(member)));
}
