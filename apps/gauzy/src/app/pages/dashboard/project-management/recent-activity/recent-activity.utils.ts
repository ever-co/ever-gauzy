import * as moment from 'moment';
import { ActionTypeEnum, ActorTypeEnum, BaseEntityEnum, IActivityLog, IEmployee } from '@gauzy/contracts';

/** Where the panel's translations live. */
export const RECENT_ACTIVITY_I18N = 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.RECENT_ACTIVITY';

/** How a row is coloured: by what was done. */
export type RecentActivityTone = 'created' | 'updated' | 'deleted' | 'other';

/** One row of the recent activity panel. */
export interface IRecentActivityItem {
	id: string;
	/** What was done to what, e.g. "Task" and "Updated by Ada Lovelace", as translation keys where known. */
	entityLabelKey: string | null;
	/** The record kind in words, for a kind without a translation. */
	entityLabel: string;
	/** "Created by {{ actor }}" and friends; `null` for an action the log does not name, shown raw instead. */
	summaryKey: string | null;
	action: string;
	/** Who did it: a name, or a translation key for the system; empty when the row names no one. */
	actorName: string;
	actorKey: string | null;
	/** The record's title or name at the time, when the log carries it. */
	title: string;
	/** The fields an update changed. */
	changedFields: string[];
	/** The record's page, for a task or a project that is still there. */
	link: string[] | null;
	tone: RecentActivityTone;
	icon: string;
	createdAt: Date | string | undefined;
	/** "5 minutes ago". */
	when: string;
}

/** The kinds of record the panel can narrow to: everything, tasks, or projects. */
export type RecentActivityFilter = '' | BaseEntityEnum.Task | BaseEntityEnum.OrganizationProject;

/** Record kinds with a word of their own; any other kind is named from its type. */
const ENTITY_LABEL_KEYS: Partial<Record<BaseEntityEnum, string>> = {
	[BaseEntityEnum.Task]: 'TASK',
	[BaseEntityEnum.OrganizationProject]: 'PROJECT',
	[BaseEntityEnum.OrganizationSprint]: 'SPRINT',
	[BaseEntityEnum.OrganizationProjectModule]: 'MODULE',
	[BaseEntityEnum.OrganizationTeam]: 'TEAM',
	[BaseEntityEnum.Comment]: 'COMMENT',
	[BaseEntityEnum.DailyPlan]: 'DAILY_PLAN',
	[BaseEntityEnum.OrganizationContact]: 'CONTACT',
	[BaseEntityEnum.Document]: 'DOCUMENT'
};

/** The page each kind of record opens on. */
const ENTITY_LINKS: Partial<Record<BaseEntityEnum, string>> = {
	[BaseEntityEnum.Task]: '/pages/tasks/view',
	[BaseEntityEnum.OrganizationProject]: '/pages/organization/projects/view'
};

const ACTIONS: Record<ActionTypeEnum, { key: string; tone: RecentActivityTone; icon: string }> = {
	[ActionTypeEnum.Created]: { key: 'CREATED', tone: 'created', icon: 'plus-outline' },
	[ActionTypeEnum.Updated]: { key: 'UPDATED', tone: 'updated', icon: 'edit-outline' },
	[ActionTypeEnum.Deleted]: { key: 'DELETED', tone: 'deleted', icon: 'trash-2-outline' }
};

