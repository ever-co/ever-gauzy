import { ApiQueryError, SortKey } from './query-ast';
import { CursorCodec } from './cursor';

/**
 * The cursor codec.
 *
 * A cursor is the only opaque value the protocol hands back to a caller and asks it to return, so
 * the suite covers the round trip, the alphabet, the length cap, a payload that was never minted
 * here, and the fingerprint that stops a cursor resuming under an order it was not minted for.
 */

const sort: SortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

const id = '6b1e0f2a-0000-4000-8000-000000000000';

/** The catalogue code a call raises, or `undefined` when it does not raise. */
function codeOf(call: () => unknown): string | undefined {
	try {
		call();
		return undefined;
	} catch (error) {
		return (error as ApiQueryError).code;
	}
}

describe('CursorCodec', () => {
	it('round-trips a row position', () => {
		const cursor = CursorCodec.encode('2026-03-01T10:15:00Z', id, sort);
		expect(CursorCodec.decode(cursor)).toEqual({
			sortValue: '2026-03-01T10:15:00Z',
			id,
			fingerprint: CursorCodec.fingerprint(sort)
		});
	});

	it('emits only base64url characters', () => {
		expect(CursorCodec.encode('2026-03-01T10:15:00Z', id, sort)).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it('renders a date sort value as an instant', () => {
		expect(CursorCodec.decode(CursorCodec.encode(new Date('2026-01-02T03:04:05Z'), id)).sortValue).toBe(
			'2026-01-02T03:04:05.000Z'
		);
	});

	it('carries an absent sort value rather than inventing a null', () => {
		expect(CursorCodec.decode(CursorCodec.encode(null, id)).sortValue).toBe('');
	});

	it('round-trips a separator inside a sort value', () => {
		// A text field may hold the separator, and a payload that could not carry it would make cursor
		// pagination unavailable on that field for no reason.
		expect(CursorCodec.decode(CursorCodec.encode('a|b', id)).sortValue).toBe('a|b');
	});

	it('refuses to mint a cursor that points at no row', () => {
		expect(codeOf(() => CursorCodec.encode('2026-01-01', ''))).toBe('VALIDATION_FAILED');
	});

	it('refuses a payload it cannot decode', () => {
		expect(codeOf(() => CursorCodec.decode('not base64 !!'))).toBe('QUERY_CURSOR_INVALID');
		expect(codeOf(() => CursorCodec.decode(''))).toBe('QUERY_CURSOR_INVALID');
	});

	it('refuses an encoding this codec does not produce', () => {
		expect(codeOf(() => CursorCodec.decode('YQ=='))).toBe('QUERY_CURSOR_INVALID');
		expect(codeOf(() => CursorCodec.decode(Buffer.from('only', 'utf8').toString('base64url')))).toBe(
			'QUERY_CURSOR_INVALID'
		);
		expect(codeOf(() => CursorCodec.decode(Buffer.from('value|', 'utf8').toString('base64url')))).toBe(
			'QUERY_CURSOR_INVALID'
		);
	});

	it('caps the length of a cursor', () => {
		expect(codeOf(() => CursorCodec.decode('a'.repeat(513)))).toBe('QUERY_CURSOR_INVALID');
	});

	it('accepts a cursor under the sort it was minted for', () => {
		const cursor = CursorCodec.encode('2026-03-01T10:15:00Z', id, sort);
		expect(CursorCodec.decodeForSort(cursor, sort).id).toBe(id);
	});

	it('refuses a cursor under another sort', () => {
		const cursor = CursorCodec.encode('2026-03-01T10:15:00Z', id, sort);
		expect(codeOf(() => CursorCodec.decodeForSort(cursor, [{ field: 'name', direction: 'ASC' }]))).toBe(
			'QUERY_CURSOR_SORT_MISMATCH'
		);
	});

	it('fingerprints one sort identically however the keys were written', () => {
		expect(CursorCodec.fingerprint(sort)).toBe(
			CursorCodec.fingerprint([
				{ field: 'createdAt', direction: 'DESC' },
				{ field: 'id', direction: 'DESC' }
			])
		);
		expect(CursorCodec.fingerprint([])).toBe('00000000');
		expect(CursorCodec.fingerprint([{ field: 'name', direction: 'ASC' }])).not.toBe(CursorCodec.fingerprint(sort));
	});
});
