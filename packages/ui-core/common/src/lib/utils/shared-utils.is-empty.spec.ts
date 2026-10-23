import { isEmpty, isNotEmpty } from './shared-utils';

/**
 * `isEmpty` / `isNotEmpty` from `@gauzy/ui-core/common` decide "is there a value" for the Angular apps, so what
 * they answer for each kind of input is pinned here, the same way `@gauzy/utils` pins its copy (#10780). A `Date`
 * has no own enumerable property, so the object branch read EVERY date as empty, and a list of dates as an empty
 * list. No Angular call site hands it a bare date today (the date-range picker passes `{ startDate, endDate }`,
 * which already counted as a value), so this keeps the first one that does from silently skipping it.
 */
describe('isEmpty / isNotEmpty (@gauzy/ui-core/common)', () => {
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
		it('reads a date range by its members, as the date-range picker relies on', () => {
			expect(isNotEmpty({ startDate: date, endDate: date, isCustomDate: false })).toBe(true);
			expect(isNotEmpty({ startDate: null, endDate: undefined })).toBe(false);
		});

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
