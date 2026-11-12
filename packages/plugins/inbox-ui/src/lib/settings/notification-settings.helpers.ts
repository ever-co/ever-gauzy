import {
	EmployeeNotificationEmailMode,
	EmployeeNotificationTypeEnum,
	IEmployeeNotificationPreferences,
	IEmployeeNotificationSetting,
	IInboxDeliveryStatus
} from '@gauzy/contracts';

/**
 * What the email section says about delivery, under `INBOX.NOTIFICATION_SETTINGS.EMAIL_NOTICE`: `OFF` when the server
 * sends no notification emails, `UNAVAILABLE` when it does but no mail transport answers for the organization, and
 * nothing when emails can go out or the server does not say.
 */
export type EmailDeliveryNotice = 'OFF' | 'UNAVAILABLE';

export function emailDeliveryNoticeOf(status: IInboxDeliveryStatus | null | undefined): EmailDeliveryNotice | null {
	if (!status?.email) return null;
	if (!status.email.enabled) return 'OFF';
	return status.email.available ? null : 'UNAVAILABLE';
}

/** The per-kind switches of the setting, in the order the page shows them, with the kind each one is about. */
export type NotificationSettingKey = 'assignment' | 'mention' | 'comment' | 'invitation' | 'message' | 'payment';

export interface INotificationKindRow {
	key: NotificationSettingKey;
	type: EmployeeNotificationTypeEnum;
	/** The translation key of the row's title and text, under `INBOX.NOTIFICATION_SETTINGS.KINDS`. */
	labelKey: string;
}

export const NOTIFICATION_KIND_ROWS: readonly INotificationKindRow[] = [
	{ key: 'assignment', type: EmployeeNotificationTypeEnum.ASSIGNMENT, labelKey: 'ASSIGNMENT' },
	{ key: 'mention', type: EmployeeNotificationTypeEnum.MENTION, labelKey: 'MENTION' },
	{ key: 'comment', type: EmployeeNotificationTypeEnum.COMMENT, labelKey: 'COMMENT' },
	{ key: 'invitation', type: EmployeeNotificationTypeEnum.INVITATION, labelKey: 'INVITATION' },
	{ key: 'message', type: EmployeeNotificationTypeEnum.MESSAGE, labelKey: 'MESSAGE' },
	{ key: 'payment', type: EmployeeNotificationTypeEnum.PAYMENT, labelKey: 'PAYMENT' }
];

export const NOTIFICATION_EMAIL_MODES: readonly EmployeeNotificationEmailMode[] = ['immediate', 'digest', 'off'];

/** The hour the digest goes out when the employee chose none. */
export const DEFAULT_DIGEST_HOUR = 8;

/** The window quiet hours start with when switched on. */
export const DEFAULT_QUIET_HOURS = { start: '22:00', end: '07:00' } as const;

const TIME_OF_DAY = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;

export function isTimeOfDay(value: string): boolean {
	return TIME_OF_DAY.test(value.trim());
}

function isEmailMode(value: unknown): value is EmployeeNotificationEmailMode {
	return value === 'immediate' || value === 'digest' || value === 'off';
}

/** Gauzy files every kind unless the row turns it off; a missing row or value means on. */
export function isKindOn(setting: IEmployeeNotificationSetting | null | undefined, key: NotificationSettingKey): boolean {
	return setting?.[key] !== false;
}

/** The `preferences` of a row, stored as an object or as its JSON. */
export function preferencesOf(setting: IEmployeeNotificationSetting | null | undefined): IEmployeeNotificationPreferences {
	const raw: unknown = setting?.preferences;
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

/** The email mode of every kind: `email`, `true` as at once, `false` as never, nothing as at once. */
export function defaultEmailModeOf(preferences: IEmployeeNotificationPreferences): EmployeeNotificationEmailMode {
	const value = preferences.email;
	if (isEmailMode(value)) return value;
	if (value === false) return 'off';
	return 'immediate';
}

/** A kind's own email mode, or null when it follows the one of every kind. */
export function ownEmailModeOf(preferences: IEmployeeNotificationPreferences, type: EmployeeNotificationTypeEnum): EmployeeNotificationEmailMode | null {
	const own = preferences.emailByType?.[type];
	return isEmailMode(own) ? own : null;
}

/** The email mode of one kind: its own, else the one of every kind. */
export function emailModeOf(preferences: IEmployeeNotificationPreferences, type: EmployeeNotificationTypeEnum): EmployeeNotificationEmailMode {
	const own = preferences.emailByType?.[type];
	return isEmailMode(own) ? own : defaultEmailModeOf(preferences);
}

/** The quiet hours, when set and well formed. */
export function quietHoursOf(preferences: IEmployeeNotificationPreferences): { start: string; end: string; timeZone?: string } | null {
	const window = preferences.dnd;
	if (!window || !isTimeOfDay(String(window.start ?? '')) || !isTimeOfDay(String(window.end ?? ''))) return null;
	return window;
}

/** The digest hour, 0-23, else the default. */
export function digestHourOf(preferences: IEmployeeNotificationPreferences): number {
	const hour = preferences.digestHour;
	return typeof hour === 'number' && Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_DIGEST_HOUR;
}

/** The browser's time zone, which the quiet hours are saved in. */
export function browserTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch {
		return 'UTC';
	}
}

/** An hour of the day as the locale names it (`08:00`, `8:00 AM`). */
export function hourLabelOf(hour: number, locale: string | null | undefined): string {
	try {
		return new Intl.DateTimeFormat(locale || undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2026, 0, 1, hour, 0));
	} catch {
		return `${String(hour).padStart(2, '0')}:00`;
	}
}

/** The preferences with a patch applied: the per-kind modes merge (a kind patched to `undefined` follows the default again), the window merges, a `null` window clears it. */
export function withPreferencePatch(
	current: IEmployeeNotificationPreferences,
	patch: Partial<IEmployeeNotificationPreferences>
): IEmployeeNotificationPreferences {
	const next: IEmployeeNotificationPreferences = { ...current, ...patch };
	if (patch.emailByType) {
		const merged: Partial<Record<string, EmployeeNotificationEmailMode>> = { ...(current.emailByType ?? {}) };
		for (const [type, mode] of Object.entries(patch.emailByType)) {
			if (mode === undefined) delete merged[type];
			else merged[type] = mode;
		}
		next.emailByType = merged;
	}
	if ('dnd' in patch) next.dnd = patch.dnd ? { ...(current.dnd ?? {}), ...patch.dnd } : null;
	return next;
}
