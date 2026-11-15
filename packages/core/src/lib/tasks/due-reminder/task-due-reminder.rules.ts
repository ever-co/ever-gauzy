import * as moment from 'moment';
import 'moment-timezone';
import { instantOf, notificationPreferencesOf } from '../../time-tracking/timer-reminder/timer-reminder.rules';

/**
 * The rules of the reminders about a task's due date (ever-co/ever-teams#5022): each assignee is told once, a number of
 * hours before the task is due, as long as it is not done. Pure, so the sweep and its specs read them alike.
 */

/** The threshold when the employee chose none: a day. */
export const DEFAULT_TASK_DUE_REMINDER_HOURS = 24;

/** The longest threshold that reads as one: a week. */
export const MAX_TASK_DUE_REMINDER_HOURS = 7 * 24;

const HOUR_MS = 60 * 60 * 1000;

/** The longest task title quoted in a reminder's title, which is stored in a column of 255 characters on MySQL. */
const MAX_QUOTED_TITLE_LENGTH = 120;

/**
 * The employee's threshold in hours, or null when they turned the reminders off (`taskDueReminderHours` null or 0). A
 * value that is missing, not a number, or not in (0, 168] is the default, as in the Ever Teams settings that write it.
 *
 * @param preferences The `preferences` of the employee's notification setting (an object or its JSON).
 */
export function taskDueReminderHoursOf(preferences: unknown): number | null {
	const hours = notificationPreferencesOf(preferences).taskDueReminderHours;
	if (hours === null || hours === 0) {
		return null;
	}
	const named = typeof hours === 'number' && Number.isFinite(hours) ? Number(hours.toFixed(2)) : Number.NaN;
	return named > 0 && named <= MAX_TASK_DUE_REMINDER_HOURS ? named : DEFAULT_TASK_DUE_REMINDER_HOURS;
}

/**
 * Whether a stored due date names a calendar day rather than a moment: midnight UTC exactly, the form Ever Teams saves
 * a picked day in (`taskDateChangesOf` there), so every reader sees the day that was picked whatever their zone.
 */
export function isDayOnlyDueDate(dueDate: Date | string | null | undefined): boolean {
	const instant = instantOf(dueDate);
	return Number.isFinite(instant) && instant % (24 * HOUR_MS) === 0;
}

/** A time zone moment knows, else UTC. */
export function knownTimeZoneOf(timeZone: string | null | undefined): string {
	return timeZone && moment.tz.zone(timeZone) ? timeZone : 'UTC';
}

/**
 * The moment a task is due for a person, in milliseconds (NaN when it has no due date). A due date that names a day is
 * due once that day is over in the person's time zone, so a task due "Friday" is still open all of their Friday; one
 * that names a moment is due at that moment, whatever the zone.
 *
 * @param dueDate The task's due date, as a driver hands it (a raw SQLite read answers UTC text without its zone).
 * @param timeZone The person's time zone.
 */
export function taskDueMomentOf(
	dueDate: Date | string | null | undefined,
	timeZone: string | null | undefined
): number {
	const instant = instantOf(dueDate);
	if (!Number.isFinite(instant)) {
		return Number.NaN;
	}
	if (!isDayOnlyDueDate(dueDate)) {
		return instant;
	}
	// The start of the next calendar day in the person's zone, read from that day itself. A picked day whose midnight a
	// DST change skips (Asia/Amman, 2021-03-26) starts at 01:00, and a day added to that start ended it an hour late.
	const nextDay = moment.utc(instant).add(1, 'day').format('YYYY-MM-DD');
	return moment.tz(nextDay, knownTimeZoneOf(timeZone)).valueOf();
}

/**
 * Whether the reminder of a task is due at `now`: less than `hours` before the task is due, and not after it (a sweep
 * that comes back once the task is due says nothing: the moment has passed).
 *
 * @param dueMoment The moment the task is due for the person (see {@link taskDueMomentOf}).
 * @param hours The person's threshold.
 * @param now The moment the sweep runs at.
 */
export function isTaskDueReminderDue(dueMoment: number, hours: number, now: number): boolean {
	if (!Number.isFinite(dueMoment) || !(hours > 0)) {
		return false;
	}
	return now >= dueMoment - hours * HOUR_MS && now < dueMoment;
}

/** `in 3 hours`, `in 1 hour`, `in less than an hour`, `in 2 days`. */
function timeLeftText(msLeft: number): string {
	const hours = Math.floor(msLeft / HOUR_MS);
	if (hours < 1) {
		return 'in less than an hour';
	}
	if (hours < 48) {
		return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
	}
	const days = Math.floor(hours / 24);
	return `in ${days} days`;
}

/**
 * The title and message of a reminder, in English as the platform's other notification titles are:
 * `The Task "Login" is due in 3 hours`. The quoted title is what the clients show as the entry's subject.
 *
 * @param taskTitle The task's title.
 * @param dueDate The task's due date, as stored.
 * @param dueMoment The moment it is due for the person.
 * @param now The moment the reminder is filed at.
 * @param timeZone The person's time zone, which a due date that names a moment is told in.
 */
export function taskDueReminderNotice(
	taskTitle: string | null | undefined,
	dueDate: Date | string,
	dueMoment: number,
	now: number,
	timeZone: string | null | undefined
): { title: string; message: string } {
	const task = (taskTitle ?? '').replace(/\s+/g, ' ').trim();
	const quoted =
		task.length > MAX_QUOTED_TITLE_LENGTH ? `${task.slice(0, MAX_QUOTED_TITLE_LENGTH - 1).trimEnd()}…` : task;
	const subject = quoted ? `The Task "${quoted}"` : 'A task';
	const zone = knownTimeZoneOf(timeZone);
	const message = isDayOnlyDueDate(dueDate)
		? `Due by the end of ${moment.utc(instantOf(dueDate)).format('YYYY-MM-DD')}.`
		: `Due at ${moment.utc(dueMoment).tz(zone).format('YYYY-MM-DD HH:mm')} (${zone}).`;
	return { title: `${subject} is due ${timeLeftText(dueMoment - now)}`, message };
}
