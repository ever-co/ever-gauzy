/**
 * Task status and priority between Ever Works and Gauzy (plan 01 §7, §7.1). Pure functions.
 */

/** Ever Works task statuses (contract v1, closed set). */
export type EverWorksTaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled';

export const EVER_WORKS_TASK_STATUSES: ReadonlyArray<EverWorksTaskStatus> = [
	'backlog',
	'todo',
	'in_progress',
	'in_review',
	'blocked',
	'done',
	'cancelled'
];

/** Ever Works priorities (contract v1). */
export type EverWorksPriority = 'p0' | 'p1' | 'p2' | 'p3' | 'p4';

/** The flags a Gauzy `TaskStatus` row carries, used when its slug is custom. */
export interface GauzyStatusFlags {
	isTodo?: boolean | null;
	isInProgress?: boolean | null;
	isDone?: boolean | null;
}

/** What a Gauzy status should be for an Ever Works one: a slug, and the flag to fall back on in custom scopes. */
export interface GauzyStatusTarget {
	slug: string;
	/** `null` = "all flags false" (cancelled). */
	flag: keyof GauzyStatusFlags | null;
}

const EW_TO_GAUZY_STATUS: Record<EverWorksTaskStatus, GauzyStatusTarget> = {
	backlog: { slug: 'backlog', flag: 'isTodo' },
	todo: { slug: 'open', flag: 'isTodo' },
	in_progress: { slug: 'in-progress', flag: 'isInProgress' },
	in_review: { slug: 'in-review', flag: 'isInProgress' },
	blocked: { slug: 'blocked', flag: 'isInProgress' },
	done: { slug: 'done', flag: 'isDone' },
	cancelled: { slug: 'cancelled', flag: null }
};

const GAUZY_TO_EW_STATUS: Record<string, EverWorksTaskStatus> = {
	backlog: 'backlog',
	open: 'todo',
	'in-progress': 'in_progress',
	'ready-for-review': 'in_review',
	'in-review': 'in_review',
	blocked: 'blocked',
	done: 'done',
	completed: 'done',
	cancelled: 'cancelled'
};

/** Normalises a Gauzy status name or slug ("In Progress", "in_progress", "in-progress") to its slug. */
export function gauzyStatusSlug(value: string | null | undefined): string {
	return String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, '-');
}

/** EW → G: the Gauzy status slug (and flag fallback) for an Ever Works status; `null` for an unknown one. */
export function everWorksStatusToGauzy(status: string | null | undefined): GauzyStatusTarget | null {
	return (EW_TO_GAUZY_STATUS as Record<string, GauzyStatusTarget>)[String(status ?? '')] ?? null;
}

/**
 * G → EW: the Ever Works status for a Gauzy status. Known slugs map by table; a custom slug maps by its
 * flags (`isDone` → done, `isInProgress` → in_progress, `isTodo` → todo); none → `null` (leave unchanged).
 */
export function gauzyStatusToEverWorks(status: string | null | undefined, flags: GauzyStatusFlags = {}): EverWorksTaskStatus | null {
	const slug = gauzyStatusSlug(status);
	const known = GAUZY_TO_EW_STATUS[slug];
	if (known) return known;
	if (flags.isDone) return 'done';
	if (flags.isInProgress) return 'in_progress';
	if (flags.isTodo) return 'todo';
	return null;
}

/**
 * Picks the Gauzy status row for an Ever Works status among the rows of the task's scope (already
 * ordered team → project → organization → global by the caller): by slug first, then by flag.
 */
export function resolveGauzyStatusRow<T extends GauzyStatusFlags & { value?: string | null; name?: string | null }>(
	status: string,
	candidates: ReadonlyArray<T>
): T | null {
	const target = everWorksStatusToGauzy(status);
	if (!target) return null;
	const bySlug = candidates.find((row) => gauzyStatusSlug(row.value ?? row.name) === target.slug);
	if (bySlug) return bySlug;
	if (target.flag === null) {
		return candidates.find((row) => !row.isTodo && !row.isInProgress && !row.isDone) ?? null;
	}
	return candidates.find((row) => !!row[target.flag as keyof GauzyStatusFlags]) ?? null;
}

const EW_TO_GAUZY_PRIORITY: Record<EverWorksPriority, string> = {
	p0: 'urgent',
	p1: 'high',
	p2: 'medium',
	p3: 'medium',
	p4: 'low'
};

const GAUZY_TO_EW_PRIORITY: Record<string, EverWorksPriority> = {
	urgent: 'p0',
	high: 'p1',
	medium: 'p3',
	low: 'p4'
};

/** EW → G priority slug; unknown → `null` (leave unchanged). */
export function everWorksPriorityToGauzy(priority: string | null | undefined): string | null {
	return (EW_TO_GAUZY_PRIORITY as Record<string, string>)[String(priority ?? '').toLowerCase()] ?? null;
}

/** G → EW priority; unknown or custom → `null` (leave unchanged). `medium` → p3, Ever Works' default. */
export function gauzyPriorityToEverWorks(priority: string | null | undefined): EverWorksPriority | null {
	return GAUZY_TO_EW_PRIORITY[gauzyStatusSlug(priority)] ?? null;
}
