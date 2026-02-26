/** Converts total seconds to HH:mm:ss */
export function formatDuration(totalSeconds: number): string {
	const s = Math.max(0, Math.round(totalSeconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/** Pads a number with leading zeros to ensure it's at least 2 digits */
export function pad(n: number): string {
	return String(n).padStart(2, '0');
}

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

/** Returns { todayStart, todayEnd } for today in local time */
export function todayRange(): { todayStart: Date; todayEnd: Date } {
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const end = new Date();
	end.setHours(23, 59, 59, 999);
	return { todayStart: start, todayEnd: end };
}