/** "OrganizationProjectModule" → "Organization project module". */
export function humanizeEntity(entity: string): string {
	const words = String(entity || '')
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A json column of the log. Postgres and MySQL return the value; SQLite stores it as a string, which the
 * API parses back on load but not always: both shapes are read here.
 */
function jsonOf<T>(value: unknown): T | null {
	if (typeof value !== 'string') {
		return (value as T) ?? null;
	}
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

/** The record's title or name as the log saved it, else the quoted name in the log's own description. */
function titleOf(log: IActivityLog): string {
	const data = jsonOf<Record<string, unknown>>(log.data);
	const named = data && typeof data === 'object' ? data['title'] || data['name'] || data['fullName'] : null;
	if (typeof named === 'string' && named.trim()) {
		return named.trim();
	}
	const quoted = /"(.+)"\s*$/.exec(log.description || '');
	return quoted ? quoted[1] : '';
}

/** Who did it: the author's full name, else their user's name, first and last name, or email. */
function authorOf(employee?: IEmployee | null): string {
	return (
		employee?.fullName ||
		employee?.user?.name ||
		[employee?.user?.firstName, employee?.user?.lastName].filter(Boolean).join(' ') ||
		employee?.user?.email ||
		''
	);
}

/**
 * One activity log row as a row of the panel. Pure, so each shape the API can return (an unknown action or
 * kind, SQLite's string json, no author, a system change) is covered without the Angular graph.
 *
 * @param log The activity log row.
 * @param now The moment the relative time is told from.
 */
export function toRecentActivityItem(log: IActivityLog, now: Date = new Date()): IRecentActivityItem {
	const action = String(log.action ?? '');
	const known = ACTIONS[action as ActionTypeEnum];
	const isSystem = log.actorType === ActorTypeEnum.System;
	const actorName = isSystem ? '' : authorOf(log.employee);
	const actorKey = isSystem ? `${RECENT_ACTIVITY_I18N}.SYSTEM` : null;
	const hasActor = isSystem || !!actorName;
	const entity = log.entity as BaseEntityEnum;
	const labelKey = ENTITY_LABEL_KEYS[entity];
	const page = ENTITY_LINKS[entity];
	const changed = jsonOf<unknown>(log.updatedFields);

	return {
		id: String(log.id ?? ''),
		entityLabelKey: labelKey ? `${RECENT_ACTIVITY_I18N}.ENTITY.${labelKey}` : null,
		entityLabel: humanizeEntity(entity),
		summaryKey: known ? `${RECENT_ACTIVITY_I18N}.${known.key}${hasActor ? '_BY' : ''}` : null,
		action,
		actorName,
		actorKey,
		title: titleOf(log),
		changedFields: Array.isArray(changed)
			? changed.filter((field): field is string => typeof field === 'string')
			: [],
		// A deleted record has no page left to open.
		link: page && log.entityId && action !== ActionTypeEnum.Deleted ? [page, log.entityId] : null,
		tone: known?.tone ?? 'other',
		icon: known?.icon ?? 'activity-outline',
		createdAt: log.createdAt,
		when: relativeTime(log.createdAt, now)
	};
}

/** How often the panel tells its rows' ages again, so "a few seconds ago" does not stay so. */
export const RECENT_ACTIVITY_CLOCK_MS = 60_000;

/** How long before `now` something happened, as the panel says it ("5 minutes ago"). */
export function relativeTime(createdAt: Date | string | null | undefined, now: Date = new Date()): string {
	return createdAt ? moment(createdAt).from(now) : '';
}

/**
 * The rows with their ages told again from `now`. Rows whose age reads the same are kept as they are, and
 * the list itself is kept when none changed, so an unchanged panel is not drawn again.
 */
export function withRelativeTimes(items: IRecentActivityItem[], now: Date = new Date()): IRecentActivityItem[] {
	let changed = false;
	const told = items.map((item) => {
		const when = relativeTime(item.createdAt, now);
		if (when === item.when) {
			return item;
		}
		changed = true;
		return { ...item, when };
	});
	return changed ? told : items;
}

/**
 * The rows already shown followed by a new page's, without the ones already there. The API pages by page
 * number, so activity logged between two pages pushes the last row of one page onto the next.
 */
export function mergeRecentActivity(
	existing: IRecentActivityItem[],
	incoming: IRecentActivityItem[]
): IRecentActivityItem[] {
	const seen = new Set(existing.map((item) => item.id));
	return [...existing, ...incoming.filter((item) => !seen.has(item.id))];
}
