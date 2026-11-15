import { EmployeeAppointmentStatus } from '@gauzy/contracts';
import { instantOf, notificationPreferencesOf } from '../../time-tracking/timer-reminder/timer-reminder.rules';

/**
 * The rules of the meeting notifications (ever-co/ever-teams#5022): what each one says, and when the reminders before a
 * meeting are due. Pure, so the appointment writes, the reminder sweep and their specs read them alike.
 *
 * A meeting is an employee appointment: its employee hosts it, and the employees in its `appointment_employee` rows
 * are invited to it.
 */

/** What a meeting notification tells its receiver. */
export type MeetingNoticeKind = 'invited' | 'removed' | 'changed' | 'cancelled' | 'reminder' | 'starting';

/** How many minutes before a meeting its reminder comes when the employee chose none. */
export const DEFAULT_MEETING_REMINDER_MINUTES = 15;

/** The longest lead that reads as one: a day. */
export const MAX_MEETING_REMINDER_MINUTES = 24 * 60;

const MINUTE_MS = 60 * 1000;

/** The notice that a meeting is about to start comes this long before its start. */
export const MEETING_STARTING_LEAD_MS = MINUTE_MS;

/**
 * How long after its start a meeting's notice that it is starting may still come (a sweep that ran late); later, it
 * says nothing worth saying.
 */
export const MEETING_STARTING_GRACE_MS = 5 * MINUTE_MS;

/** 1: the reminder before the meeting, at the employee's lead; 2: the meeting is about to start. */
export type MeetingReminderLevel = 1 | 2;

/** The longest meeting title quoted in a notification's title, which is stored in a column of 255 characters on MySQL. */
const MAX_QUOTED_AGENDA_LENGTH = 120;

/**
 * The employee's lead in minutes, or null when they want no reminder before a meeting (`meetingReminderMinutes` null
 * or 0): the notice at the start still comes. A value that is missing, not a whole number of minutes in (0, 1440], is
 * the default.
 *
 * @param preferences The `preferences` of the employee's notification setting (an object or its JSON).
 */
export function meetingReminderMinutesOf(preferences: unknown): number | null {
	const minutes = notificationPreferencesOf(preferences).meetingReminderMinutes;
	if (minutes === null || minutes === 0) {
		return null;
	}
	const isValid =
		typeof minutes === 'number' &&
		Number.isInteger(minutes) &&
		minutes > 0 &&
		minutes <= MAX_MEETING_REMINDER_MINUTES;
	return isValid ? minutes : DEFAULT_MEETING_REMINDER_MINUTES;
}

/**
 * The reminder a meeting starting at `start` is due at `now` for an employee whose lead is `minutes`: 2 from a minute
 * before the start to five minutes after it, 1 from the lead to the minute before, 0 otherwise. A lead of a minute or
 * less (or none) leaves only the notice at the start.
 */
export function meetingReminderLevelAt(now: number, start: number, minutes: number | null): 0 | MeetingReminderLevel {
	if (!Number.isFinite(now) || !Number.isFinite(start)) {
		return 0;
	}
	if (now >= start - MEETING_STARTING_LEAD_MS) {
		return now < start + MEETING_STARTING_GRACE_MS ? 2 : 0;
	}
	if (minutes !== null && minutes > 0 && now >= start - minutes * MINUTE_MS) {
		return 1;
	}
	return 0;
}

/** Whether an appointment still takes place: neither cancelled nor marked completed. */
export function isMeetingScheduled(status: EmployeeAppointmentStatus | string | null | undefined): boolean {
	return status !== EmployeeAppointmentStatus.CANCELLED && status !== EmployeeAppointmentStatus.COMPLETED;
}

/** A time zone the runtime knows, else UTC. */
export function knownTimeZoneOf(timeZone: string | null | undefined): string {
	const zone = (timeZone ?? '').trim();
	if (!zone) {
		return 'UTC';
	}
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: zone });
		return zone;
	} catch {
		return 'UTC';
	}
}

/**
 * When a meeting runs, in the receiver's time zone, named after it: `Thursday, November 12, 2026, 2:00 – 2:45 PM
 * (Europe/Paris)`. English, as the platform's other notification texts are; the clients show the time in the reader's
 * own language from the appointment itself.
 */
