/**
 * Tasks between Ever Works and Gauzy (plan 01 §7): the contract's task DTO, the per-side snapshot the
 * engine diffs against, and the pure field rules. No I/O here.
 */
import { normaliseMarkdown } from './ever-works-markdown';

/** An assignee of an Ever Works task (contract v1 `PrincipalRef`). */
export interface EverWorksPrincipalRef {
	type: 'user' | 'agent';
	id: string;
}

/** A relation of an Ever Works task (contract v1). */
export interface EverWorksTaskRelation {
	taskId: string;
	kind: 'related' | 'duplicates' | 'follow-up';
}

/** An Ever Works task (contract v1 task DTO; also the `data` of `task.created/updated/transitioned/deleted`). */
export interface EverWorksTask {
	id: string;
	organizationId?: string;
	version?: number;
	createdAt?: string;
	updatedAt?: string;
	visibility?: string;
	visibilityExplicit?: boolean;
	externalLinks?: Array<{ source: string; installationId?: string | null; externalId: string; externalUrl?: string | null }>;
	teamIds?: string[];
	slug?: string;
	title: string;
	description?: string | null;
	status: string;
	priority?: string | null;
	labels?: string[];
	workId?: string | null;
	missionId?: string | null;
	ideaId?: string | null;
	goalId?: string | null;
	agentId?: string | null;
	parentTaskId?: string | null;
	assignees?: EverWorksPrincipalRef[];
	watchers?: string[];
	approvers?: Array<{ type: string; id: string; state: string }>;
	reviewers?: Array<{ type: string; id: string; state: string }>;
	blockedBy?: string[];
	relations?: EverWorksTaskRelation[];
	isRecurringTemplate?: boolean;
	hiddenFromBoard?: boolean;
	runtime?: { prUrl?: string | null; prState?: string | null; ciState?: string | null; latestRunStatus?: string | null } | null;
	webUrl?: string | null;
	/** EW-P2-3 (CR-3): planning fields; ISO or `null`, minutes 0..525600 or `null`. */
	dueAt?: string | null;
	startAt?: string | null;
	estimateMinutes?: number | null;
	deleted?: boolean;
}

/** The `data` of `task.visibility_changed` (a change to `private` carries only these two). */
export interface EverWorksVisibilityChange {
	id: string;
	visibility: string;
}

/**
 * The Ever Works side of the shared fields at the last sync: what an incoming Ever Works value is compared
 * with. Sets are sorted; assignees are `<type>:<id>`.
 */
export interface TaskEverWorksSide {
	title?: string;
	description?: string;
	status?: string;
	priority?: string | null;
	labels?: string[];
	teamIds?: string[];
	assignees?: string[];
	parentTaskId?: string | null;
	workId?: string | null;
	/** Watcher user ids. */
	watchers?: string[];
	/** Ids of the tasks that block this one. */
	blockedBy?: string[];
	/** `<kind>:<taskId>` (`related`, `duplicates`, `follow-up`). */
	relations?: string[];
	/** EW-P2-3 planning fields (G-P2-6). */
	dueAt?: string | null;
	startAt?: string | null;
	estimateMinutes?: number | null;
}

/**
 * The Gauzy side of the shared fields at the last sync, normalised (the description as Markdown, the
 * status and priority as slugs, tags by name): what the current Gauzy task is compared with.
 */
export interface TaskGauzySide {
	title?: string;
	description?: string;
	status?: string | null;
	priority?: string | null;
	tags?: string[];
	teamIds?: string[];
	memberIds?: string[];
	parentId?: string | null;
	projectId?: string | null;
	/** Employees watching the task (`EntitySubscription` of type `manual`). */
	watcherIds?: string[];
	/** Tasks that block this one (from `TaskLinkedIssue`, either direction of the pair). */
	blockedBy?: string[];
	/** `related:<taskId>` / `duplicates:<taskId>` (from `TaskLinkedIssue`). */
	relations?: string[];
	/** Due and start dates (ISO), and the estimate in seconds (G-P2-6). */
	dueDate?: string | null;
	startDate?: string | null;
	estimate?: number | null;
}

