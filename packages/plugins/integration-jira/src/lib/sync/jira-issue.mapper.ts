// cspell:ignore issuetype issuelinks duedate Cloners duplicat
import { TaskPriorityEnum, TaskRelatedIssuesRelationEnum, TaskStatusEnum } from '@gauzy/contracts';
import {
	JIRA_STATUS_CATEGORIES,
	JiraAttachment,
	JiraComment,
	JiraIssue,
	JiraIssueFieldsUpdate,
	JiraIssueLink,
	JiraIssueType,
	JiraPriority,
	JiraStatus,
	JiraStatusCategoryKey,
	JiraTransition
} from '../client/jira-api.client';
import { adfToHtml, escapeHtml, htmlToAdf } from './jira-adf';

/**
 * A mapping's status map: a task status name for each Jira status category (`new`, `indeterminate`, `done`), and,
 * for the statuses a category does not say enough about, for one Jira status by its id (`status:<id>`). A status of
 * its own wins over its category, both ways: an issue in it becomes that task status, and a task in that status is
 * moved to it.
 */
export type JiraStatusMap = Record<string, string>;

/** The task status each status category becomes unless the mapping says otherwise. */
export const DEFAULT_STATUS_MAP: Readonly<Record<JiraStatusCategoryKey, string>> = {
	new: TaskStatusEnum.OPEN,
	indeterminate: TaskStatusEnum.IN_PROGRESS,
	done: TaskStatusEnum.COMPLETED
};

/** How many entries a status map keeps (a workflow has a few dozen statuses at most). */
export const STATUS_MAP_MAX_ENTRIES = 200;

const STATUS_KEY = /^status:(\d{1,20})$/;

/** Whether a key names a status category or one status. */
export function isStatusMapKey(key: string): boolean {
	return (JIRA_STATUS_CATEGORIES as readonly string[]).includes(key) || STATUS_KEY.test(key);
}

/** The entries of a status map that are usable: a known key, a status name of 1 to 100 characters. */
function usableEntries(input: unknown): Array<[string, string]> {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
	const entries: Array<[string, string]> = [];
	for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
		if (!isStatusMapKey(key) || typeof value !== 'string') continue;
		const name = value.trim();
		if (!name || name.length > 100) continue;
		entries.push([key, name]);
		if (entries.length >= STATUS_MAP_MAX_ENTRIES) break;
	}
	return entries;
}

/** The mapping's status map with the category defaults under it; unknown keys and unusable values are dropped. */
export function parseStatusMap(json: string | null | undefined): JiraStatusMap {
	const result: JiraStatusMap = { ...DEFAULT_STATUS_MAP };
	if (!json) return result;
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return result;
	}
	for (const [key, value] of usableEntries(parsed)) result[key] = value;
	return result;
}

/** A status map as stored: the category entries that differ from the defaults and every status entry, or null when none is left. */
export function serializeStatusMap(input: Partial<Record<string, string>> | null | undefined): string | null {
	if (!input) return null;
	const kept: JiraStatusMap = {};
	for (const [key, value] of usableEntries(input)) {
		if ((JIRA_STATUS_CATEGORIES as readonly string[]).includes(key) && value === DEFAULT_STATUS_MAP[key as JiraStatusCategoryKey]) continue;
		kept[key] = value;
	}
	return Object.keys(kept).length ? JSON.stringify(kept) : null;
}

/** The keys of a status map input that are not a category or a status id (a route refuses them). */
export function invalidStatusMapKeys(input: Record<string, unknown> | null | undefined): string[] {
	if (!input) return [];
	return Object.keys(input).filter((key) => !isStatusMapKey(key));
}

function categoryOf(status: Pick<JiraStatus, 'statusCategory'> | null | undefined): JiraStatusCategoryKey {
	const key = status?.statusCategory?.key;
	return (JIRA_STATUS_CATEGORIES as readonly string[]).includes(String(key)) ? (key as JiraStatusCategoryKey) : 'new';
}

/** The task status a Jira status becomes: its own entry, else its category's. */
export function taskStatusOf(status: Pick<JiraStatus, 'id' | 'statusCategory'> | null | undefined, statusMap: JiraStatusMap): string {
	if (status?.id && statusMap[`status:${status.id}`]) return statusMap[`status:${status.id}`];
	return statusMap[categoryOf(status)] || DEFAULT_STATUS_MAP[categoryOf(status)];
}

function same(a: string | null | undefined, b: string | null | undefined): boolean {
	return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * The transition that moves an issue to where a task status maps, or null when there is nothing to do (the issue's
 * status already maps to it, no status of the map names it, or no transition the issue can take now reaches one).
 *
 * Of the transitions whose target status maps to the task status, the one whose target has an entry of its own in the
 * map comes first (the person named that status), then one reached by its category; within each, one Jira can apply
 * without a screen of fields to fill, then Jira's own order (its workflow's).
 */
