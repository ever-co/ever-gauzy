/** Returns { startDate, endDate } for the current week (Monday–Sunday) in local time */
export function currentWeekRange(): { startDate: Date; endDate: Date } {
	const now = new Date();
	const day = now.getDay(); // 0 = Sun, 1 = Mon …
	const diffToMonday = day === 0 ? -6 : 1 - day;

	const monday = new Date(now);
	monday.setDate(now.getDate() + diffToMonday);
	monday.setHours(0, 0, 0, 0);

	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 6);
	sunday.setHours(23, 59, 59, 999);

	return { startDate: monday, endDate: sunday };
}