/**
 * A task link's snapshot. Each side keeps its own last-synced values, so a value that one side cannot
 * hold exactly (Ever Works `p2` and `p3` are both Gauzy `medium`; a 300-character title; HTML vs Markdown)
 * is never written back unless that side really changed it (plan 01 principle 4).
 */
export interface TaskSnapshot {
	g: TaskGauzySide;
	e: TaskEverWorksSide;
}

/** What only Ever Works has, kept on the link for display and for pushes that must not drop it. */
export interface TaskEverWorksOnly {
	slug?: string | null;
	webUrl?: string | null;
	missionId?: string | null;
	ideaId?: string | null;
	goalId?: string | null;
	agentId?: string | null;
	visibility?: string | null;
	visibilityExplicit?: boolean;
	approvers?: EverWorksTask['approvers'];
	reviewers?: EverWorksTask['reviewers'];
	runtime?: EverWorksTask['runtime'];
	hiddenFromBoard?: boolean;
	/** Ever Works teams and assignees Gauzy could not map at the last sync; tried again on the next change. */
	unmappedTeams?: string[];
	unmappedAssignees?: string[];
	/** Ever Works watchers and edges (`blocked:<id>`, `<kind>:<id>`) Gauzy could not map at the last sync. */
	unmappedWatchers?: string[];
	unmappedEdges?: string[];
	/** Gauzy watchers and edge targets Ever Works could not take at the last push (no link yet); retried. */
	pendingWatchers?: string[];
	pendingEdges?: string[];
	/**
	 * The Gauzy parent Ever Works refused at the last push (its owners are not the task's: Gauzy allows a parent
	 * on another team or project), so the task has no parent in Ever Works. Sent again once `key` (the parent
	 * and both sides' owners, as JSON) changes; `null` once the parent is in Ever Works.
	 */
	heldParent?: { parentId: string; key: string } | null;
	/**
	 * The task's Gauzy resource links to Ever Works (its web page, its pull request); `*Owned` when the sync
	 * made the link (a link a person added with the same URL is reused, never removed).
	 */
	resourceLinks?: { task?: string; pr?: string; taskOwned?: boolean; prOwned?: boolean };
	/** When the run state was last applied (`task.runtime_updated` carries no version: applied by recency). */
	runtimeAt?: string | null;
}

/** Ever Works' title limit (contract v1). */
export const EVER_WORKS_TITLE_LIMIT = 200;
/** Ever Works' label limits (contract v1 `CreateTask`). */
export const EVER_WORKS_LABEL_LIMIT = 80;
export const EVER_WORKS_LABELS_MAX = 50;

const FULL_TITLE_LABEL = '**Full title (from Gauzy):**';
const FULL_TITLE_APPENDIX = /(?:^|\n\n)> \*\*Full title \(from Gauzy\):\*\* ([^\n]*)\s*$/;

/** G → EW title: at most 200 characters; `truncated` when the full title has to travel in the description. */
export function titleForEverWorks(title: string | null | undefined): { title: string; truncated: boolean } {
	const value = String(title ?? '').trim() || 'Untitled';
	if (value.length <= EVER_WORKS_TITLE_LIMIT) return { title: value, truncated: false };
	return { title: `${value.slice(0, EVER_WORKS_TITLE_LIMIT - 1).trimEnd()}…`, truncated: true };
}

/** G → EW description: the Markdown, with the full title appended when the title had to be cut (plan 01 §7). */
export function descriptionForEverWorks(markdown: string, title: string | null | undefined): string {
	const { truncated } = titleForEverWorks(title);
	const body = normaliseMarkdown(markdown);
	if (!truncated) return body;
	const line = `> ${FULL_TITLE_LABEL} ${String(title ?? '').trim().replace(/\s+/g, ' ')}`;
	return body ? `${body}\n\n${line}` : line;
}

