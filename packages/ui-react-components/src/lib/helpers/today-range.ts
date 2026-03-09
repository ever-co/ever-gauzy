/** Returns { todayStart, todayEnd } for today in local time */
export function todayRange(): { todayStart: Date; todayEnd: Date } {
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const end = new Date();
	end.setHours(23, 59, 59, 999);
	return { todayStart: start, todayEnd: end };
}
