import {
	EmployeeNotificationEmailMode,
	EmployeeNotificationTypeEnum,
	ID,
	IEmployeeNotificationPreferences,
	InboxDeliveryModeEnum
} from '@gauzy/contracts';
import {
	INBOX_DELIVERY_DEFAULT_DIGEST_HOUR,
	INBOX_DELIVERY_INBOX_PATH,
	INBOX_DELIVERY_KIND_LABELS,
	INBOX_DELIVERY_MAX_ATTEMPTS,
	INBOX_DELIVERY_RETRY_BASE_MS,
	INBOX_DELIVERY_RETRY_CAP_MS,
	INBOX_DELIVERY_SETTINGS_PATH,
	INBOX_DELIVERY_TIMER_REMINDER_GRACE_MS
} from './inbox-delivery.constants';

/** The columns of the employee's notification setting the decision reads (the per-type switches and `preferences`). */
export interface IDeliverySettingLike {
	payment?: boolean | null;
	assignment?: boolean | null;
	invitation?: boolean | null;
	mention?: boolean | null;
	comment?: boolean | null;
	message?: boolean | null;
	preferences?: unknown;
}

/** A moment as the person's clock shows it. */
export interface IDeliveryClock {
	/** `YYYY-MM-DD` */
	date: string;
	hour: number;
	minute: number;
}

/** What the decision concluded for one entry and person. */
export interface IDeliveryDecision {
	mode: InboxDeliveryModeEnum;
	dueAt: Date | null;
	digestKey: string | null;
}

const MINUTES_IN_DAY = 24 * 60;

/** Whether the runtime knows the time zone (an unknown one falls back to UTC rather than failing the sweep). */
function knownTimeZone(timeZone: string | null | undefined): string {
	if (!timeZone) return 'UTC';
	try {
		new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0));
		return timeZone;
	} catch {
		return 'UTC';
	}
}

/** The person's clock at `now`. */
export function localClockOf(now: Date, timeZone?: string | null): IDeliveryClock {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: knownTimeZone(timeZone),
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	}).formatToParts(now);
	const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
	return {
		date: `${read('year')}-${read('month')}-${read('day')}`,
		hour: Number(read('hour')) % 24,
		minute: Number(read('minute'))
	};
}