/** EW → G description: the Markdown without the full-title line Gauzy appended itself. */
export function stripTitleAppendix(markdown: string | null | undefined): string {
	return normaliseMarkdown(normaliseMarkdown(markdown).replace(FULL_TITLE_APPENDIX, ''));
}

/** Whether an Ever Works title is still the cut copy of the full title Gauzy appended to its description. */
export function isCutTitleCopy(title: string | null | undefined, markdown: string | null | undefined): boolean {
	const full = FULL_TITLE_APPENDIX.exec(normaliseMarkdown(markdown))?.[1]?.trim();
	if (!full || !title?.endsWith('…')) return false;
	const flat = (value: string) => value.replace(/\s+/g, ' ').trim();
	// Only the copy cut where Gauzy cuts it: a shorter start of the title is a rename in Ever Works (#11108 review).
	if (flat(title) === flat(titleForEverWorks(full).title)) return true;
	// The appendix has the title's whitespace collapsed, so a title with a run of spaces was cut further on: its
	// copy is still the whole limit before the `…`, and the full title starts with it.
	const start = title.slice(0, -1);
	return start.length === EVER_WORKS_TITLE_LIMIT - 1 && flat(full).startsWith(flat(start));
}

/** Ever Works labels from Gauzy tag names: trimmed, ≤ 80 characters, unique (case-insensitive), at most 50. */
export function labelsForEverWorks(names: ReadonlyArray<string | null | undefined>): string[] {
	const seen = new Set<string>();
	const labels: string[] = [];
	for (const name of names) {
		const label = String(name ?? '').trim().slice(0, EVER_WORKS_LABEL_LIMIT).trim();
		if (!label || seen.has(label.toLowerCase())) continue;
		seen.add(label.toLowerCase());
		labels.push(label);
		if (labels.length >= EVER_WORKS_LABELS_MAX) break;
	}
	return labels;
}

/** A principal as one string (`user:<id>`, `agent:<id>`). */
export const principalKey = (ref: EverWorksPrincipalRef): string => `${ref.type}:${ref.id}`;

/** A `user:<id>` / `agent:<id>` string back to a principal, or `null`. */
export function principalOf(key: string): EverWorksPrincipalRef | null {
	const match = /^(user|agent):(.+)$/.exec(key);
	return match ? { type: match[1] as 'user' | 'agent', id: match[2] as string } : null;
}

const sorted = (values: ReadonlyArray<string>) => [...new Set(values)].sort();

/** The Ever Works side of a task DTO, normalised for comparison. */
export function everWorksSideOf(task: EverWorksTask): TaskEverWorksSide {
	return {
		title: task.title ?? '',
		description: normaliseMarkdown(task.description),
		status: task.status,
		priority: task.priority ?? null,
		labels: sorted(task.labels ?? []),
		teamIds: sorted(task.teamIds ?? []),
		assignees: sorted((task.assignees ?? []).map(principalKey)),
		parentTaskId: task.parentTaskId ?? null,
		workId: task.workId ?? null,
		watchers: sorted(task.watchers ?? []),
		blockedBy: sorted(task.blockedBy ?? []),
		relations: sorted((task.relations ?? []).map((relation) => `${relation.kind}:${relation.taskId}`)),
		dueAt: isoOrNull(task.dueAt),
		startAt: isoOrNull(task.startAt),
		estimateMinutes: typeof task.estimateMinutes === 'number' ? task.estimateMinutes : null
	};
}

/** A date as ISO (so equal instants compare equal), or `null` for none or an unreadable one. */
export function isoOrNull(value: Date | string | null | undefined): string | null {
	if (value === null || value === undefined || value === '') return null;
	const time = new Date(value).getTime();
	return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/** Ever Works' estimate limit (minutes, contract v1 EW-P2-3). */
export const EVER_WORKS_ESTIMATE_MAX_MINUTES = 525600;

/** G → EW estimate: Gauzy seconds → whole minutes (rounded, within Ever Works' limit); none → `null`. */
export function estimateMinutesFor(seconds: number | null | undefined): number | null {
	if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null;
	return Math.min(EVER_WORKS_ESTIMATE_MAX_MINUTES, Math.round(seconds / 60));
}

/** EW → G estimate: minutes → Gauzy seconds; none → `null`. */
export function estimateSecondsFor(minutes: number | null | undefined): number | null {
	return typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes) * 60 : null;
}

