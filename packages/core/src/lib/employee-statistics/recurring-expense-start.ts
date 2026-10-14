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