/** The calendar day after `date` (`YYYY-MM-DD`). */
export function nextLocalDate(date: string): string {
	const [year, month, day] = date.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** How far a guess is from showing `date` at `hour:minute` on the person's clock, in minutes. */
function minutesOff(guess: Date, date: string, hour: number, minute: number, timeZone?: string | null): number {
	const shown = localClockOf(guess, timeZone);
	let difference = hour * 60 + minute - (shown.hour * 60 + shown.minute);
	if (shown.date < date) difference += MINUTES_IN_DAY;
	else if (shown.date > date) difference -= MINUTES_IN_DAY;
	return difference;
}

/**
 * The instant the person's clock shows `date` at `hour:minute`: the UTC guess corrected by what the clock shows
 * there, and checked once more, so the offset that applies on THAT day is the one used (a daylight-saving change
 * between the guess and the day would otherwise leave an hour's error). A time the clock skips on the day the
 * clocks go forward (02:30 where 02:00 becomes 03:00) is the first instant after the gap (03:00), found between
 * the two candidates the correction oscillates between, so a digest hour or a window's end in the gap is not an
 * hour early.
 */
export function instantOfLocal(date: string, hour: number, minute: number, timeZone?: string | null): Date {
	const [year, month, day] = date.split('-').map(Number);
	let instant = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
	let previous = instant;
	for (let pass = 0; pass < 3; pass += 1) {
		const off = minutesOff(instant, date, hour, minute, timeZone);
		if (off === 0) return instant;
		previous = instant;
		instant = new Date(instant.getTime() + off * 60_000);
	}
	// Never settled: the time is in a gap. The earlier candidate shows a time before it and the later one a time past
	// it (02:30 + the gap: 03:30), so the first instant after the gap is the first minute between them whose clock
	// is no longer before the skipped time. Offsets change on whole minutes, so the halving ends on that minute.
	let before = Math.min(instant.getTime(), previous.getTime());
	let after = Math.max(instant.getTime(), previous.getTime());
	while (after - before > 60_000) {
		const middle = before + Math.floor((after - before) / 120_000) * 60_000;
		if (minutesOff(new Date(middle), date, hour, minute, timeZone) > 0) before = middle;
		else after = middle;
	}
	return new Date(after);
}

/** `HH:mm` as minutes of the day, or null when it is not one. */
export function minutesOfDay(value: unknown): number | null {
	if (typeof value !== 'string') return null;
	const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
	if (!match) return null;
	return Number(match[1]) * 60 + Number(match[2]);
}

/** Whether the clock is inside the window (`start` to `end`; a window that ends before it starts spans midnight). */
export function isWithinWindow(clock: IDeliveryClock, window: { start?: unknown; end?: unknown } | null | undefined): boolean {
	const start = minutesOfDay(window?.start);
	const end = minutesOfDay(window?.end);
	if (start === null || end === null || start === end) return false;
	const at = clock.hour * 60 + clock.minute;
	return start < end ? at >= start && at < end : at >= start || at < end;
}

/** When the window the clock is in ends, as an instant: today's end when still ahead, else tomorrow's (the next calendar day's, not 24 hours on). */
export function windowEndAfter(now: Date, window: { start?: unknown; end?: unknown }, timeZone?: string | null): Date {
	const clock = localClockOf(now, timeZone);
	const end = minutesOfDay(window.end) ?? 0;
	const at = clock.hour * 60 + clock.minute;
	const date = at < end ? clock.date : nextLocalDate(clock.date);
	return instantOfLocal(date, Math.floor(end / 60), end % 60, timeZone);
}

/** The next moment the person's clock shows the digest hour: today when still ahead, else the next calendar day's (not 24 hours on). */
export function nextDigestAt(now: Date, digestHour: number, timeZone?: string | null): Date {
	const clock = localClockOf(now, timeZone);
	const hour = Number.isInteger(digestHour) && digestHour >= 0 && digestHour <= 23 ? digestHour : INBOX_DELIVERY_DEFAULT_DIGEST_HOUR;
	const today = instantOfLocal(clock.date, hour, 0, timeZone);
	if (today.getTime() > now.getTime()) return today;
	return instantOfLocal(nextLocalDate(clock.date), hour, 0, timeZone);
}

/** The `preferences` of a setting, stored as an object or as its JSON. */
export function preferencesOf(setting: IDeliverySettingLike | null | undefined): IEmployeeNotificationPreferences {
	const raw = setting?.preferences;
	if (raw && typeof raw === 'object') return raw as IEmployeeNotificationPreferences;
	if (typeof raw === 'string' && raw.trim()) {
		try {
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' ? (parsed as IEmployeeNotificationPreferences) : {};
		} catch {
			return {};
		}
	}
	return {};
}

/** Whether the employee takes this kind at all (the setting's per-type switch; `TaskUpdate` lives in the preferences). */
export function kindSwitchOf(setting: IDeliverySettingLike | null | undefined, preferences: IEmployeeNotificationPreferences, type: string | null | undefined): boolean {
	switch (type) {
		case EmployeeNotificationTypeEnum.PAYMENT:
			return setting?.payment !== false;
		case EmployeeNotificationTypeEnum.ASSIGNMENT:
			return setting?.assignment !== false;
		case EmployeeNotificationTypeEnum.INVITATION:
			return setting?.invitation !== false;
		case EmployeeNotificationTypeEnum.MENTION:
			return setting?.mention !== false;
		case EmployeeNotificationTypeEnum.COMMENT:
			return setting?.comment !== false;
		case EmployeeNotificationTypeEnum.MESSAGE:
			return setting?.message !== false;
		case EmployeeNotificationTypeEnum.TASK_UPDATE:
			return preferences.taskUpdate !== false;
		// A timer left running: off when the employee turned the reminders off (`timerReminderHours` null or 0).
		case EmployeeNotificationTypeEnum.TIMER_REMINDER:
			return preferences.timerReminderHours !== null && preferences.timerReminderHours !== 0;
		default:
			return true;
	}
}

/** The email mode for a kind: the kind's own, else the one for every kind (`true` is `immediate`, `false` is `off`), else `immediate`. */
export function emailModeOf(preferences: IEmployeeNotificationPreferences, type: string | null | undefined): EmployeeNotificationEmailMode {
	const own = type ? preferences.emailByType?.[type] : undefined;
	if (own === 'immediate' || own === 'digest' || own === 'off') return own;
	const all = preferences.email;
	if (all === 'immediate' || all === 'digest' || all === 'off') return all;
	if (all === false) return 'off';
	return 'immediate';
}

/** The time zone the preferences name, else the person's, else UTC. */
export function timeZoneOf(preferences: IEmployeeNotificationPreferences, userTimeZone?: string | null): string {
	return knownTimeZone(preferences.dnd?.timeZone || userTimeZone || null);
}

/**
 * Whether a kind is emailed and pushed only while its entry is unread: a timer reminder, which an open Ever Teams tab
 * shows itself and then marks read. Its email at once and its push wait {@link INBOX_DELIVERY_TIMER_REMINDER_GRACE_MS}
 * for that mark, and one read by then is not sent. Every other kind is sent as decided, read or not.
 */
export function isSentOnlyWhileUnread(type: string | null | undefined): boolean {
	return type === EmployeeNotificationTypeEnum.TIMER_REMINDER;
}

/**
 * When an email at once or a push goes: now, or after a timer reminder's wait; then after the do-not-disturb window
 * when that moment falls inside it.
 */
function immediateDueAt(
	now: Date,
	type: string | null | undefined,
	preferences: IEmployeeNotificationPreferences,
	timeZone: string
): Date {
	const from = isSentOnlyWhileUnread(type) ? new Date(now.getTime() + INBOX_DELIVERY_TIMER_REMINDER_GRACE_MS) : now;
	const dnd = preferences.dnd;
	return dnd && isWithinWindow(localClockOf(from, timeZone), dnd) ? windowEndAfter(from, dnd, timeZone) : from;
}

/**
 * What to do with one entry for one person, from the employee's setting: nothing when the kind is off or email is
 * off for it; an email at once (after the do-not-disturb window when the entry falls inside it); or a place in the
 * next digest at the person's hour.
 *
 * A timer reminder the person had already read when it is decided (an open Ever Teams tab showed it and marked it
 * read) gets nothing, and its email at once waits for that mark ({@link isSentOnlyWhileUnread}).
 * `alreadyRead` changes nothing for any other kind.
 */
export function decideEmailDelivery(input: {
	now: Date;
	type: string | null | undefined;
	setting: IDeliverySettingLike | null | undefined;
	userTimeZone?: string | null;
	alreadyRead?: boolean;
}): IDeliveryDecision {
	if (input.alreadyRead && isSentOnlyWhileUnread(input.type))
		return { mode: InboxDeliveryModeEnum.NONE, dueAt: null, digestKey: null };
	const preferences = preferencesOf(input.setting);
	if (!kindSwitchOf(input.setting, preferences, input.type)) return { mode: InboxDeliveryModeEnum.NONE, dueAt: null, digestKey: null };
	const mode = emailModeOf(preferences, input.type);
	if (mode === 'off') return { mode: InboxDeliveryModeEnum.NONE, dueAt: null, digestKey: null };
	const timeZone = timeZoneOf(preferences, input.userTimeZone);
	if (mode === 'digest') {
		const dueAt = nextDigestAt(input.now, preferences.digestHour ?? INBOX_DELIVERY_DEFAULT_DIGEST_HOUR, timeZone);
		return { mode: InboxDeliveryModeEnum.DIGEST, dueAt, digestKey: localClockOf(dueAt, timeZone).date };
	}
	return {
		mode: InboxDeliveryModeEnum.IMMEDIATE,
		dueAt: immediateDueAt(input.now, input.type, preferences, timeZone),
		digestKey: null
	};
}

/**
 * Whether a kind is pushed to the person's devices: the kind's own switch (`preferences.pushByType[kind]`), else the
 * one for every kind (`preferences.push`), else on when a device is subscribed — registering one is the opt-in.
 */
export function pushOnFor(preferences: IEmployeeNotificationPreferences, type: string | null | undefined, hasSubscription: boolean): boolean {
	const own = type ? preferences.pushByType?.[type] : undefined;
	if (typeof own === 'boolean') return own;
	if (typeof preferences.push === 'boolean') return preferences.push;
	return hasSubscription;
}

/**
 * What to do with one entry for one person over web push (FR-13): nothing when no device is subscribed, the kind is
 * off, or push is off for it; else a push at once — after the do-not-disturb window when the entry falls inside it
 * (FR-11). Whether the person is looking at the app is decided when the push is due, not here.
 *
 * A timer reminder is pushed only while unread, after the same wait as its email (see {@link decideEmailDelivery}).
 */
export function decidePushDelivery(input: {
	now: Date;
	type: string | null | undefined;
	setting: IDeliverySettingLike | null | undefined;
	userTimeZone?: string | null;
	hasSubscription: boolean;
	alreadyRead?: boolean;
}): IDeliveryDecision {
	const none: IDeliveryDecision = { mode: InboxDeliveryModeEnum.NONE, dueAt: null, digestKey: null };
	if (!input.hasSubscription) return none;
	if (input.alreadyRead && isSentOnlyWhileUnread(input.type)) return none;
	const preferences = preferencesOf(input.setting);
	if (!kindSwitchOf(input.setting, preferences, input.type)) return none;
	if (!pushOnFor(preferences, input.type, input.hasSubscription)) return none;
	const timeZone = timeZoneOf(preferences, input.userTimeZone);
	return {
		mode: InboxDeliveryModeEnum.IMMEDIATE,
		dueAt: immediateDueAt(input.now, input.type, preferences, timeZone),
		digestKey: null
	};
}

/** How long to wait before the next attempt (doubling from the base, capped), or null when the attempts are spent. */
export function retryDelayMs(attempts: number): number | null {
	if (attempts >= INBOX_DELIVERY_MAX_ATTEMPTS) return null;
	return Math.min(INBOX_DELIVERY_RETRY_BASE_MS * 2 ** Math.max(attempts - 1, 0), INBOX_DELIVERY_RETRY_CAP_MS);
}

/** The label of a kind in a subject or a digest line. */
export function kindLabelOf(type: string | null | undefined): string {
	return (type && INBOX_DELIVERY_KIND_LABELS[type]) || 'Notification';
}

/** A URL without its trailing slashes, in one pass (`/\/+$/` is quadratic on a long run of slashes). */
export function withoutTrailingSlashes(value: string): string {
	let end = value.length;
	while (end > 0 && value.charCodeAt(end - 1) === 47) end--;
	return value.slice(0, end);
}

/** The entry in the Inbox page, and the settings page, under the client's base URL. */
export function inboxItemLinkOf(host: string, itemId: ID): string {
	return `${withoutTrailingSlashes(host)}/${INBOX_DELIVERY_INBOX_PATH}?item=${encodeURIComponent(String(itemId))}`;
}

export function inboxLinkOf(host: string): string {
	return `${withoutTrailingSlashes(host)}/${INBOX_DELIVERY_INBOX_PATH}`;
}

export function notificationSettingsLinkOf(host: string): string {
	return `${withoutTrailingSlashes(host)}/${INBOX_DELIVERY_SETTINGS_PATH}`;
}

/** The metadata of an entry, stored as an object or as its JSON. */
export function metadataOf(raw: unknown): Record<string, unknown> {
	if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
	if (typeof raw === 'string' && raw.trim()) {
		try {
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
		} catch {
			return {};
		}
	}
	return {};
}

/**
 * A body cut for an email line (the entry's own text is in the Inbox). A tag stops at the next `<`, so a body of many
 * `<` without a `>` is read in linear time (`<[^>]+>` was quadratic on it).
 */
export function excerptOf(body: string | null | undefined, max = 280): string {
	const text = String(body ?? '')
		.replace(/<[^<>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
