import {
	calendarDayOf,
	calendarSpan,
	holidayDaysWithin,
	knownTimeZone,
	workingDaysByYear,
	yearsOf
} from './working-days';

/**
 * The working days a time-off request takes from a leave balance (issue #10183): weekdays from its first to its last
 * day, both included, less the organization's official holidays, split per calendar year.
 */
describe('working days of a time-off request', () => {
	describe('calendarDayOf', () => {
		it('reads a stored local midnight as the day it was picked on, in the zone it was picked in', () => {
			// "2 November" picked in Berlin (UTC+1 in November) is stored as 23:00 UTC the day before.
			expect(calendarDayOf(new Date('2026-11-01T23:00:00.000Z'), 'Europe/Berlin')).toBe('2026-11-02');
			// "2 November" picked in New York (UTC-5) is stored as 05:00 UTC the same day.
			expect(calendarDayOf('2026-11-02T05:00:00.000Z', 'America/New_York')).toBe('2026-11-02');
			// A SQL timestamp string is UTC, as the column stores it.
			expect(calendarDayOf('2026-11-01 23:00:00.000', 'Europe/Berlin')).toBe('2026-11-02');
		});

		it('reads a picker midnight from another zone as the nearest midnight, so the picked day survives', () => {
			// A Berlin browser's "2 November", read in a UTC organization: 23:00 the evening before, nearest to 2 November.
			expect(calendarDayOf('2026-11-01T23:00:00.000Z', 'UTC')).toBe('2026-11-02');
			// A New York browser's "2 November" (05:00 UTC), read in Berlin: 06:00 on 2 November.
			expect(calendarDayOf('2026-11-02T05:00:00.000Z', 'Europe/Berlin')).toBe('2026-11-02');
			// A Sydney browser's "2 November" (13:00 UTC on 1 November), read in UTC: eleven hours before midnight.
			expect(calendarDayOf('2026-11-01T13:00:00.000Z', 'UTC')).toBe('2026-11-02');
			// The tolerance is twelve hours: read in Los Angeles (05:00 on 1 November), the same value is 1 November.
			// That is why the reading zone is the filer's own, when the server knows it.
			expect(calendarDayOf('2026-11-01T13:00:00.000Z', 'America/Los_Angeles')).toBe('2026-11-01');
		});

		it('reads an end stored as the last instant of its day as that day, in any zone', () => {
			// 23:59:59.999 on Friday 6 November in Berlin, read in Berlin and in UTC.
			expect(calendarDayOf('2026-11-06T22:59:59.999Z', 'Europe/Berlin', 'end')).toBe('2026-11-06');
			expect(calendarDayOf('2026-11-06T22:59:59.999Z', 'UTC', 'end')).toBe('2026-11-06');
			// 23:59:59 on Friday 6 November in New York, read in Berlin.
			expect(calendarDayOf('2026-11-07T04:59:59.000Z', 'Europe/Berlin', 'end')).toBe('2026-11-06');
			// 23:59:59 UTC.
			expect(calendarDayOf('2026-11-06T23:59:59.000Z', 'UTC', 'end')).toBe('2026-11-06');
			// The same instant as a start is the next day's midnight, as any start near it would be.
			expect(calendarDayOf('2026-11-06T23:59:59.000Z', 'UTC', 'start')).toBe('2026-11-07');
		});

		it('keeps a date-only value as the day it names, whatever the zone', () => {
			expect(calendarDayOf('2026-11-02', 'America/New_York')).toBe('2026-11-02');
			expect(calendarDayOf('2026-11-02', 'Asia/Tokyo')).toBe('2026-11-02');
		});

		it.each([[null], [undefined], [''], ['not a date'], ['2026-02-30']])('answers null for %p', (value) => {
			expect(calendarDayOf(value as any, 'UTC')).toBeNull();
		});
	});

	describe('knownTimeZone', () => {
		it('keeps a zone moment knows, and reads anything else as UTC', () => {
			expect(knownTimeZone('Europe/Berlin')).toBe('Europe/Berlin');
			expect(knownTimeZone('Europe/Berln')).toBe('UTC');
			expect(knownTimeZone('')).toBe('UTC');
			expect(knownTimeZone(undefined)).toBe('UTC');
		});
	});

	describe('calendarSpan', () => {
		it('names the first and last day, both included, and how many days that is', () => {
			const span = calendarSpan('2026-12-30', '2027-01-02', 'UTC');

			expect(span).toEqual({ first: '2026-12-30', last: '2027-01-02', days: 4 });
			expect(yearsOf(span)).toEqual([2026, 2027]);
		});

		it('answers null for a request that ends before it starts, has no dates, or names a five-digit year', () => {
			expect(calendarSpan('2026-11-05', '2026-11-02', 'UTC')).toBeNull();
			expect(calendarSpan(null, '2026-11-02', 'UTC')).toBeNull();
			expect(calendarSpan('2026-11-02', '+010000-01-01T00:00:00.000Z', 'UTC')).toBeNull();
		});
	});

	describe('workingDaysByYear', () => {
		it('counts the weekdays of a week, Monday to Friday, and leaves the weekend out', () => {
			// Monday 2 November 2026 to Sunday 8 November 2026.
			expect(workingDaysByYear('2026-11-02', '2026-11-08', { timeZone: 'UTC' })).toEqual([
				{ year: 2026, days: 5 }
			]);
		});

		it('counts one day for a request of one weekday, and none for a weekend', () => {
			expect(workingDaysByYear('2026-11-04', '2026-11-04', { timeZone: 'UTC' })).toEqual([
				{ year: 2026, days: 1 }
			]);
			expect(workingDaysByYear('2026-11-07', '2026-11-08', { timeZone: 'UTC' })).toEqual([]);
		});

		it('counts the days a Berlin employee picked, read in Berlin or in a UTC organization alike', () => {
			// Monday 2 to Friday 6 November, picked in Berlin: 23:00 UTC the day before each.
			const start = new Date('2026-11-01T23:00:00.000Z');
			const end = new Date('2026-11-05T23:00:00.000Z');

			expect(workingDaysByYear(start, end, { timeZone: 'Europe/Berlin' })).toEqual([{ year: 2026, days: 5 }]);
			// Read on the clock alone in UTC, these would run Sunday to Thursday: four days, one of them wrong.
			expect(workingDaysByYear(start, end, { timeZone: 'UTC' })).toEqual([{ year: 2026, days: 5 }]);
		});

		it('counts the days a New York employee picked, read in a Berlin organization', () => {
			// Monday 2 to Friday 6 November, picked in New York: 05:00 UTC each day.
			expect(
				workingDaysByYear('2026-11-02T05:00:00.000Z', '2026-11-06T05:00:00.000Z', { timeZone: 'Europe/Berlin' })
			).toEqual([{ year: 2026, days: 5 }]);
		});

		it('counts an end stored as the end of its day as that day, not the next', () => {
			// Monday 2 November, 00:00 to Friday 6 November, 23:59:59.999 in Berlin.
			expect(
				workingDaysByYear('2026-11-01T23:00:00.000Z', '2026-11-06T22:59:59.999Z', { timeZone: 'Europe/Berlin' })
			).toEqual([{ year: 2026, days: 5 }]);
			// Friday 6 to Sunday 8 November, 23:59:59 UTC: the weekend adds nothing.
			expect(
				workingDaysByYear('2026-11-06T00:00:00.000Z', '2026-11-08T23:59:59.000Z', { timeZone: 'UTC' })
			).toEqual([{ year: 2026, days: 1 }]);
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

		it('does not take a holiday on a weekend off twice, nor two holidays on one day', () => {
			const holidays = [
				{ date: '2026-11-07', isRecurring: false },
				{ date: '2026-11-04', isRecurring: false },
				{ date: '1999-11-04', isRecurring: true }
			];

			expect(workingDaysByYear('2026-11-02', '2026-11-08', { timeZone: 'UTC', holidays })).toEqual([
				{ year: 2026, days: 4 }
			]);
		});

		it('splits a request across 31 December between the two years', () => {
			// Monday 28 December 2026 to Friday 8 January 2027.
			expect(workingDaysByYear('2026-12-28', '2027-01-08', { timeZone: 'UTC' })).toEqual([
				{ year: 2026, days: 4 },
				{ year: 2027, days: 6 }
			]);
		});

		it('counts whole weeks and the days left over the same as a day-by-day count would', () => {
			// 1 January to 31 December 2026: 261 weekdays (the year starts on a Thursday).
			expect(workingDaysByYear('2026-01-01', '2026-12-31', { timeZone: 'UTC' })).toEqual([
				{ year: 2026, days: 261 }
			]);
			// 29 days from a Saturday: four weeks (20 weekdays) and a Saturday.
			expect(workingDaysByYear('2026-10-31', '2026-11-28', { timeZone: 'UTC' })).toEqual([
				{ year: 2026, days: 20 }
			]);
		});

		it('takes the weekend days an organization names', () => {
			// A Friday / Saturday weekend: Sunday 1 to Saturday 7 November 2026 has five working days.
			expect(workingDaysByYear('2026-11-01', '2026-11-07', { timeZone: 'UTC', weekendDays: [5, 6] })).toEqual([
				{ year: 2026, days: 5 }
			]);
		});

		it('answers nothing for a request without dates, or that ends before it starts', () => {
			expect(workingDaysByYear(undefined, '2026-11-08')).toEqual([]);
			expect(workingDaysByYear('2026-11-08', '2026-11-02', { timeZone: 'UTC' })).toEqual([]);
		});

		it('counts a request a thousand years long without walking its days', () => {
			const holidays = [
				{ date: '2001-12-25', isRecurring: true },
				{ date: '2001-01-01', isRecurring: true }
			];
			const startedAt = Date.now();

			const years = workingDaysByYear('2026-01-01', '3025-12-31', { timeZone: 'UTC', holidays });

			expect(Date.now() - startedAt).toBeLessThan(1000);
			expect(years).toHaveLength(1000);
			expect(years[0]).toEqual({ year: 2026, days: 261 - 2 });
			expect(years.every(({ days }) => days >= 258 && days <= 262)).toBe(true);
		});
	});

	describe('holidayDaysWithin', () => {
		it('reads a stored Date as the day it holds, and ignores a holiday without a date', () => {
			expect(
				holidayDaysWithin(
					[
						{ date: new Date(2026, 10, 3), isRecurring: false },
						{ date: null as any, isRecurring: true }
					],
					'2026-11-01',
					'2026-11-30'
				)
			).toEqual(['2026-11-03']);
		});

		it('keeps only the days inside the range, each once and in order', () => {
			expect(
				holidayDaysWithin(
					[
						{ date: '2026-11-20', endDate: '2026-12-02', isRecurring: false },
						{ date: '2026-11-25', isRecurring: false }
					],
					'2026-11-28',
					'2026-11-30'
				)
			).toEqual(['2026-11-28', '2026-11-29', '2026-11-30']);
		});

		it('recurs 29 February in leap years only', () => {
			const holidays = [{ date: '2024-02-29', isRecurring: true }];

			expect(holidayDaysWithin(holidays, '2028-02-01', '2028-03-31')).toEqual(['2028-02-29']);
			expect(holidayDaysWithin(holidays, '2027-02-01', '2027-03-31')).toEqual([]);
		});

		it('covers 29 February in a leap year with a recurring range entered in a common year across it', () => {
			const holidays = [{ date: '2027-02-28', endDate: '2027-03-01', isRecurring: true }];

			expect(holidayDaysWithin(holidays, '2028-02-27', '2028-03-02')).toEqual([
				'2028-02-28',
				'2028-02-29',
				'2028-03-01'
			]);
			// Tuesday 29 February 2028 takes no leave.
			expect(workingDaysByYear('2028-02-29', '2028-02-29', { timeZone: 'UTC', holidays })).toEqual([]);
		});

		it('does not make 29 February a holiday from two separate recurring holidays on 28 February and 1 March', () => {
			const holidays = [
				{ date: '2027-02-28', isRecurring: true },
				{ date: '2027-03-01', isRecurring: true }
			];

			expect(holidayDaysWithin(holidays, '2028-02-27', '2028-03-02')).toEqual(['2028-02-28', '2028-03-01']);
			// Tuesday 29 February 2028 is a working day.
			expect(workingDaysByYear('2028-02-29', '2028-02-29', { timeZone: 'UTC', holidays })).toEqual([
				{ year: 2028, days: 1 }
			]);
		});

		it('reads an end before the start as a single-day holiday', () => {
			expect(
				holidayDaysWithin(
					[{ date: '2026-11-03', endDate: '2026-11-01', isRecurring: false }],
					'2026-11-01',
					'2026-11-30'
				)
			).toEqual(['2026-11-03']);
		});
	});
});
