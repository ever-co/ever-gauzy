import { TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { TrelloAttachment, TrelloCard, TrelloCardUpdateInput, TrelloCommentAction, TrelloLabel, TrelloList } from '../client/trello-api.client';

/** The task status of a done or archived card, and of one in a list the map does not name. */
export const TRELLO_COMPLETED_STATUS = TaskStatusEnum.COMPLETED;
export const TRELLO_DEFAULT_STATUS = TaskStatusEnum.OPEN;

/** How a status or list name is compared: case ignored, spaces and underscores as hyphens (`In Progress` = `in-progress`). */
export function statusKey(value: string | null | undefined): string {
	return String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, '-');
}

/** The statuses a mapping may name, by key → the name as stored (the first of a key wins, so order them by precedence). */
export function knownStatusesOf(names: Iterable<string | null | undefined>): Map<string, string> {
	const known = new Map<string, string>();
	for (const name of names) {
		const key = statusKey(name);
		if (key && !known.has(key)) known.set(key, String(name).trim());
	}
	return known;
}

/** The mapping's list map: list id → task status name; unknown shapes are ignored. */
export function parseListMap(json: string | null | undefined): Record<string, string> {
	if (!json) return {};
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return {};
	}
	if (!parsed || typeof parsed !== 'object') return {};
	const result: Record<string, string> = {};
	for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
		if (id && typeof value === 'string' && value.trim()) result[id] = value.trim();
	}
	return result;
}

/** A list map as stored: only entries with a status, or null when none. */
export function serializeListMap(input: Record<string, string> | null | undefined): string | null {
	if (!input) return null;
	const kept: Record<string, string> = {};
	for (const [id, value] of Object.entries(input)) {
		if (id && typeof value === 'string' && value.trim()) kept[id] = value.trim();
	}
	return Object.keys(kept).length ? JSON.stringify(kept) : null;
}

/** Whether a task status means the card is done. */
export function isCompletedStatus(status: string | null | undefined): boolean {
	const value = status?.trim().toLowerCase();
	return value === TaskStatusEnum.COMPLETED || value === TaskStatusEnum.DONE || value === TaskStatusEnum.CANCELLED;
}

/**
 * The task status of a card: archived or marked done → the completed status; else the list's status from the map
 * (as the project stores the name, when it has it); else the list's name when it is a status name of the project
 * (`knownStatuses`, by key — `In Progress` is `in-progress`); else open.
 */
export function taskStatusOf(card: Pick<TrelloCard, 'closed' | 'dueComplete' | 'idList'>, lists: ReadonlyMap<string, string>, listMap: Record<string, string>, knownStatuses: ReadonlyMap<string, string>): string {
	if (card.closed || card.dueComplete) return TRELLO_COMPLETED_STATUS;
	const mapped = listMap[card.idList];
	if (mapped) return knownStatuses.get(statusKey(mapped)) ?? mapped;
	const listName = lists.get(card.idList);
	return (listName && knownStatuses.get(statusKey(listName))) || TRELLO_DEFAULT_STATUS;
}

/** The list a task status moves a card to: the first list the map names for that status, else the list named like it, or null. */
export function listForStatus(status: string | null | undefined, listMap: Record<string, string>, lists: readonly TrelloList[]): TrelloList | null {
	const wanted = statusKey(status);
	if (!wanted) return null;
	for (const [id, name] of Object.entries(listMap)) {
		if (statusKey(name) === wanted) {
			const list = lists.find((candidate) => candidate.id === id);
			if (list) return list;
		}
	}
	return lists.find((candidate) => statusKey(candidate.name) === wanted) ?? null;
}

/** The task priority a card's labels name (a label called urgent / high / medium / low, or `Priority: High`). */
export function taskPriorityOf(labels: readonly Pick<TrelloLabel, 'name'>[]): TaskPriorityEnum | null {
	for (const label of labels ?? []) {
		const value = (label?.name ?? '').toLowerCase().replace(/^priority\s*[:\-]?\s*/, '');
		if (!value) continue;
		if (/^(urgent|critical|p0)$/.test(value)) return TaskPriorityEnum.URGENT;
		if (/^(high|p1)$/.test(value)) return TaskPriorityEnum.HIGH;
		if (/^(medium|normal|p2)$/.test(value)) return TaskPriorityEnum.MEDIUM;
		if (/^(low|p3)$/.test(value)) return TaskPriorityEnum.LOW;
	}
	return null;
}

