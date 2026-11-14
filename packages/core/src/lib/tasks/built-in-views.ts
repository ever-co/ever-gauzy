import { TaskBuiltInViewEnum } from '@gauzy/contracts';

/** How many days ahead "due soon" looks. */
export const DUE_SOON_DAYS = 7;

/** What a built-in view filters on, computed in the caller's time zone. */
export interface IBuiltInViewWindow {
	/** Only the caller's tasks. */
	mine: boolean;
	/** Due on or after this instant. */
	dueDateFrom?: Date;
	/** Due on or before this instant. */
	dueDateTo?: Date;
	/**
	 * The calendar days (`YYYY-MM-DD`) the window starts and ends on, in its zone. A due date stored as a date only
	 * (midnight UTC of its day) is compared with these days rather than the instants, so it counts on its own day.
	 */
	dueDateFromDay?: string;
	dueDateToDay?: string;
	/** Leave out the tasks that are done. */
	openOnly: boolean;
}

/** Whether a string names a built-in view. */
export function isBuiltInView(key: unknown): key is TaskBuiltInViewEnum {
	return Object.values(TaskBuiltInViewEnum).includes(key as TaskBuiltInViewEnum);
}

/** Whether the runtime knows this IANA time zone. */
export function isKnownTimeZone(timeZone: string | null | undefined): boolean {
	if (!timeZone) return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone });
		return true;
	} catch {
		return false;
	}
}

/** The offset of a time zone at an instant, in minutes east of UTC. */
export function zoneOffsetMinutes(at: Date, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(at);
	const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
	const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'));
	return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The calendar day an instant falls on in a time zone (`2026-11-14`). */
export function dayIn(at: Date, timeZone: string): string {
	return new Date(at.getTime() + zoneOffsetMinutes(at, timeZone) * 60_000).toISOString().slice(0, 10);
}

/** The start of the calendar day holding `at` in the time zone, as an instant. */
export function startOfDayIn(at: Date, timeZone: string): Date {
	const offset = zoneOffsetMinutes(at, timeZone);
	const local = new Date(at.getTime() + offset * 60_000);
	const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
	// The offset at local midnight may differ from the offset now (a DST change during the day).
	const guess = new Date(midnightLocal - offset * 60_000);
	const offsetAtMidnight = zoneOffsetMinutes(guess, timeZone);
	return new Date(midnightLocal - offsetAtMidnight * 60_000);
}

/** The start of the week (Monday) holding `at` in the time zone, as an instant. */
export function startOfWeekIn(at: Date, timeZone: string): Date {
	const dayStart = startOfDayIn(at, timeZone);
	const offset = zoneOffsetMinutes(dayStart, timeZone);
	const local = new Date(dayStart.getTime() + offset * 60_000);
	const weekday = local.getUTCDay(); // 0 = Sunday
	const daysSinceMonday = (weekday + 6) % 7;
	return startOfDayIn(new Date(dayStart.getTime() - daysSinceMonday * 86_400_000 + 12 * 3_600_000), timeZone);
}

export function addDays(at: Date, days: number, timeZone: string): Date {
	// Noon of the target day, then its start: immune to a DST change inside the span.
	return startOfDayIn(new Date(at.getTime() + days * 86_400_000 + 12 * 3_600_000), timeZone);
}

/**
 * The window of a built-in view at `now` in the caller's time zone (`UTC` when none is given):
 * `mine` has no date bound; `this-week` is Monday to Sunday of the current week; `overdue` is anything due before
 * today; `due-soon` is today through the next seven days.
 */
export function builtInViewWindow(key: TaskBuiltInViewEnum, now: Date, timeZone = 'UTC'): IBuiltInViewWindow {
	const zone = isKnownTimeZone(timeZone) ? timeZone : 'UTC';
	switch (key) {
		case TaskBuiltInViewEnum.THIS_WEEK: {
			const from = startOfWeekIn(now, zone);
			const to = new Date(addDays(from, 7, zone).getTime() - 1);
			return { mine: true, dueDateFrom: from, dueDateTo: to, dueDateFromDay: dayIn(from, zone), dueDateToDay: dayIn(to, zone), openOnly: false };
		}
		case TaskBuiltInViewEnum.OVERDUE: {
			const today = startOfDayIn(now, zone);
			const to = new Date(today.getTime() - 1);
			return { mine: true, dueDateTo: to, dueDateToDay: dayIn(to, zone), openOnly: true };
		}
		case TaskBuiltInViewEnum.DUE_SOON: {
			const today = startOfDayIn(now, zone);
			const to = new Date(addDays(today, DUE_SOON_DAYS + 1, zone).getTime() - 1);
			return { mine: true, dueDateFrom: today, dueDateTo: to, dueDateFromDay: dayIn(today, zone), dueDateToDay: dayIn(to, zone), openOnly: true };
		}
		case TaskBuiltInViewEnum.MINE:
		default:
			return { mine: true, openOnly: false };
	}
}

/** The relations a built-in view may load: what a task list shows, never tracked time or billing. */
export const BUILT_IN_VIEW_RELATIONS: ReadonlySet<string> = new Set([
	'members',
	'members.user',
	'tags',
	'project',
	'organizationSprint',
	'parent',
	'teams',
	'modules',
	'taskStatus',
	'taskPriority',
	'taskSize',
	'taskType'
]);

/** What a built-in view loads when the caller names nothing. */
export const BUILT_IN_VIEW_DEFAULT_RELATIONS: readonly string[] = ['members', 'members.user', 'tags', 'project', 'taskStatus', 'taskPriority', 'taskSize'];

/** Segments that would reach an object's prototype rather than a relation. */
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Dotted relation names (`members.user`) as the nested object the repository takes. The tree is built from
 * prototype-less objects and a segment that names the prototype is refused, so a crafted name cannot change
 * shared object state.
 */
export function relationsTreeOf(names: readonly string[]): Record<string, unknown> {
	const tree: Record<string, unknown> = Object.create(null);
	for (const name of names) {
		const parts = String(name)
			.split('.')
			.map((part) => part.trim())
			.filter(Boolean);
		if (parts.some((part) => FORBIDDEN_SEGMENTS.has(part))) {
			throw new Error(`RELATION_NOT_ALLOWED: "${name}" is not a relation.`);
		}
		let node = tree;
		parts.forEach((part, index) => {
			const isLeaf = index === parts.length - 1;
			const current = Object.prototype.hasOwnProperty.call(node, part) ? node[part] : undefined;
			if (isLeaf) {
				if (current === undefined) node[part] = true;
				return;
			}
			if (typeof current !== 'object' || current === null) node[part] = Object.create(null);
			node = node[part] as Record<string, unknown>;
		});
	}
	return tree;
}
