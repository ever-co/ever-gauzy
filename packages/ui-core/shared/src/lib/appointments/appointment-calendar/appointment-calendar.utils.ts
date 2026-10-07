/**
 * The days of the current week that are already over, as FullCalendar `hiddenDays` (0 = Sunday … 6 = Saturday).
 *
 * The week runs from `firstDay` (the organization's start of week); every day from there up to, but excluding,
 * `today` is hidden. On the first day of the week nothing is hidden. The previous version counted down from
 * yesterday to Sunday regardless of the week start: on a Sunday that hid all seven days (FullCalendar rejects
 * that), and on any other day it hid the coming Sunday of a Monday-based week.
 *
 * @param firstDay - The first day of the week (0 = Sunday … 6 = Saturday).
 * @param today - Today's day of the week (0 = Sunday … 6 = Saturday).
 */
export function pastDaysOfCurrentWeek(firstDay: number, today: number): number[] {
	let days: number[] = [];
	for (let day = firstDay; day !== today; day = (day + 1) % 7) {
		days.push(day);
	}
	return days;
}
