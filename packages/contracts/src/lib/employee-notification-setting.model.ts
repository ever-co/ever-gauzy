import { IBasePerTenantAndOrganizationEntityModel, JsonData, OmitFields } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

/**
 * Interface for entities that can have employee notification settings.
 */
export interface IEmployeeNotificationSetting extends IEmployeeEntityInput, IBasePerTenantAndOrganizationEntityModel {
	payment?: boolean;
	assignment?: boolean;
	invitation?: boolean;
	mention?: boolean;
	comment?: boolean;
	message?: boolean;
	/** Delivery choices beyond the per-type switches; see {@link IEmployeeNotificationPreferences}. */
	preferences?: JsonData;
}

/** How a kind of notification reaches the employee by email. */
export type EmployeeNotificationEmailMode = 'immediate' | 'digest' | 'off';

/**
 * The `preferences` JSON of an employee's notification setting (the Inbox spec, "Preferences and channels").
 *
 * The shape is additive over the `{ email: boolean, inApp: boolean }` the setting is created with: a boolean
 * `email` still reads as `immediate` (true) or `off` (false). Every member is optional; a missing one means the
 * default stated here. Delivery (email, push, digest) honours these once the delivery lanes land; the in-app
 * entry is always created when the per-type switch allows it.
 */
export interface IEmployeeNotificationPreferences {
	/** Always on: the in-app entry. */
	inApp?: boolean;
	/** Email for every kind unless `emailByType` overrides it. Default `immediate`. */
	email?: EmployeeNotificationEmailMode | boolean;
	/** Email mode per notification type (`Assignment`, `Mention`, …). */
	emailByType?: Partial<Record<string, EmployeeNotificationEmailMode>>;
	/** Push for every kind unless `pushByType` overrides it. Default true. */
	push?: boolean;
	pushByType?: Partial<Record<string, boolean>>;
	/** Whether changes to followed records (`TaskUpdate`) create an entry. Default true. */
	taskUpdate?: boolean;
	/** Do not disturb: no push or immediate email between `start` and `end` (`HH:mm`, the employee's time zone). */
	dnd?: { start: string; end: string; timeZone?: string } | null;
	/** The hour (0–23, the employee's time zone) the daily digest is sent. Default 8. */
	digestHour?: number;
	/**
	 * After how many hours a running timer is worth a reminder (`TimerReminder`), with one more at twice that and never
	 * a third. Default 8; `null` or 0 for no reminder. A value outside (0, 24] reads as the default.
	 */
	timerReminderHours?: number | null;
	/**
	 * How many minutes before a meeting the employee hosts or is invited to they are reminded of it (`Meeting`), on top
	 * of the notice when it is about to start. Default 15; `null` or 0 for no reminder before (the notice at the start
	 * still comes). A value outside (0, 1440] reads as the default.
	 */
	meetingReminderMinutes?: number | null;
	/**
	 * How many hours before a task's due date the employee is reminded of it (`TaskDueReminder`), for the tasks they are
	 * assigned to. Default 24; `null` or 0 for no reminder. A value outside (0, 168] reads as the default.
	 */
	taskDueReminderHours?: number | null;
}

/**
 * A team's defaults for its members' notifications: what a member who chose nothing for a key of their own
 * preferences gets instead of the platform's default. A member's own choice wins at every level: key by key, kind by
 * kind for `emailByType` and `pushByType`, and a member's `email` or `push` for every kind over the team's per-kind
 * ones. Unset (the default) changes nothing.
 */
export type ITeamNotificationDefaults = Pick<
	IEmployeeNotificationPreferences,
	'email' | 'emailByType' | 'push' | 'pushByType' | 'taskUpdate' | 'timerReminderHours' | 'taskDueReminderHours'
>;

/**
 * Input type for creating a new employee notification setting.
 */
export interface IEmployeeNotificationSettingCreateInput extends OmitFields<IEmployeeNotificationSetting> {}

/**
 * Input type for updating an existing employee notification setting.
 */
export interface IEmployeeNotificationSettingUpdateInput
	extends OmitFields<IEmployeeNotificationSetting, 'employeeId' | 'employee'> {}
