import { TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { LinearAttachment, LinearComment, LinearIssue, LinearIssueUpdateInput, LinearStateType, LinearWorkflowState } from '../client/linear-api.client';

/** The kinds of Linear workflow state, in the order a reverse lookup prefers them. */
export const LINEAR_STATE_TYPES: readonly LinearStateType[] = ['started', 'completed', 'canceled', 'backlog', 'unstarted', 'triage'];

/** The task status each kind of Linear state becomes unless the mapping says otherwise. */
export const DEFAULT_STATE_MAP: Record<LinearStateType, string> = {
	triage: TaskStatusEnum.OPEN,
	backlog: TaskStatusEnum.BACKLOG,
	unstarted: TaskStatusEnum.OPEN,
	started: TaskStatusEnum.IN_PROGRESS,
	completed: TaskStatusEnum.COMPLETED,
	canceled: TaskStatusEnum.CANCELLED
};

/** The mapping's state map with the defaults under it; unknown keys and non-string values are dropped. */
export function parseStateMap(json: string | null | undefined): Record<LinearStateType, string> {
	const result = { ...DEFAULT_STATE_MAP };
	if (!json) return result;
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return result;
	}
	if (!parsed || typeof parsed !== 'object') return result;
	for (const type of LINEAR_STATE_TYPES) {
		const value = (parsed as Record<string, unknown>)[type];
		if (typeof value === 'string' && value.trim()) result[type] = value.trim();
	}
	return result;
}

/** A state map as stored: only the entries that differ from the defaults, or null when none does. */
export function serializeStateMap(input: Partial<Record<string, string>> | null | undefined): string | null {
	if (!input) return null;
	const kept: Partial<Record<LinearStateType, string>> = {};
	for (const type of LINEAR_STATE_TYPES) {
		const value = input[type];
		if (typeof value === 'string' && value.trim() && value.trim() !== DEFAULT_STATE_MAP[type]) kept[type] = value.trim();
	}
	return Object.keys(kept).length ? JSON.stringify(kept) : null;
}

/** The task status of a Linear state kind. */
export function taskStatusOf(type: LinearStateType | null | undefined, stateMap: Record<LinearStateType, string>): string {
	return (type && stateMap[type]) || DEFAULT_STATE_MAP.unstarted;
}

/** The Linear state kind a task status maps back to (the first kind, in preference order, that names it), or null. */
export function stateTypeOfStatus(status: string | null | undefined, stateMap: Record<LinearStateType, string>): LinearStateType | null {
	if (!status) return null;
	const wanted = status.trim().toLowerCase();
	for (const type of LINEAR_STATE_TYPES) {
		if (stateMap[type].toLowerCase() === wanted) return type;
	}
	return null;
}

/** The Linear workflow state a task status should move an issue to: the team's first state of the mapped kind. */
export function linearStateFor(status: string | null | undefined, states: readonly LinearWorkflowState[], stateMap: Record<LinearStateType, string>): LinearWorkflowState | null {
	const type = stateTypeOfStatus(status, stateMap);
	if (!type) return null;
	return states.find((state) => state.type === type) ?? null;
}

/** Linear's 1–4 priority as a task priority; 0 (none) is null. */
export function taskPriorityOf(priority: number | null | undefined): TaskPriorityEnum | null {
	switch (priority) {
		case 1:
			return TaskPriorityEnum.URGENT;
		case 2:
			return TaskPriorityEnum.HIGH;
		case 3:
			return TaskPriorityEnum.MEDIUM;
		case 4:
			return TaskPriorityEnum.LOW;
		default:
			return null;
	}
}

/** A task priority as Linear's number: 0 (none) for no priority, null for a priority Linear has no number for. */
export function linearPriorityOf(priority: string | null | undefined): number | null {
	switch (priority) {
		case TaskPriorityEnum.URGENT:
			return 1;
		case TaskPriorityEnum.HIGH:
			return 2;
		case TaskPriorityEnum.MEDIUM:
			return 3;
		case TaskPriorityEnum.LOW:
			return 4;
		case null:
		case undefined:
		case '':
			return 0;
		default:
			return null;
	}
}

/** A Linear calendar date (`YYYY-MM-DD`) as a date at midnight UTC, or null. */
export function dueDateOf(dueDate: string | null | undefined): Date | null {
	if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
	const date = new Date(`${dueDate}T00:00:00.000Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** A date as Linear's calendar date, or null. */
export function linearDueDateOf(date: Date | string | null | undefined): string | null {
	if (!date) return null;
	const value = typeof date === 'string' ? new Date(date) : date;
	return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
}

/** The task fields an issue sets (the rest — project, members, tags, parent — is the sync's to resolve). */
export function taskFieldsOf(issue: LinearIssue, stateMap: Record<LinearStateType, string>) {
	return {
		title: issue.title?.trim() || issue.identifier,
		description: issue.description ?? null,
		status: taskStatusOf(issue.state?.type, stateMap),
		priority: taskPriorityOf(issue.priority),
		dueDate: dueDateOf(issue.dueDate)
	};
}

/** What a task sends back to its issue: the fields the mapping covers, the state by kind. */
export function issueUpdateOf(
	task: { title?: string | null; description?: string | null; status?: string | null; priority?: string | null; dueDate?: Date | string | null },
	states: readonly LinearWorkflowState[],
	stateMap: Record<LinearStateType, string>
): LinearIssueUpdateInput {
	const input: LinearIssueUpdateInput = {};
	if (task.title?.trim()) input.title = task.title.trim();
	if (task.description !== undefined) input.description = task.description ?? null;
	const state = linearStateFor(task.status, states, stateMap);
	if (state) input.stateId = state.id;
	// Only what the task carries: a partial task, or a priority Linear has no number for, leaves the issue's alone;
	// an explicit null clears it.
	if (task.priority !== undefined) {
		const priority = linearPriorityOf(task.priority);
		if (priority !== null) input.priority = priority;
	}
	if (task.dueDate !== undefined) input.dueDate = linearDueDateOf(task.dueDate);
	return input;
}

/** The platform keeps a comment as HTML: the text's characters that would read as markup, escaped. */
export function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * A comment's body as the platform keeps it (HTML): the author's words as written (Linear's Markdown is kept as
 * text), one paragraph per line; and, when the author is nobody here (no employee with their e-mail), who wrote
 * them, named first, so the comment is not read as the connecting person's. Empty for a comment without text.
 */
export function commentHtmlOf(comment: Pick<LinearComment, 'body' | 'user'>, attributed: boolean): string {
	const text = (comment.body ?? '').trim();
	if (!text) return '';
	const paragraphs = text
		.split(/\r?\n+/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => `<p>${escapeHtml(line)}</p>`)
		.join('');
	if (attributed) return paragraphs;
	const name = comment.user?.displayName?.trim() || comment.user?.name?.trim() || 'Someone';
	return `<p><strong>${escapeHtml(name)}</strong> (Linear)</p>${paragraphs}`;
}

/** The link an attachment is kept as: its title and the address that opens it; null without an HTTP(S) address. */
export function attachmentLinkOf(attachment: Pick<LinearAttachment, 'title' | 'url'>): { title: string; url: string } | null {
	const url = (attachment.url ?? '').trim();
	if (!/^https?:\/\//i.test(url)) return null;
	return { title: (attachment.title ?? '').trim().slice(0, 255) || url, url };
}
