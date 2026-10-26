import { pastDaysOfCurrentWeek } from './appointment-calendar.utils';

describe('pastDaysOfCurrentWeek', () => {
	const MONDAY = 1;
	const SUNDAY = 0;

	it('hides the days of the week that are over, from the start of the week to yesterday', () => {
		// Monday-based week, today is Thursday (4)
		expect(pastDaysOfCurrentWeek(MONDAY, 4)).toEqual([1, 2, 3]);
	});

	it('hides nothing on the first day of the week', () => {
		expect(pastDaysOfCurrentWeek(MONDAY, MONDAY)).toEqual([]);
		expect(pastDaysOfCurrentWeek(SUNDAY, SUNDAY)).toEqual([]);
	});

	it('never hides all seven days: a Sunday in a Monday-based week keeps Sunday itself', () => {
		expect(pastDaysOfCurrentWeek(MONDAY, SUNDAY)).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it('does not hide the coming days: Sunday stays visible on a Monday-based week', () => {
		expect(pastDaysOfCurrentWeek(MONDAY, 2)).not.toContain(SUNDAY);
	});

	it('follows a Sunday-based week', () => {
		// Sunday-based week, today is Tuesday (2)
		expect(pastDaysOfCurrentWeek(SUNDAY, 2)).toEqual([0, 1]);
	});
});