/** The numbers of Gauzy's `TaskRelatedIssuesRelationEnum` the sync reads and writes. */
export const LINKED_ISSUE = { IS_BLOCKED_BY: 1, BLOCKS: 2, IS_DUPLICATED_BY: 5, DUPLICATES: 6, RELATES_TO: 7 } as const;

/** One `task_linked_issues` row as the sync reads it: `taskTo <action> taskFrom`, listed on `taskTo`. */
export interface LinkedIssueRow {
	taskToId: string;
	taskFromId: string;
	action: number;
}

/**
 * A Gauzy task's blockers and relations from its linked-issue rows, in Ever Works' shape (plan 01 §7). A
 * row is read from the task it is listed on (`taskTo`): `X IS_BLOCKED_BY Y` and `Y BLOCKS X` both mean X is
 * blocked by Y; `X DUPLICATES Y` and `Y IS_DUPLICATED_BY X` both mean X duplicates Y; `X RELATES_TO Y` is
 * X's relation. Clones are Gauzy-only and kept as they are.
 */
export function edgesFromRows(taskId: string, rows: ReadonlyArray<LinkedIssueRow>): { blockedBy: string[]; relations: string[] } {
	const blockedBy = new Set<string>();
	const relations = new Set<string>();
	for (const row of rows) {
		if (row.taskToId === row.taskFromId) continue;
		if (row.taskToId === taskId) {
			if (row.action === LINKED_ISSUE.IS_BLOCKED_BY) blockedBy.add(row.taskFromId);
			else if (row.action === LINKED_ISSUE.DUPLICATES) relations.add(`duplicates:${row.taskFromId}`);
			else if (row.action === LINKED_ISSUE.RELATES_TO) relations.add(`related:${row.taskFromId}`);
		} else if (row.taskFromId === taskId) {
			if (row.action === LINKED_ISSUE.BLOCKS) blockedBy.add(row.taskToId);
			else if (row.action === LINKED_ISSUE.IS_DUPLICATED_BY) relations.add(`duplicates:${row.taskToId}`);
		}
	}
	return { blockedBy: [...blockedBy].sort(), relations: [...relations].sort() };
}

/**
 * The linked-issue rows that say "task blocked by / relates to / duplicates other" in Gauzy — the row on the
 * task and its pair on the other task (plan 01 §7: pairs are created on both Gauzy tasks).
 */
export function linkedIssueRowsFor(kind: 'blocked' | 'related' | 'duplicates', taskId: string, otherId: string): LinkedIssueRow[] {
	if (kind === 'blocked') {
		return [
			{ taskToId: taskId, taskFromId: otherId, action: LINKED_ISSUE.IS_BLOCKED_BY },
			{ taskToId: otherId, taskFromId: taskId, action: LINKED_ISSUE.BLOCKS }
		];
	}
	if (kind === 'duplicates') {
		return [
			{ taskToId: taskId, taskFromId: otherId, action: LINKED_ISSUE.DUPLICATES },
			{ taskToId: otherId, taskFromId: taskId, action: LINKED_ISSUE.IS_DUPLICATED_BY }
		];
	}
	return [
		{ taskToId: taskId, taskFromId: otherId, action: LINKED_ISSUE.RELATES_TO },
		{ taskToId: otherId, taskFromId: taskId, action: LINKED_ISSUE.RELATES_TO }
	];
}

/** A relation compared by meaning: Ever Works' `follow-up` is Gauzy's `related` (the kind stays on the link). */
export const relationKey = (key: string): string => key.replace(/^follow-up:/, 'related:');