/** A card's due date-time as a date, or null. */
export function dueDateOf(due: string | null | undefined): Date | null {
	if (!due) return null;
	const date = new Date(due);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** A date as Trello's due date-time, or null. */
export function trelloDueOf(date: Date | string | null | undefined): string | null {
	if (!date) return null;
	const value = typeof date === 'string' ? new Date(date) : date;
	return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

/** The task fields a card sets (the rest — project, members, tags — is the sync's to resolve). */
export function taskFieldsOf(card: TrelloCard, lists: ReadonlyMap<string, string>, listMap: Record<string, string>, knownStatuses: ReadonlyMap<string, string>) {
	return {
		title: card.name?.trim() || `Trello ${card.id}`,
		description: card.desc?.trim() ? card.desc : null,
		status: taskStatusOf(card, lists, listMap, knownStatuses),
		priority: taskPriorityOf(card.labels ?? []),
		dueDate: dueDateOf(card.due)
	};
}

/** What a task sends back to its card: the fields the mapping covers; done by status marks the due date complete. */
export function trelloUpdateOf(task: { title?: string | null; description?: string | null; status?: string | null; dueDate?: Date | string | null }): TrelloCardUpdateInput {
	const input: TrelloCardUpdateInput = {};
	if (task.title?.trim()) input.name = task.title.trim();
	if (task.description !== undefined) input.desc = task.description ?? '';
	if (task.status !== undefined) input.dueComplete = isCompletedStatus(task.status);
	if (task.dueDate !== undefined) input.due = trelloDueOf(task.dueDate);
	return input;
}

/** Whether a card changed after the watermark (the cards of an incremental import). */
export function isChangedSince(card: Pick<TrelloCard, 'dateLastActivity'>, since: string | null | undefined): boolean {
	return !since || !card.dateLastActivity || card.dateLastActivity > since;
}

/** Trello names its label colours (`green`, `red_dark`, …); a hex the platform's tags take. */
export function trelloColorOf(color: string | null | undefined): string {
	const named: Record<string, string> = {
		green: '#4BCE97',
		yellow: '#F5CD47',
		orange: '#FEA362',
		red: '#F87168',
		purple: '#9F8FEF',
		blue: '#579DFF',
		sky: '#6CC3E0',
		lime: '#94C748',
		pink: '#E774BB',
		black: '#8590A2'
	};
	const base = String(color ?? '')
		.toLowerCase()
		.replace(/_(light|dark)$/, '');
	return named[base] ?? '#6E7681';
}

/** The platform keeps a comment as HTML: the text's characters that would read as markup, escaped. */
export function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * A comment's body as the platform keeps it (HTML): who wrote it, named first — a Trello member's username and
 * display name are chosen by the member, so the comment is never attributed to an employee from them and the name
 * stays in the text — then the member's words, one paragraph per line. Empty for a comment without text.
 */
export function commentHtmlOf(action: Pick<TrelloCommentAction, 'data' | 'memberCreator'>): string {
	const text = (action.data?.text ?? '').trim();
	if (!text) return '';
	const paragraphs = text
		.split(/\r?\n+/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => `<p>${escapeHtml(line)}</p>`)
		.join('');
	const name = action.memberCreator?.fullName?.trim() || action.memberCreator?.username?.trim() || 'Someone';
	return `<p><strong>${escapeHtml(name)}</strong> (Trello)</p>${paragraphs}`;
}

/** The link an attachment is kept as: its name and the address that opens it; null without an HTTP(S) address. */
export function attachmentLinkOf(attachment: Pick<TrelloAttachment, 'name' | 'url'>): { title: string; url: string } | null {
	const url = (attachment.url ?? '').trim();
	if (!/^https?:\/\//i.test(url)) return null;
	return { title: (attachment.name ?? '').trim().slice(0, 255) || url, url };
}
