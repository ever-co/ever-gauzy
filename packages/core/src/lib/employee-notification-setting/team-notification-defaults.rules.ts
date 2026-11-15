import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import {
	EmployeeNotificationEmailMode,
	IEmployeeNotificationPreferences,
	ITeamNotificationDefaults
} from '@gauzy/contracts';
import { notificationPreferencesOf } from '../time-tracking/timer-reminder/timer-reminder.rules';

/**
 * A team's defaults for its members' notifications (ever-co/ever-teams#5022): what a member who chose nothing for a
 * key of their own notification preferences gets, instead of the platform's default. A member's own choice always
 * wins, at every level (see `withTeamNotificationDefaults`). A team without defaults (the default) changes nothing.
 */

const EMAIL_MODES: ReadonlyArray<EmployeeNotificationEmailMode> = ['immediate', 'digest', 'off'];

/** The longest reminder thresholds the sweeps read (the timer's, the due dates'), in hours. */
const MAX_HOURS: Record<'timerReminderHours' | 'taskDueReminderHours', number> = {
	timerReminderHours: 24,
	taskDueReminderHours: 7 * 24
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** The kinds of a per-kind map whose values pass `isValid`, or undefined when none does. */
function byKind<T>(value: unknown, isValid: (entry: unknown) => entry is T): Partial<Record<string, T>> | undefined {
	if (!isRecord(value)) return undefined;
	const kept = Object.entries(value).filter(
		([kind, entry]) => kind.length > 0 && kind.length <= 64 && isValid(entry)
	);
	return kept.length ? (Object.fromEntries(kept) as Partial<Record<string, T>>) : undefined;
}

const isEmailMode = (value: unknown): value is EmployeeNotificationEmailMode =>
	EMAIL_MODES.includes(value as EmployeeNotificationEmailMode);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/** A reminder threshold as a team may set it: none (`null` or 0), or hours in (0, max]; undefined for anything else. */
function hoursOf(value: unknown, max: number): number | null | undefined {
	if (value === null || value === 0) return null;
	return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= max
		? Number(value.toFixed(2))
		: undefined;
}

/**
 * The defaults a team may hold, from what a client sent or the column stores (an object, or its JSON on SQLite): the
 * known keys with a valid value each, and nothing else. Null when none is left, which the team stores as "no defaults".
 */
export function teamNotificationDefaultsOf(raw: unknown): ITeamNotificationDefaults | null {
	const source = notificationPreferencesOf(raw) as Record<string, unknown>;
	const defaults: ITeamNotificationDefaults = {};
	if (isEmailMode(source['email']) || isBoolean(source['email'])) defaults.email = source['email'];
	const emailByType = byKind(source['emailByType'], isEmailMode);
	if (emailByType) defaults.emailByType = emailByType;
	if (isBoolean(source['push'])) defaults.push = source['push'];
	const pushByType = byKind(source['pushByType'], isBoolean);
	if (pushByType) defaults.pushByType = pushByType;
	if (isBoolean(source['taskUpdate'])) defaults.taskUpdate = source['taskUpdate'];
	for (const key of ['timerReminderHours', 'taskDueReminderHours'] as const) {
		const hours = hoursOf(source[key], MAX_HOURS[key]);
		if (hours !== undefined) defaults[key] = hours;
	}
	return Object.keys(defaults).length ? defaults : null;
}

/**
 * A member's notification preferences with their team's defaults under them. Whatever the member chose wins over
 * whatever the team chose, at every level: for a kind, the member's own mode or switch for it, else the member's own
 * for every kind, else the team's for it, else the team's for every kind, else the platform's. So:
 * - each key the member left unset takes the team's value;
 * - each kind of `emailByType` the member left unset takes the team's, but only while the member chose no `email`
 *   for every kind (a member who turned email off for every kind keeps it off, whatever the team's per-kind modes);
 *   the same for `pushByType` and `push`;
 * - `email: true` reads as unset: it is what the platform writes in the setting it creates for a receiver who has none
 *   (`{ email: true, inApp: true }`), and it already reads as the platform's default (`immediate`).
 *
 * Without defaults, the member's preferences as they are.
 *
 * @param own The `preferences` of the member's notification setting (an object or its JSON).
 * @param defaults The defaults of the member's team.
 */
export function withTeamNotificationDefaults(
	own: unknown,
	defaults: ITeamNotificationDefaults | null | undefined
): IEmployeeNotificationPreferences {
	const preferences = notificationPreferencesOf(own);
	if (!defaults) return preferences;
	const merged: IEmployeeNotificationPreferences = { ...preferences };
	const ownEmail = preferences.email === true ? undefined : preferences.email;
	if (ownEmail === undefined) {
		if (defaults.email !== undefined) merged.email = defaults.email;
		if (defaults.emailByType) merged.emailByType = { ...defaults.emailByType, ...(preferences.emailByType ?? {}) };
	}
	if (preferences.push === undefined) {
		if (defaults.push !== undefined) merged.push = defaults.push;
		if (defaults.pushByType) merged.pushByType = { ...defaults.pushByType, ...(preferences.pushByType ?? {}) };
	}
	for (const key of ['taskUpdate', 'timerReminderHours', 'taskDueReminderHours'] as const) {
		if (preferences[key] === undefined && defaults[key] !== undefined) merged[key] = defaults[key] as never;
	}
	return merged;
}

/**
 * How the defaults are stored: an object on PostgreSQL (`jsonb`) and MySQL (`json`), its JSON on SQLite, whose column
 * is `text`. Read back, either is the defaults as `teamNotificationDefaultsOf` keeps them.
 */
export const teamNotificationDefaultsTransformer = {
	to(value: ITeamNotificationDefaults | null | undefined): ITeamNotificationDefaults | string | null | undefined {
		return value && typeof value === 'object' && (isSqlite() || isBetterSqlite3()) ? JSON.stringify(value) : value;
	},
	from(value: unknown): ITeamNotificationDefaults | null {
		return value === null || value === undefined ? null : teamNotificationDefaultsOf(value);
	}
};
