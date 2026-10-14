import { BadRequestException } from '@nestjs/common';

/**
 * The members of a write that would move a value the caller may not move, given the row as stored.
 *
 * A member the write does not name, or names with the value the row already holds, is not a move: a client that
 * echoes the record back is not refused for stating what is there. A date is compared by its instant, a decimal by
 * its value (`'10'` restates `'10.000000'`, the column's scale), anything else as text.
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
		(member) => patch[member] !== undefined && !writable.includes(member) && !restates(stored[member], patch[member])
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

/** Whether a stated value is the value already stored. */
function restates(stored: unknown, stated: unknown): boolean {
	if (stated === null || stored === null || stored === undefined) {
		return (stated === null || stated === undefined) && (stored === null || stored === undefined);
	}
	if (stored instanceof Date || stated instanceof Date) {
		const held = new Date(stored as string | Date).getTime();
		const wanted = new Date(stated as string | Date).getTime();

		return Number.isFinite(held) && held === wanted;
	}

	const decimal = /^[+-]?\d+(\.\d+)?$/;
	const canonical = (value: string) =>
		value
			.replace(/^\+/, '')
			.replace(/(\.\d*?)0+$/, '$1')
			.replace(/\.$/, '');

	if (decimal.test(String(stored)) && decimal.test(String(stated))) {
		return canonical(String(stored)) === canonical(String(stated));
	}

	return String(stated) === String(stored);
}