export function meetingWhenText(
	start: Date | string | number,
	end: Date | string | number | null | undefined,
	timeZone?: string | null
): string {
	const zone = knownTimeZoneOf(timeZone);
	const format = new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'full', timeStyle: 'short' });
	const startAt = typeof start === 'number' ? start : instantOf(start as Date | string);
	const endAt = end === null || end === undefined ? Number.NaN : typeof end === 'number' ? end : instantOf(end);
	if (!Number.isFinite(startAt)) {
		return '';
	}
	const range =
		Number.isFinite(endAt) && endAt > startAt
			? format.formatRange(new Date(startAt), new Date(endAt))
			: format.format(new Date(startAt));
	// The runtime's formats put narrow and thin spaces around the times; plain spaces read alike in every mail client
	return `${range.replace(/[   ]/g, ' ')} (${zone})`;
}

/** The meeting's title as a notification quotes it: on one line, cut to MAX_QUOTED_AGENDA_LENGTH. */
export function quotedAgendaOf(agenda: string | null | undefined): string {
	const text = (agenda ?? '').replace(/\s+/g, ' ').trim() || 'Meeting';
	return text.length > MAX_QUOTED_AGENDA_LENGTH ? `${text.slice(0, MAX_QUOTED_AGENDA_LENGTH - 1).trimEnd()}…` : text;
}

/** `in 1 minute`, `in 15 minutes`, `in 2 hours`, `in 1 hour 30 minutes`. */
function inText(minutes: number): string {
	const whole = Math.max(1, Math.round(minutes));
	const hours = Math.floor(whole / 60);
	const rest = whole % 60;
	const minutesText = (count: number) => `${count} ${count === 1 ? 'minute' : 'minutes'}`;
	if (hours === 0) {
		return `in ${minutesText(rest)}`;
	}
	const hoursText = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
	return rest === 0 ? `in ${hoursText}` : `in ${hoursText} ${minutesText(rest)}`;
}

/** What a meeting notification is about. */
export interface IMeetingNoticeInput {
	agenda: string | null | undefined;
	startDateTime: Date | string;
	endDateTime?: Date | string | null;
	/** The receiver's time zone, for the time the message names. */
	timeZone?: string | null;
	/** The moment the notice is filed at: a reminder names how long until the start from it. */
	now?: number;
}

/**
 * The title and message of a meeting notification. Ever Teams reads the kind and the meeting's title back from the
 * title to show it in the reader's language: the notification has no field of its own for them. The titles are a
 * contract, pinned word for word by a test on each side ("the titles Ever Teams reads back" here, "the titles Gauzy
 * files" there): change both, or neither.
 *
 * - invited: `You are invited to "<title>"`;
 * - removed: `You are no longer invited to "<title>"`;
 * - changed: `"<title>" was changed`;
 * - cancelled: `"<title>" was cancelled`;
 * - reminder: `"<title>" starts in 15 minutes` (how long until its start, when filed);
 * - starting: `"<title>" is starting`.
 *
 * The message says when the meeting runs, in the receiver's time zone (for a change: when it runs now).
 */
export function meetingNotice(kind: MeetingNoticeKind, input: IMeetingNoticeInput): { title: string; message: string } {
	const agenda = quotedAgendaOf(input.agenda);
	const message = meetingWhenText(input.startDateTime, input.endDateTime, input.timeZone);
	switch (kind) {
		case 'invited':
			return { title: `You are invited to "${agenda}"`, message };
		case 'removed':
			return { title: `You are no longer invited to "${agenda}"`, message };
		case 'changed':
			return { title: `"${agenda}" was changed`, message };
		case 'cancelled':
			return { title: `"${agenda}" was cancelled`, message };
		case 'reminder': {
			const now = input.now ?? Date.now();
			const minutes = (instantOf(input.startDateTime) - now) / MINUTE_MS;
			return { title: `"${agenda}" starts ${inText(minutes)}`, message };
		}
		case 'starting':
			return { title: `"${agenda}" is starting`, message };
	}
}

/** Whether a change of these fields is worth telling the invitees: when, where, or what the meeting is. */
export function isMeetingChangeWorthTelling(
	before: { agenda?: string | null; description?: string | null; location?: string | null; startDateTime?: Date | string | null; endDateTime?: Date | string | null },
	after: { agenda?: string | null; description?: string | null; location?: string | null; startDateTime?: Date | string | null; endDateTime?: Date | string | null }
): boolean {
	const text = (value: string | null | undefined) => (value ?? '').trim();
	const instant = (value: Date | string | null | undefined) =>
		value === null || value === undefined ? Number.NaN : instantOf(value);
	const sameInstant = (a: number, b: number) => (Number.isNaN(a) && Number.isNaN(b)) || a === b;
	return (
		text(before.agenda) !== text(after.agenda) ||
		text(before.description) !== text(after.description) ||
		text(before.location) !== text(after.location) ||
		!sameInstant(instant(before.startDateTime), instant(after.startDateTime)) ||
		!sameInstant(instant(before.endDateTime), instant(after.endDateTime))
	);
}
