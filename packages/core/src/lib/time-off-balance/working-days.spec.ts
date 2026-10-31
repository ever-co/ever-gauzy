import { calendarDayOf, calendarDaysBetween, holidayMatcher, workingDaysByYear } from './working-days';

/**
 * The working days a time-off request takes from a leave balance (issue #10183): weekdays from its first to its last
 * day, both included, less the organization's official holidays, split per calendar year.
 */
describe('working days of a time-off request', () => {
	describe('calendarDayOf', () => {
		it('reads a stored local midnight as the day it was picked on, in the organization zone', () => {
			// "2 November" picked in Berlin (UTC+1 in November) is stored as 23:00 UTC the day before.
			expect(calendarDayOf(new Date('2026-11-01T23:00:00.000Z'), 'Europe/Berlin')).toBe('2026-11-02');
			// "2 November" picked in New York (UTC-5) is stored as 05:00 UTC the same day.
			expect(calendarDayOf('2026-11-02T05:00:00.000Z', 'America/New_York')).toBe('2026-11-02');
			// A SQL timestamp string is UTC, as the column stores it.
			expect(calendarDayOf('2026-11-01 23:00:00.000', 'Europe/Berlin')).toBe('2026-11-02');
		});

		it('keeps a date-only value as the day it names, whatever the zone', () => {
			expect(calendarDayOf('2026-11-02', 'America/New_York')).toBe('2026-11-02');
			expect(calendarDayOf('2026-11-02', 'Asia/Tokyo')).toBe('2026-11-02');
		});

		it.each([[null], [undefined], [''], ['not a date'], ['2026-02-30']])('answers null for %p', (value) => {
			expect(calendarDayOf(value as any, 'UTC')).toBeNull();
		});
	});

	describe('calendarDaysBetween', () => {
		it('lists every day, both bounds included', () => {
			expect(calendarDaysBetween('2026-12-30', '2027-01-02', 'UTC')).toEqual([
				'2026-12-30',
				'2026-12-31',
				'2027-01-01',
				'2027-01-02'
			]);
		});

		it('lists nothing for a request that ends before it starts, or has no dates', () => {
			expect(calendarDaysBetween('2026-11-05', '2026-11-02', 'UTC')).toEqual([]);
			expect(calendarDaysBetween(null, '2026-11-02', 'UTC')).toEqual([]);
		});
	});

	describe('workingDaysByYear', () => {
		it('counts the weekdays of a week, Monday to Friday, and leaves the weekend out', () => {
			// Monday 2 November 2026 to Sunday 8 November 2026.
			expect(workingDaysByYear('2026-11-02', '2026-11-08', { timeZone: 'UTC' })).toEqual([{ year: 2026, days: 5 }]);
		});

		it('counts one day for a request of one weekday, and none for a weekend', () => {
			expect(workingDaysByYear('2026-11-04', '2026-11-04', { timeZone: 'UTC' })).toEqual([{ year: 2026, days: 1 }]);
			expect(workingDaysByYear('2026-11-07', '2026-11-08', { timeZone: 'UTC' })).toEqual([]);
		});

		it('counts the days the forms stored as local midnights in the organization zone', () => {
			// Monday 2 to Friday 6 November, picked in Berlin: 23:00 UTC the day before each.
			const start = new Date('2026-11-01T23:00:00.000Z');
			const end = new Date('2026-11-05T23:00:00.000Z');

			expect(workingDaysByYear(start, end, { timeZone: 'Europe/Berlin' })).toEqual([{ year: 2026, days: 5 }]);
			// Read as UTC, the same request would run Sunday to Thursday: four working days, one of them wrong.
			expect(workingDaysByYear(start, end, { timeZone: 'UTC' })).toEqual([{ year: 2026, days: 4 }]);
		});

		it('leaves out one-off official holidays, single and multi-day', () => {
			const holidays = [
				{ date: '2026-11-03', isRecurring: false },
				{ date: '2026-11-05', endDate: '2026-11-06', isRecurring: false },
				// Another year's one-off holiday on the same day does not count.
				{ date: '2025-11-04', isRecurring: false }
			];

			expect(workingDaysByYear('2026-11-02', '2026-11-08', { timeZone: 'UTC', holidays })).toEqual([
				{ year: 2026, days: 2 }
			]);
		});

		it('leaves out a recurring holiday in every year, the one it was entered for and the ones before it', () => {
			const holidays = [{ date: '2030-12-25', isRecurring: true }];

			// Friday 25 December 2026.
			expect(workingDaysByYear('2026-12-21', '2026-12-25', { timeZone: 'UTC', holidays })).toEqual([
				{ year: 2026, days: 4 }
			]);
		});

		it('leaves out a recurring holiday that spans New Year in both years', () => {
			const holidays = [{ date: '2020-12-31', endDate: '2021-01-01', isRecurring: true }];

			// Thursday 31 December 2026 and Friday 1 January 2027 are both holidays.
			expect(workingDaysByYear('2026-12-30', '2027-01-04', { timeZone: 'UTC', holidays })).toEqual([
				{ year: 2026, days: 1 },
				{ year: 2027, days: 1 }
			]);
		});

		it('does not take a holiday on a weekend off twice', () => {
			const holidays = [{ date: '2026-11-07', isRecurring: false }];

			expect(workingDaysByYear('2026-11-02', '2026-11-08', { timeZone: 'UTC', holidays })).toEqual([
				{ year: 2026, days: 5 }
			]);
		});

		it('splits a request across 31 December between the two years', () => {
			// Monday 28 December 2026 to Friday 8 January 2027.
			expect(workingDaysByYear('2026-12-28', '2027-01-08', { timeZone: 'UTC' })).toEqual([
				{ year: 2026, days: 4 },
				{ year: 2027, days: 6 }
			]);
		});

		it('takes the weekend days an organization names', () => {
			// A Friday / Saturday weekend: Sunday 1 to Saturday 7 November 2026 has five working days.
			expect(
				workingDaysByYear('2026-11-01', '2026-11-07', { timeZone: 'UTC', weekendDays: [5, 6] })
			).toEqual([{ year: 2026, days: 5 }]);
		});

		it('answers nothing for a request without dates, or that ends before it starts', () => {
			expect(workingDaysByYear(undefined, '2026-11-08')).toEqual([]);
			expect(workingDaysByYear('2026-11-08', '2026-11-02', { timeZone: 'UTC' })).toEqual([]);
		});
	});

	describe('holidayMatcher', () => {
		it('reads a stored Date as the day it holds, and ignores a holiday without a date', () => {
			const isHoliday = holidayMatcher([
				{ date: new Date(2026, 10, 3), isRecurring: false },
				{ date: null as any, isRecurring: true }
			]);

			expect(isHoliday('2026-11-03')).toBe(true);
			expect(isHoliday('2026-11-04')).toBe(false);
		});

		it('recurs 29 February in leap years only', () => {
			const isHoliday = holidayMatcher([{ date: '2024-02-29', isRecurring: true }]);

			expect(isHoliday('2028-02-29')).toBe(true);
			expect(isHoliday('2027-02-28')).toBe(false);
			expect(isHoliday('2027-03-01')).toBe(false);
		});

		it('reads an end before the start as a single-day holiday', () => {
			const isHoliday = holidayMatcher([{ date: '2026-11-03', endDate: '2026-11-01', isRecurring: false }]);

			expect(isHoliday('2026-11-03')).toBe(true);
			expect(isHoliday('2026-11-02')).toBe(false);
		});
	});
});
