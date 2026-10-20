import { IEmployee, TaskStatusEnum } from '@gauzy/contracts';

/**
 * Small helpers shared by the project page — its Overview (the project quick look) and its Board and
 * Activity tabs — so every part of it reads names, presence and statuses the same way.
 */

/** Each request lands or fails on its own; a failure (most often a 403) only blanks its panel. */
export type Loadable<T> = { loading: boolean; failed: boolean; value: T };

export const loading = <T>(value: T): Loadable<T> => ({ loading: true, failed: false, value });
export const loaded = <T>(value: T): Loadable<T> => ({ loading: false, failed: false, value });
export const failed = <T>(value: T): Loadable<T> => ({ loading: false, failed: true, value });

export type Presence = 'tracking' | 'online' | 'away' | 'offline';

/** A person as the tabs draw them: name, initials and photo. */
export interface IPersonChip {
	id: string;
	name: string;
	initials: string;
	avatarUrl?: string;
}

/** "Ann Brown", from an employee, a user or a plain name. */
export function nameOf(person: IEmployee | any): string {
	const user = person?.user || person;
	const parts = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
	return person?.fullName || user?.name || parts || user?.email || '';
}

export function initialsOf(name: string): string {
	return (name || '')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0].toUpperCase())
		.join('');
}

export function personOf(employee: IEmployee | any): IPersonChip | null {
	const name = nameOf(employee);
	if (!name) return null;
	const user = employee?.user || employee;
	return {
		id: employee?.id,
		name,
		initials: initialsOf(name),
		avatarUrl: user?.image?.fullUrl || user?.imageUrl || undefined
	};
}

/** Live presence from the employee's own flags. */
export function presenceOf(employee: IEmployee | any): Presence {
	if (employee?.isTrackingTime) return 'tracking';
	if (employee?.isOnline && employee?.isAway) return 'away';
	if (employee?.isOnline) return 'online';
	return 'offline';
}

/** "in-progress" -> "In progress". */
export function humanize(value?: string): string {
	if (!value) return '';
	const text = String(value).replace(/[-_]+/g, ' ').trim();
	return text.charAt(0).toUpperCase() + text.slice(1);
}

const CLOSED_STATUSES = new Set<string>([TaskStatusEnum.DONE, TaskStatusEnum.COMPLETED, TaskStatusEnum.CANCELLED]);
const IN_PROGRESS_STATUSES = new Set<string>([
	TaskStatusEnum.IN_PROGRESS,
	TaskStatusEnum.READY_FOR_REVIEW,
	TaskStatusEnum.IN_REVIEW
]);

/** A task's status as a group, from its raw status slug or name ("In Review" reads as "in-review"). */
export function statusGroupOf(status: string | undefined): 'todo' | 'progress' | 'blocked' | 'done' {
	const value = (status || '').toLowerCase().replace(/\s+/g, '-');
	if (CLOSED_STATUSES.has(value)) return 'done';
	if (IN_PROGRESS_STATUSES.has(value)) return 'progress';
	if (value === TaskStatusEnum.BLOCKED) return 'blocked';
	return 'todo';
}

/** Due date in words, the way the task lists say it. */
export function dueInWords(daysLeft: number | null, isDone: boolean): { key: string; count?: number } {
	const prefix = 'EMPLOYEES_PAGE.VIEW.DUE.';
	if (daysLeft === null) return { key: prefix + 'NONE' };
	if (isDone) return { key: prefix + 'WAS_DUE' };
	if (daysLeft < -1) return { key: prefix + 'OVERDUE_DAYS', count: -daysLeft };
	if (daysLeft === -1) return { key: prefix + 'OVERDUE_DAY' };
	if (daysLeft === 0) return { key: prefix + 'TODAY' };
	if (daysLeft === 1) return { key: prefix + 'TOMORROW' };
	return { key: prefix + 'IN_DAYS', count: daysLeft };
}