/** `<kind>:<id>` → its parts, or `null`. */
export function relationOf(key: string): { kind: string; id: string } | null {
	const match = /^(related|duplicates|follow-up):(.+)$/.exec(key);
	return match ? { kind: match[1] as string, id: match[2] as string } : null;
}

/** Whether two values of one field are the same (sets compare as sets, case-insensitively for names). */
export function sameField(a: unknown, b: unknown): boolean {
	if (Array.isArray(a) || Array.isArray(b)) {
		const left = new Set(((a as unknown[]) ?? []).map((v) => String(v).toLowerCase()));
		const right = new Set(((b as unknown[]) ?? []).map((v) => String(v).toLowerCase()));
		return left.size === right.size && [...left].every((v) => right.has(v));
	}
	return (a ?? null) === (b ?? null);
}

/**
 * Applies one side's change of a set (`from` → `to`) onto the other side's current set: removed members
 * are removed, added ones are added, and members the other side has on its own are kept — never a blind
 * replace (plan 03 §C.5, set 3-way merge). `key` compares members (case-insensitive names, ids, …).
 */
export function applySetChange<T>(current: ReadonlyArray<T>, from: ReadonlyArray<T>, to: ReadonlyArray<T>, key: (value: T) => string = (value) => String(value)): T[] {
	const before = new Set(from.map(key));
	const after = new Set(to.map(key));
	const removed = new Set([...before].filter((k) => !after.has(k)));
	const result = current.filter((value) => !removed.has(key(value)));
	const have = new Set(result.map(key));
	for (const value of to) {
		const k = key(value);
		if (before.has(k) || have.has(k)) continue;
		result.push(value);
		have.add(k);
	}
	return result;
}

/**
 * Last writer wins for a field both sides changed (plan 03 §C.5): Gauzy wins only when its change is
 * strictly later than Ever Works' event; a tie, or a missing time, goes to Ever Works.
 */
export function gauzyWins(gauzyAt: Date | string | null | undefined, everWorksAt: Date | string | null | undefined): boolean {
	const g = gauzyAt ? new Date(gauzyAt).getTime() : Number.NaN;
	const e = everWorksAt ? new Date(everWorksAt).getTime() : Number.NaN;
	return Number.isFinite(g) && (!Number.isFinite(e) || g > e);
}

/** A task link's snapshot, tolerant of an older or partial one. */
export function parseTaskSnapshot(raw: Partial<TaskSnapshot> | null | undefined): TaskSnapshot {
	return { g: { ...(raw?.g ?? {}) }, e: { ...(raw?.e ?? {}) } };
}

/** The status Ever Works accepts on create (`backlog` or `todo`); later moves go through `/transition`. */
export function createStatusFor(status: string | null): 'backlog' | 'todo' {
	return status === 'backlog' ? 'backlog' : 'todo';
}

/** One line on why Ever Works kept a status (`409 transition_blocked`), for the comment Gauzy adds. */
export function transitionBlockedMessage(kept: string, wanted: string, details: Record<string, unknown> | undefined): string {
	const blockers = Array.isArray(details?.['blockers']) ? (details?.['blockers'] as Array<Record<string, unknown>>) : [];
	const approvers = Array.isArray(details?.['pendingApprovers']) ? (details?.['pendingApprovers'] as unknown[]) : [];
	const parts: string[] = [];
	if (blockers.length) {
		const names = blockers
			.slice(0, 5)
			.map((blocker) => String(blocker['slug'] ?? blocker['title'] ?? blocker['taskId'] ?? '').trim())
			.filter(Boolean);
		parts.push(`blocked by ${names.join(', ') || `${blockers.length} task(s)`}${blockers.length > 5 ? ` and ${blockers.length - 5} more` : ''}`);
	}
	if (approvers.length) parts.push(`${approvers.length} approval(s) pending`);
	return `Ever Works kept the status "${kept}" instead of "${wanted}"${parts.length ? `: ${parts.join('; ')}` : ''}.`;
}
