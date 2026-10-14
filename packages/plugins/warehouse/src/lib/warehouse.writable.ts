import { BadRequestException } from '@nestjs/common';

/**
 * What a generic edit of a warehouse document may write (review R2-13).
 *
 * `PUT /pick-lists/:id`, `/pick-list-lines/:id`, `/pick-waves/:id`, `/pack-slips/:id` and `/carrier-manifests/:id`, and
 * the `update*` mutations that mirror them, validate bodies that are `PartialType` of the full DTO: the status, the
 * counters, the timestamps, the version and the picked and short quantities are all declared. Those members are the
 * documents' own operations' to move — assign/start/complete/cancel, pick/substitute/skip, release/close, pack,
 * close/hand-over — each of which checks the state it is attempted from and writes what follows from it, and the pick
 * outcomes write stock movements. An edit is therefore held to the members each DTO says it may change, and refused
 * with `<RESOURCE>_FIELD_NOT_WRITABLE` for any other member it would move.
 *
 * The three functions below are the helper review #10607 introduced for the subscription and entitlement plugins,
 * restated here because those plugins' copies are their own; a member a body merely restates is not a move, so a
 * client that echoes a record back is not refused for stating what is there.
 */

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
		(member) =>
			patch[member] !== undefined && !writable.includes(member) && !restates(stored[member], patch[member])
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
 * so an edit cannot put back a value a lifecycle move changed between the check and the write.
 *
 * @param patch The members the write states.
 * @param writable The members a caller may move.
 * @returns A new patch holding only the writable members.
 */
export function writableOnly(patch: Record<string, unknown>, writable: readonly string[]): Record<string, unknown> {
	return Object.fromEntries(Object.entries(patch ?? {}).filter(([member]) => writable.includes(member)));
}

/**
 * Checks an edit of one warehouse document and answers the members it may write.
 *
 * @param stored The document as stored.
 * @param patch The members the edit states.
 * @param writable The members an edit of the document may move in its current state.
 * @param refusal The error code, the document's name for the message, and the operations that move the rest.
 * @returns The writable part of the patch — empty when the edit only restated the document.
 * @throws BadRequestException with `refusal.code` when the edit would move any other member.
 */
export function warehouseEditOf(
	stored: { id?: unknown; status?: unknown },
	patch: Record<string, unknown>,
	writable: readonly string[],
	refusal: { code: string; document: string; operations: string }
): Record<string, unknown> {
	const moved = movedReadOnlyMembers(stored as Record<string, unknown>, patch ?? {}, writable);

	if (moved.length) {
		throw notWritable(
			refusal.code,
			`an edit cannot change ${moved.join(', ')} of ${refusal.document} '${stored.id}' (status ${stored.status}); ` +
				`${refusal.operations}`,
			{ id: stored.id, status: stored.status, fields: moved, writable: [...writable] }
		);
	}

	return writableOnly(patch ?? {}, writable);
}

/**
 * The refusal of an edit that selects documents by anything but an id: each edit is checked against the one row it
 * changes, so a criteria-wide edit is not a correction this surface makes.
 *
 * @param code The error code.
 * @param document The document's name for the message.
 * @returns The exception to throw.
 */
export function editByIdOnly(code: string, document: string): BadRequestException {
	return notWritable(code, `${document} is edited one at a time, by its id.`, {});
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
	// Trailing zeros are dropped by a scan rather than a pattern, so a long run of digits in a body costs linear time.
	const canonical = (value: string) => {
		const text = value.startsWith('+') ? value.slice(1) : value;

		if (!text.includes('.')) {
			return text;
		}

		let end = text.length;

		while (text[end - 1] === '0') {
			end--;
		}

		return text.slice(0, text[end - 1] === '.' ? end - 1 : end);
	};

	if (decimal.test(String(stored)) && decimal.test(String(stated))) {
		return canonical(String(stored)) === canonical(String(stated));
	}

	if (typeof stored === 'object' || typeof stated === 'object') {
		return JSON.stringify(stored) === JSON.stringify(stated);
	}

	return String(stated) === String(stored);
}