export function chooseTransition(
	transitions: readonly JiraTransition[],
	current: Pick<JiraStatus, 'id' | 'statusCategory'> | null | undefined,
	taskStatus: string | null | undefined,
	statusMap: JiraStatusMap
): JiraTransition | null {
	if (!taskStatus?.trim()) return null;
	if (current && same(taskStatusOf(current, statusMap), taskStatus)) return null;
	const candidates = transitions
		.map((transition, index) => ({ transition, index }))
		.filter(({ transition }) => transition.isAvailable !== false && transition.to?.id !== current?.id && same(taskStatusOf(transition.to, statusMap), taskStatus));
	if (!candidates.length) return null;
	const rank = (transition: JiraTransition) => (statusMap[`status:${transition.to.id}`] ? 0 : 2) + (transition.hasScreen ? 1 : 0);
	candidates.sort((a, b) => rank(a.transition) - rank(b.transition) || a.index - b.index);
	return candidates[0].transition;
}

/** A Jira priority (by its name: a site names its own) as a task priority; null when it says nothing the platform has. */
export function taskPriorityOf(priority: Pick<JiraPriority, 'name'> | null | undefined): TaskPriorityEnum | null {
	const name = priority?.name?.trim().toLowerCase();
	if (!name) return null;
	if (/^(highest|blocker|critical|urgent)\b/.test(name)) return TaskPriorityEnum.URGENT;
	if (/^(high|major)\b/.test(name)) return TaskPriorityEnum.HIGH;
	if (/^(medium|normal)\b/.test(name)) return TaskPriorityEnum.MEDIUM;
	if (/^(low|lowest|minor|trivial)\b/.test(name)) return TaskPriorityEnum.LOW;
	return null;
}

/** The names a task priority looks for among the site's priorities, best first. */
const PRIORITY_NAMES: Record<TaskPriorityEnum, readonly string[]> = {
	[TaskPriorityEnum.URGENT]: ['highest', 'blocker', 'critical', 'urgent'],
	[TaskPriorityEnum.HIGH]: ['high', 'major'],
	[TaskPriorityEnum.MEDIUM]: ['medium', 'normal'],
	[TaskPriorityEnum.LOW]: ['low', 'minor', 'lowest', 'trivial']
};

/** The site's priority a task priority becomes, or null when the site has none of its names (the issue's is left alone). */
export function jiraPriorityFor(priority: string | null | undefined, sitePriorities: readonly JiraPriority[]): JiraPriority | null {
	const names = priority ? PRIORITY_NAMES[priority.trim().toLowerCase() as TaskPriorityEnum] : undefined;
	if (!names) return null;
	for (const name of names) {
		const found = sitePriorities.find((candidate) => candidate.name?.trim().toLowerCase() === name);
		if (found) return found;
	}
	return null;
}

