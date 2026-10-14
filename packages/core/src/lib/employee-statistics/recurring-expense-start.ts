import * as moment from 'moment';

/**
 * The month a recurring expense starts being counted from: its own start date, or the start of the
 * requested range, whichever is later.
 *
 * The range start reaches the statistics as an ISO string (query JSON / DTO without transform), and
 * comparing the expense's Date with it (`Date > string`) was always false, so an expense starting in
 * the middle of the range was counted for every month before it as well.
 */
export function recurringExpenseStart(expenseStartDate: Date | string, rangeStartDate: Date | string): Date {
	const expenseStart = new Date(expenseStartDate);
	const rangeStart = new Date(rangeStartDate);
	return expenseStart > rangeStart ? expenseStart : rangeStart;
}

/**
 * One date per month, from `startDate` to `endDate` (inclusive), each on the start date's day of the month.
 *
 * Counted from the start date rather than by `setMonth` on the previous date: a start on the 31st rolled
 * from January 31 to March 3 (no February 31), skipping February; this clamps it to the month's last day.
 */
export function recurringExpenseMonths(startDate: Date | string, endDate: Date | string): Date[] {
	const start = moment(startDate);
	const end = moment(endDate);
	const months: Date[] = [];
	for (let month = start.clone(); month.isSameOrBefore(end); month = start.clone().add(months.length, 'months')) {
		months.push(month.toDate());
	}
	return months;
}
