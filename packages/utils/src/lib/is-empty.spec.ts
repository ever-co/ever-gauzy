import { isEmpty } from './is-empty';
import { isNotEmpty } from './is-not-empty';

/**
 * `isEmpty` decides "is there a value" for ~300 call sites, so what it answers for each kind of input is pinned
 * here. A `Date` has no own enumerable property, so the object branch used to read EVERY date as empty — and a
 * list of dates as an empty list: `isNotEmpty(startDate)` skipped a date-range filter handed a Date, and a move's
 * slot release returned early on `isEmpty([date])` (found in #10763).
 */
describe('isEmpty / isNotEmpty', () => {
	const date = new Date('2026-01-05T09:00:00.000Z');

	describe('a Date', () => {
		it('is a value when it holds a time', () => {
			expect(isEmpty(date)).toBe(false);
			expect(isNotEmpty(date)).toBe(true);
			// The epoch is a time too (getTime() === 0), unlike the number 0.
			expect(isEmpty(new Date(0))).toBe(false);
		});

		it('is empty when it holds no time (an invalid date)', () => {
			expect(isEmpty(new Date('not a date'))).toBe(true);
			expect(isNotEmpty(new Date(Number.NaN))).toBe(false);
		});

		it('counts in a list as any value does', () => {
			expect(isEmpty([date])).toBe(false);
			expect(isEmpty([date, new Date('2026-01-05T09:10:00.000Z')])).toBe(false);
			expect(isEmpty([new Date('not a date')])).toBe(true);
		});

		it('is a value inside an object, as before', () => {
			expect(isEmpty({ startedAt: date })).toBe(false);
		});
	});

	describe('CONTROL: everything else answers what it answered before', () => {
		it.each([null, undefined, '', 'null', 'undefined', 'NULL', 0, false, Number.NaN])('%p is empty', (value) => {
			expect(isEmpty(value)).toBe(true);
			expect(isNotEmpty(value)).toBe(false);
		});

		it.each(['x', 'false', 1, -1, true])('%p is a value', (value) => {
			expect(isEmpty(value)).toBe(false);
			expect(isNotEmpty(value)).toBe(true);
		});

		it('reads a list by its non-empty members', () => {
			expect(isEmpty([])).toBe(true);
			expect(isEmpty([null, undefined, ''])).toBe(true);
			expect(isEmpty([null, 'x'])).toBe(false);
			expect(isEmpty([[], {}])).toBe(true);
		});

		it('reads an object by its members that hold something', () => {
			expect(isEmpty({})).toBe(true);
			expect(isEmpty({ a: null, b: undefined, c: '' })).toBe(true);
			expect(isEmpty({ a: 0 })).toBe(false);
			expect(isEmpty({ a: 'x' })).toBe(false);
		});

		it('does not change the object it reads', () => {
			const object = { a: null, b: 'x' };

			isEmpty(object);

			expect(object).toEqual({ a: null, b: 'x' });
		});
	});
});