/** A Jira calendar date (`YYYY-MM-DD`) as a date at midnight UTC, or null. */
export function dueDateOf(dueDate: string | null | undefined): Date | null {
	if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
	const date = new Date(`${dueDate}T00:00:00.000Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** A date as Jira's calendar date, read in UTC (the day it was imported as), or null. */
export function jiraDueDateOf(date: Date | string | null | undefined): string | null {
	if (!date) return null;
	const value = typeof date === 'string' ? new Date(date) : date;
	return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
}

/** Whether an issue's type is one the mapping imports (every type when the mapping names none). */
export function isIssueTypeAllowed(issue: Pick<JiraIssue, 'fields'>, issueTypeIds: readonly string[] | null | undefined): boolean {
	if (!issueTypeIds?.length) return true;
	const id = issue.fields?.issuetype?.id;
	return !!id && issueTypeIds.includes(String(id));
}

/** The issue type ids a mapping stores (JSON), or null for every type. */
export function parseIssueTypeIds(json: string | null | undefined): string[] | null {
	if (!json) return null;
	try {
		const parsed = JSON.parse(json);
		if (!Array.isArray(parsed)) return null;
		const ids = parsed.map(String).filter((id) => /^\d{1,20}$/.test(id));
		return ids.length ? [...new Set(ids)] : null;
	} catch {
		return null;
	}
}

/** Issue type ids as stored: digits only, each once, or null for every type. */
export function serializeIssueTypeIds(ids: readonly string[] | null | undefined): string | null {
	if (!ids?.length) return null;
	const kept = [...new Set(ids.map(String).filter((id) => /^\d{1,20}$/.test(id)))].slice(0, 100);
	return kept.length ? JSON.stringify(kept) : null;
}

/**
 * The issue type a task sent out is created as: the mapping's first type when it names some (and the project has it),
 * else the project's "Task", else its first standard type (never a sub-task: one needs a parent). Null when the
 * project has none the task can be.
 */
export function chooseCreateIssueType(issueTypes: readonly JiraIssueType[], allowedIds: readonly string[] | null | undefined): JiraIssueType | null {
	const standard = issueTypes.filter((type) => !type.subtask);
	if (allowedIds?.length) {
		for (const id of allowedIds) {
			const found = standard.find((type) => type.id === id);
			if (found) return found;
		}
		return null;
	}
	return (
		standard.find((type) => type.name?.trim().toLowerCase() === 'task') ??
		standard.find((type) => type.hierarchyLevel === 0) ??
		standard[0] ??
		null
	);
}

/** The task fields an issue sets (the rest — project, members, tags, parent, links — is the sync's to resolve). */
export function taskFieldsOf(issue: JiraIssue, statusMap: JiraStatusMap) {
	const fields = issue.fields ?? ({} as JiraIssue['fields']);
	return {
		title: fields.summary?.trim() || issue.key,
		// ADF as the task store's HTML; null when Jira has none, so the task's old description goes too.
		description: adfToHtml(fields.description),
		status: taskStatusOf(fields.status, statusMap),
		priority: taskPriorityOf(fields.priority),
		dueDate: dueDateOf(fields.duedate)
	};
}

/** What a task sends to its issue's fields (the status goes by a transition): only what the task carries. */
export function issueUpdateOf(
	task: { title?: string | null; description?: string | null; priority?: string | null; dueDate?: Date | string | null },
	sitePriorities: readonly JiraPriority[]
): JiraIssueFieldsUpdate {
	const update: JiraIssueFieldsUpdate = {};
	if (task.title?.trim()) update.summary = task.title.trim().slice(0, 255);
	if (task.description !== undefined) update.description = htmlToAdf(task.description);
	// A priority the site has no name for, or none (Jira's priority is usually required), leaves the issue's alone.
	if (task.priority) {
		const priority = jiraPriorityFor(task.priority, sitePriorities);
		if (priority) update.priority = { id: priority.id };
	}
	if (task.dueDate !== undefined) update.duedate = jiraDueDateOf(task.dueDate);
	return update;
}

/** The platform's relation an issue link is, read from the issue it points out of (`outward`). */
export function linkActionOf(link: Pick<JiraIssueLink, 'type'>): TaskRelatedIssuesRelationEnum {
	const name = `${link.type?.name ?? ''} ${link.type?.outward ?? ''}`.toLowerCase();
	if (/block/.test(name)) return TaskRelatedIssuesRelationEnum.BLOCKS;
	if (/clone/.test(name)) return TaskRelatedIssuesRelationEnum.CLONES;
	if (/duplicat/.test(name)) return TaskRelatedIssuesRelationEnum.DUPLICATES;
	return TaskRelatedIssuesRelationEnum.RELATES_TO;
}

/** A link of an issue as the platform's relation: from the issue the link points out of, to the one it points at. */
export function linkEndsOf(issueId: string, link: JiraIssueLink): { fromSourceId: string; toSourceId: string; action: TaskRelatedIssuesRelationEnum } | null {
	const action = linkActionOf(link);
	if (link.outwardIssue?.id) return { fromSourceId: issueId, toSourceId: String(link.outwardIssue.id), action };
	if (link.inwardIssue?.id) return { fromSourceId: String(link.inwardIssue.id), toSourceId: issueId, action };
	return null;
}

/**
 * A comment's body as the platform keeps it (HTML from its ADF); and, when the author is nobody here (no employee with
 * their e-mail), who wrote it, named first, so the comment is not read as the connecting person's. Empty for a comment
 * without text.
 */
export function commentHtmlOf(comment: Pick<JiraComment, 'body' | 'author'>, attributed: boolean): string {
	const body = adfToHtml(comment.body);
	if (!body) return '';
	if (attributed) return body;
	const name = comment.author?.displayName?.trim() || 'Someone';
	return `<p><strong>${escapeHtml(name)}</strong> (Jira)</p>${body}`;
}

/** The link an attachment is kept as: its file name and the address that opens it; null without an HTTPS address. */
export function attachmentLinkOf(attachment: Pick<JiraAttachment, 'filename' | 'content'>): { title: string; url: string } | null {
	const url = (attachment.content ?? '').trim();
	if (!/^https:\/\//i.test(url)) return null;
	return { title: (attachment.filename ?? '').trim().slice(0, 255) || url, url };
}

/** The address of an issue on its site, for the people reading the platform's task. */
export function issueBrowseUrlOf(siteUrl: string | null | undefined, key: string): string | null {
	if (!siteUrl || !/^https:\/\//i.test(siteUrl)) return null;
	return `${siteUrl.replace(/\/+$/, '')}/browse/${encodeURIComponent(key)}`;
}
