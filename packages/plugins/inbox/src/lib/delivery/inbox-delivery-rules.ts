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
	INBOX_DELIVERY_SETTINGS_PATH
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

/** The instant the person's clock shows `date` at `hour:minute` (within an hour across a daylight-saving change). */
export function instantOfLocal(date: string, hour: number, minute: number, timeZone?: string | null): Date {
	const [year, month, day] = date.split('-').map(Number);
	const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
	const shown = localClockOf(guess, timeZone);
	let difference = hour * 60 + minute - (shown.hour * 60 + shown.minute);
	if (shown.date < date) difference += MINUTES_IN_DAY;
	else if (shown.date > date) difference -= MINUTES_IN_DAY;
	return new Date(guess.getTime() + difference * 60_000);
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

/** When the window the clock is in ends, as an instant. */
export function windowEndAfter(now: Date, window: { start?: unknown; end?: unknown }, timeZone?: string | null): Date {
	const clock = localClockOf(now, timeZone);
	const end = minutesOfDay(window.end) ?? 0;
	const at = clock.hour * 60 + clock.minute;
	const today = instantOfLocal(clock.date, Math.floor(end / 60), end % 60, timeZone);
	if (at < end) return today;
	return new Date(today.getTime() + MINUTES_IN_DAY * 60_000);
}

/** The next moment the person's clock shows the digest hour (today when it is still ahead, else tomorrow). */
export function nextDigestAt(now: Date, digestHour: number, timeZone?: string | null): Date {
	const clock = localClockOf(now, timeZone);
	const hour = Number.isInteger(digestHour) && digestHour >= 0 && digestHour <= 23 ? digestHour : INBOX_DELIVERY_DEFAULT_DIGEST_HOUR;
	const today = instantOfLocal(clock.date, hour, 0, timeZone);
	if (today.getTime() > now.getTime()) return today;
	return new Date(today.getTime() + MINUTES_IN_DAY * 60_000);
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
 * What to do with one entry for one person, from the employee's setting: nothing when the kind is off or email is
 * off for it; an email at once (after the do-not-disturb window when the entry falls inside it); or a place in the
 * next digest at the person's hour.
 */
export function decideEmailDelivery(input: {
	now: Date;
	type: string | null | undefined;
	setting: IDeliverySettingLike | null | undefined;
	userTimeZone?: string | null;
}): IDeliveryDecision {
	const preferences = preferencesOf(input.setting);
	if (!kindSwitchOf(input.setting, preferences, input.type)) return { mode: InboxDeliveryModeEnum.NONE, dueAt: null, digestKey: null };
	const mode = emailModeOf(preferences, input.type);
	if (mode === 'off') return { mode: InboxDeliveryModeEnum.NONE, dueAt: null, digestKey: null };
	const timeZone = timeZoneOf(preferences, input.userTimeZone);
	if (mode === 'digest') {
		const dueAt = nextDigestAt(input.now, preferences.digestHour ?? INBOX_DELIVERY_DEFAULT_DIGEST_HOUR, timeZone);
		return { mode: InboxDeliveryModeEnum.DIGEST, dueAt, digestKey: localClockOf(dueAt, timeZone).date };
	}
	const dnd = preferences.dnd;
	const deferred = dnd && isWithinWindow(localClockOf(input.now, timeZone), dnd) ? windowEndAfter(input.now, dnd, timeZone) : input.now;
	return { mode: InboxDeliveryModeEnum.IMMEDIATE, dueAt: deferred, digestKey: null };
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

/** The entry in the Inbox page, and the settings page, under the client's base URL. */
export function inboxItemLinkOf(host: string, itemId: ID): string {
	return `${host.replace(/\/+$/, '')}/${INBOX_DELIVERY_INBOX_PATH}?item=${encodeURIComponent(String(itemId))}`;
}

export function inboxLinkOf(host: string): string {
	return `${host.replace(/\/+$/, '')}/${INBOX_DELIVERY_INBOX_PATH}`;
}

export function notificationSettingsLinkOf(host: string): string {
	return `${host.replace(/\/+$/, '')}/${INBOX_DELIVERY_SETTINGS_PATH}`;
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

/** A body cut for an email line (the entry's own text is in the Inbox). */
export function excerptOf(body: string | null | undefined, max = 280): string {
	const text = String(body ?? '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
