import { Logger } from '@nestjs/common';
import { Brackets, DataSource } from 'typeorm';
import {
	EmployeeNotificationEmailMode,
	ID,
	IEmployeeNotificationPreferences,
	ITeamNotificationDefaults
} from '@gauzy/contracts';
import { Employee, OrganizationTeam, OrganizationTeamEmployee, User } from '../core/entities/internal';
import { notificationPreferencesOf } from '../time-tracking/timer-reminder/timer-reminder.rules';

/**
 * A team's defaults for its members' notifications (ever-co/ever-teams#5022): what a member who chose nothing for a
 * key of their own notification preferences gets, instead of the platform's default. A member's own choice always
 * wins, key by key and, for the per-kind email modes and push switches, kind by kind. A team without defaults (the
 * default) changes nothing.
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
 * A member's notification preferences with their team's defaults under them: each key the member left unset takes the
 * team's value, and each kind of `emailByType` and `pushByType` the member left unset takes the team's. Without
 * defaults, the member's preferences as they are.
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
	for (const [key, value] of Object.entries(defaults) as Array<[keyof ITeamNotificationDefaults, unknown]>) {
		if (key === 'emailByType' || key === 'pushByType') {
			merged[key] = { ...(value as object), ...(preferences[key] ?? {}) } as never;
		} else if (preferences[key] === undefined) {
			merged[key] = value as never;
		}
	}
	return merged;
}

/**
 * The team whose defaults apply to each of the given employees, and those defaults: the team the employee's user last
 * worked in (`lastTeamId`, the one Ever Teams opens) when they are an active member of it, else their only team in
 * their organization. An employee in several teams who last worked in none of them, or whose team has no defaults,
 * gets none, so nothing changes for them. Best effort: defaults that cannot be read are none, so a reminder or a
 * delivery never waits on them.
 *
 * @param employees The employees, each with the tenant it is read in.
 * @returns The defaults by `tenantId:employeeId`, for the employees who have some.
 */
export async function teamNotificationDefaultsByEmployee(
	dataSource: DataSource,
	employees: ReadonlyArray<{ employeeId: ID; tenantId: ID }>
): Promise<Map<string, ITeamNotificationDefaults>> {
	const found = new Map<string, ITeamNotificationDefaults>();
	const ids = [...new Set(employees.map(({ employeeId }) => String(employeeId)))];
	if (!ids.length) return found;
	let rows: Array<{ employeeId: ID; tenantId: ID; teamId: ID; notificationDefaults: unknown; lastTeamId: ID | null }>;
	try {
		rows = await dataSource
			.getRepository(OrganizationTeamEmployee)
			.createQueryBuilder('membership')
			.innerJoin(
				Employee,
				'employee',
				'employee.id = membership.employeeId AND employee.tenantId = membership.tenantId'
			)
			.innerJoin(
				OrganizationTeam,
				'team',
				'team.id = membership.organizationTeamId AND team.tenantId = membership.tenantId AND team.organizationId = employee.organizationId'
			)
			.leftJoin(User, 'user', 'user.id = employee.userId')
			.select('membership.employeeId', 'employeeId')
			.addSelect('membership.tenantId', 'tenantId')
			.addSelect('team.id', 'teamId')
			.addSelect('team.notificationDefaults', 'notificationDefaults')
			.addSelect('user.lastTeamId', 'lastTeamId')
			.where('membership.employeeId IN (:...ids)', { ids })
			.andWhere(
				new Brackets((active) =>
					active
						.where('membership.isActive IS NULL')
						.orWhere('membership.isActive = :active', { active: true })
				)
			)
			.andWhere(
				new Brackets((archived) =>
					archived
						.where('team.isArchived IS NULL')
						.orWhere('team.isArchived = :notArchived', { notArchived: false })
				)
			)
			.getRawMany();
	} catch (error) {
		new Logger('TeamNotificationDefaults').warn(
			`The team notification defaults were not read: ${(error as Error)?.message ?? error}`
		);
		return found;
	}

	const wanted = new Set(employees.map(({ employeeId, tenantId }) => `${tenantId}:${employeeId}`));
	const teamsOf = new Map<string, typeof rows>();
	for (const row of rows) {
		const key = `${row.tenantId}:${row.employeeId}`;
		if (!wanted.has(key)) continue;
		teamsOf.set(key, [...(teamsOf.get(key) ?? []), row]);
	}
	for (const [key, teams] of teamsOf) {
		const current = teams.find((team) => team.lastTeamId && String(team.teamId) === String(team.lastTeamId));
		const team = current ?? (teams.length === 1 ? teams[0] : null);
		const defaults = team ? teamNotificationDefaultsOf(team.notificationDefaults) : null;
		if (defaults) found.set(key, defaults);
	}
	return found;
}
