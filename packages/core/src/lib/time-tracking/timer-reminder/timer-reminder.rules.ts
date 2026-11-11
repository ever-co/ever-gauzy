import { IEmployeeNotificationPreferences } from '@gauzy/contracts';

/**
 * The rules of the reminders about a timer left running (ever-co/ever-teams#5022): one once the timer ran for the
 * employee's threshold, one more at twice that, never a third. Pure, so the sweep and its specs read them alike, and
 * the same as the Ever Teams tab that shows these reminders itself while it is open
 * (`apps/web/core/lib/notifications/timer-reminders.ts` there).
 */

/** The threshold when the employee chose none: a working day. */
export const DEFAULT_TIMER_REMINDER_HOURS = 8;

/** The longest threshold that reads as one: a day. */
export const MAX_TIMER_REMINDER_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

/** 1: the timer reached the threshold; 2: twice the threshold, probably forgotten. */
export type TimerReminderLevel = 1 | 2;

/** The longest task title quoted in a reminder's title, which is stored in a column of 255 characters on MySQL. */
const MAX_QUOTED_TITLE_LENGTH = 120;

/** The `preferences` of a notification setting, stored as an object or as its JSON (SQLite). */
export function notificationPreferencesOf(raw: unknown): IEmployeeNotificationPreferences {
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
		return raw as IEmployeeNotificationPreferences;
	}
	if (typeof raw === 'string' && raw.trim()) {
		try {
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
				? (parsed as IEmployeeNotificationPreferences)
				: {};
		} catch {
			return {};
		}
	}
	return {};
}

/**
 * The employee's threshold in hours, or null when they turned the reminders off (`timerReminderHours` null or 0). It is
 * kept to the hundredth, as the title names it (`1.23 hours`), since Ever Teams reads it back from the title: a value
 * that is missing, not a number, or not in (0, 24] once so rounded (0.004 would read `0 hours`) is the default, as in
 * the Ever Teams settings that write it.
 *
 * @param preferences The `preferences` of the employee's notification setting (an object or its JSON).
 */
export function timerReminderHoursOf(preferences: unknown): number | null {
	const hours = notificationPreferencesOf(preferences).timerReminderHours;
	if (hours === null || hours === 0) {
		return null;
	}
	const named = typeof hours === 'number' && Number.isFinite(hours) ? Number(hours.toFixed(2)) : Number.NaN;
	return named > 0 && named <= MAX_TIMER_REMINDER_HOURS ? named : DEFAULT_TIMER_REMINDER_HOURS;
}

/** The reminder a run has reached after running `elapsedMs`: 0 before the threshold. */
export function timerReminderLevelAt(elapsedMs: number, hours: number): 0 | TimerReminderLevel {
	if (!Number.isFinite(elapsedMs) || !(hours > 0)) {
		return 0;
	}
	if (elapsedMs >= 2 * hours * HOUR_MS) {
		return 2;
	}
	return elapsedMs >= hours * HOUR_MS ? 1 : 0;
}

/**
 * The instant of a stored time, in milliseconds (NaN when there is none). A raw SQLite read answers the text TypeORM
 * wrote, the UTC time without its zone (`2026-11-11 08:00:00.000`), which `Date` would read as local time.
 */
export function instantOf(value: Date | string | null | undefined): number {
	if (value instanceof Date) {
		return value.getTime();
	}
	if (typeof value !== 'string' || !value.trim()) {
		return Number.NaN;
	}
	const text = value.trim();
	const withoutZone = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text);
	return new Date(withoutZone ? `${text.replace(' ', 'T')}Z` : text).getTime();
}

/** `8 hours`, `1 hour`, `1.5 hours`. */
function hoursText(hours: number): string {
	const rounded = Number(hours.toFixed(2));
	return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
}

/**
 * The title and message of a reminder, in English as the platform's other notification titles are. Ever Teams reads the
 * level and the hours back from the title to show it in the reader's language (`timerReminderNoticeOf` there): the
 * notification has no field of its own for them. The titles are a contract, pinned word for word by a test on each
 * side ("the titles Ever Teams reads back" here, "the titles Gauzy files" there): change both, or neither.
 *
 * - Level 1: `Your timer has been running for 8 hours`;
 * - Level 2: `Your timer is still running after 16 hours`;
 *
 * followed by ` on "<task title>"` when the run has a task, which the clients show as the entry's subject.
 *
 * @param level The reminder.
 * @param hours The employee's threshold (level 2 names twice it).
 * @param taskTitle The title of the run's task, if any.
 */
export function timerReminderNotice(
	level: TimerReminderLevel,
	hours: number,
	taskTitle?: string | null
): { title: string; message: string } {
	const opening =
		level === 1
			? `Your timer has been running for ${hoursText(hours)}`
			: `Your timer is still running after ${hoursText(hours * 2)}`;
	const task = (taskTitle ?? '').replace(/\s+/g, ' ').trim();
	const quoted =
		task.length > MAX_QUOTED_TITLE_LENGTH ? `${task.slice(0, MAX_QUOTED_TITLE_LENGTH - 1).trimEnd()}…` : task;
	return {
		title: quoted ? `${opening} on "${quoted}"` : opening,
		message:
			level === 1
				? 'Stop it if you are done, or keep it running.'
				: 'Did you forget it? Stop it, then correct the time in your timesheet if needed.'
	};
}
