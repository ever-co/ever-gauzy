import moment from 'moment';
import type { IDateRangePicker } from '@gauzy/contracts';
import { Next } from './next.strategy';
import { Previous } from './previous.strategy';

/** Ranges are compared as calendar days; the times either side are start/end of day. */
const days = ({ startDate, endDate }: IDateRangePicker): [string, string] => [
	moment(startDate).format('YYYY-MM-DD'),
	moment(endDate).format('YYYY-MM-DD')
];

/** A range built from LOCAL parts (month is 0-indexed), so the days are the same in every zone. */
const range = (
	start: [number, number, number],
	end: [number, number, number],
	isCustomDate = false
): IDateRangePicker => ({
	startDate: new Date(start[0], start[1], start[2]),
	endDate: new Date(end[0], end[1], end[2], 23, 59, 59, 999),
	isCustomDate
});

describe('the header arrows step a year at a time after a year preset', () => {
	const next = new Next();
	const previous = new Previous();

	it('"next" after "Last Year" selects the whole of the following year', () => {
		const lastYear = range([2025, 0, 1], [2025, 11, 31]);

		expect(days(next.action(lastYear, 'year'))).toEqual(['2026-01-01', '2026-12-31']);
	});

	it('"previous" after "Current Year" selects the whole year before', () => {
		const currentYear = range([2026, 0, 1], [2026, 11, 31]);

		expect(days(previous.action(currentYear, 'year'))).toEqual(['2025-01-01', '2025-12-31']);
	});

	it('"previous" from a year cut short at today still lands on the whole year before', () => {
		// "Current Year" where future dates are not allowed ends on today.
		const currentYearToDate = range([2026, 0, 1], [2026, 8, 23]);

		expect(days(previous.action(currentYearToDate, 'year'))).toEqual(['2025-01-01', '2025-12-31']);
	});

	it('crosses a leap year whole', () => {
		const year2023 = range([2023, 0, 1], [2023, 11, 31]);

		expect(days(next.action(year2023, 'year'))).toEqual(['2024-01-01', '2024-12-31']);
	});

	it('steps a custom range by its own span, whatever the unit', () => {
		const custom = range([2026, 8, 7], [2026, 8, 11], true);

		expect(days(next.action(custom, 'year'))).toEqual(['2026-09-12', '2026-09-16']);
	});
});
