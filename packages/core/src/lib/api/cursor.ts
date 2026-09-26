import { API_QUERY_LIMITS, ApiQueryError, SortKey, formatSortKeys } from './query-ast';

/**
 * Opaque page cursors.
 *
 * A cursor names one row in a stable order: the value the rows were sorted by, the row's id as a
 * tie-break, and a fingerprint of the sort it was minted under. The order is a tuple rather than a
 * single value because two rows routinely share a timestamp, and a cursor that could not tell them
 * apart would skip or repeat rows as the caller walked a list.
 *
 * One codec serves both surfaces. A cursor obtained over REST therefore resumes a GraphQL
 * connection and the reverse, by construction rather than by two implementations kept in step by
 * hand.
 *
 * The fingerprint is a hash and not a signature: it exists to catch a caller resuming a page under
 * a different sort — a mistake, not an attack — and it must not be read as protecting anything.
 * The values inside the cursor are the caller's own last row.
 */
export interface CursorPayload {
	/** The sort value of the row the cursor points at, as text. */
	readonly sortValue: string;

	/** The row's id, the tie-break that makes the order total. */
	readonly id: string;

	/** The fingerprint of the sort the cursor was minted under, when it carries one. */
	readonly fingerprint?: string;
}

/** The characters base64url may contain. */
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/** The separator between the parts of a cursor payload. */
const SEPARATOR = '|';

/** The fingerprint of an empty sort, so callers always have something to compare. */
const EMPTY_SORT_FINGERPRINT = '00000000';

/** Escapes the separator (and the escape itself) inside one part of a payload. */
function escapePart(value: string): string {
	return value.split('%').join('%25').split(SEPARATOR).join('%7C');
}

/** Reverses {@link escapePart}. */
function unescapePart(value: string): string {
	return value.split('%7C').join(SEPARATOR).split('%25').join('%');
}

/**
 * A stable 32-bit hash of a string, rendered as eight hexadecimal digits.
 *
 * FNV-1a: five lines, no dependency, and identical on every runtime the platform ships to. A
 * cryptographic digest would be slower for no benefit — nothing here is a security boundary.
 */
function hash(text: string): string {
	let value = 0x811c9dc5;
	for (let index = 0; index < text.length; index += 1) {
		value ^= text.charCodeAt(index);
		// Multiply by the FNV prime (16777619) with 32-bit wraparound, written as shifts so the
		// result does not depend on floating-point multiplication staying exact.
		value = (value + ((value << 1) + (value << 4) + (value << 7) + (value << 8) + (value << 24))) >>> 0;
	}
	return value.toString(16).padStart(8, '0');
}

/** Renders a sort value the way a cursor carries it. */
function toSortValueText(sortValue: unknown): string {
	if (sortValue === null || sortValue === undefined) {
		// A null sort value is a real position in the order (`NULLS LAST` aside), and it must stay
		// distinguishable from the empty string, so it is spelled out.
		return '';
	}
	if (sortValue instanceof Date) {
		return sortValue.toISOString();
	}
	return String(sortValue);
}

/**
 * The cursor codec.
 *
 * Every member is static and the class holds no state: a cursor is a string, and the only reason
 * this is a class rather than three functions is that the two surfaces and their tests all reach
 * for it by name.
 */
export class CursorCodec {
	/**
	 * Mints a cursor for one row.
	 *
	 * @param sortValue The row's value under the effective sort's first key.
	 * @param id The row's id.
	 * @param sort The effective sort, whose fingerprint is embedded so that a later resume under a
	 *   different order is refused instead of silently returning the wrong page.
	 * @returns The opaque, URL-safe cursor.
	 */
	static encode(sortValue: unknown, id: unknown, sort?: readonly SortKey[]): string {
		if (id === null || id === undefined || String(id).length === 0) {
			throw new ApiQueryError('VALIDATION_FAILED', 'A cursor needs the id of the row it points at.');
		}
		const parts = [escapePart(toSortValueText(sortValue)), escapePart(String(id))];
		if (sort) {
			parts.push(this.fingerprint(sort));
		}
		return Buffer.from(parts.join(SEPARATOR), 'utf8').toString('base64url');
	}

	/**
	 * Reads a cursor back.
	 *
	 * @param cursor The opaque cursor, as sent by a client.
	 * @returns The payload it carries.
	 * @throws ApiQueryError `QUERY_CURSOR_INVALID` when the cursor is not one this server minted.
	 */
	static decode(cursor: unknown): CursorPayload {
		if (typeof cursor !== 'string' || cursor.length === 0) {
			throw new ApiQueryError('QUERY_CURSOR_INVALID', 'A cursor must be a non-empty string.');
		}
		if (cursor.length > API_QUERY_LIMITS.cursorLength) {
			throw new ApiQueryError('QUERY_CURSOR_INVALID', `A cursor may be at most ${API_QUERY_LIMITS.cursorLength} characters.`, {
				limit: API_QUERY_LIMITS.cursorLength,
				actual: cursor.length
			});
		}
		if (!BASE64URL_PATTERN.test(cursor)) {
			throw new ApiQueryError('QUERY_CURSOR_INVALID', 'A cursor must be base64url without padding.');
		}

		const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
		if (Buffer.from(decoded, 'utf8').toString('base64url') !== cursor) {
			// The input decoded, but not to the text this encoding would produce from it: it was
			// padded, or it carried trailing bits that belong to no payload.
			throw new ApiQueryError('QUERY_CURSOR_INVALID', 'The cursor is not a payload this server minted.');
		}

		const parts = decoded.split(SEPARATOR);
		if (parts.length < 2 || parts.length > 3) {
			throw new ApiQueryError('QUERY_CURSOR_INVALID', 'The cursor does not carry a sort value, an id and a fingerprint.');
		}
		const id = unescapePart(parts[1]);
		if (id.length === 0) {
			throw new ApiQueryError('QUERY_CURSOR_INVALID', 'The cursor carries no row id.');
		}
		return {
			sortValue: unescapePart(parts[0]),
			id,
			fingerprint: parts.length === 3 ? parts[2] : undefined
		};
	}

	/**
	 * Reads a cursor back and checks it against the sort the caller is walking under.
	 *
	 * @param cursor The opaque cursor.
	 * @param sort The effective sort of the request being made.
	 * @returns The payload.
	 * @throws ApiQueryError `QUERY_CURSOR_INVALID` for a malformed cursor, or
	 *   `QUERY_CURSOR_SORT_MISMATCH` when the cursor was minted under a different sort.
	 */
	static decodeForSort(cursor: unknown, sort: readonly SortKey[]): CursorPayload {
		const payload = this.decode(cursor);
		if (payload.fingerprint && payload.fingerprint !== this.fingerprint(sort)) {
			throw new ApiQueryError('QUERY_CURSOR_SORT_MISMATCH', 'This cursor was minted under a different sort order.', {
				cursorSort: payload.fingerprint,
				requestSort: formatSortKeys(sort)
			});
		}
		return payload;
	}

	/**
	 * The fingerprint of a sort.
	 *
	 * Taken over the wire rendering of the keys, so two spellings of one sort — a comma-separated
	 * `sort` parameter and a GraphQL list of `{ field, direction }` inputs — fingerprint
	 * identically and a cursor may cross surfaces.
	 *
	 * @param sort The sort keys.
	 * @returns Eight hexadecimal digits.
	 */
	static fingerprint(sort: readonly SortKey[] | undefined): string {
		const rendered = formatSortKeys(sort);
		return rendered.length === 0 ? EMPTY_SORT_FINGERPRINT : hash(rendered);
	}
}
