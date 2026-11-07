import { TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { AsanaAttachment, AsanaSection, AsanaStory, AsanaTask, AsanaTaskUpdateInput } from '../client/asana-api.client';

/** The task status of a completed Asana task, and of one in a section the map does not name. */
export const ASANA_COMPLETED_STATUS = TaskStatusEnum.COMPLETED;
export const ASANA_DEFAULT_STATUS = TaskStatusEnum.OPEN;

/** How a status or section name is compared: case ignored, spaces and underscores as hyphens (`In Progress` = `in-progress`). */
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

/** The mapping's section map: section gid → task status name; unknown shapes are ignored. */
export function parseSectionMap(json: string | null | undefined): Record<string, string> {
	if (!json) return {};
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return {};
	}
	if (!parsed || typeof parsed !== 'object') return {};
	const result: Record<string, string> = {};
	for (const [gid, value] of Object.entries(parsed as Record<string, unknown>)) {
		if (gid && typeof value === 'string' && value.trim()) result[gid] = value.trim();
	}
	return result;
}

/** A section map as stored: only entries with a status, or null when none. */
export function serializeSectionMap(input: Record<string, string> | null | undefined): string | null {
	if (!input) return null;
	const kept: Record<string, string> = {};
	for (const [gid, value] of Object.entries(input)) {
		if (gid && typeof value === 'string' && value.trim()) kept[gid] = value.trim();
	}
	return Object.keys(kept).length ? JSON.stringify(kept) : null;
}

/** The section of a task within the mapped project, if any. */
export function sectionOf(task: AsanaTask, projectGid: string): AsanaSection | null {
	for (const membership of task.memberships ?? []) {
		if (membership?.project?.gid === projectGid && membership.section?.gid) return membership.section;
	}
	return null;
}

/**
 * The task status of an Asana task: completed → the completed status; else the section's status from the map
 * (as the project stores the name, when it has it); else the section's name when it is a status name of the
 * project (`knownStatuses`, by key — `In Progress` is `in-progress`); else open.
 */
export function taskStatusOf(task: AsanaTask, projectGid: string, sectionMap: Record<string, string>, knownStatuses: ReadonlyMap<string, string>): string {
	if (task.completed) return ASANA_COMPLETED_STATUS;
	const section = sectionOf(task, projectGid);
	if (!section) return ASANA_DEFAULT_STATUS;
	const mapped = sectionMap[section.gid];
	if (mapped) return knownStatuses.get(statusKey(mapped)) ?? mapped;
	return knownStatuses.get(statusKey(section.name)) ?? ASANA_DEFAULT_STATUS;
}

/** Whether a task status means the Asana task is done. */
export function isCompletedStatus(status: string | null | undefined): boolean {
	const value = status?.trim().toLowerCase();
	return value === TaskStatusEnum.COMPLETED || value === TaskStatusEnum.DONE || value === TaskStatusEnum.CANCELLED;
}

/** The section a task status moves an Asana task to: the first section the map names for that status, else the section named like it, or null. */
export function sectionForStatus(status: string | null | undefined, sectionMap: Record<string, string>, sections: readonly AsanaSection[]): AsanaSection | null {
	const wanted = statusKey(status);
	if (!wanted) return null;
	for (const [gid, name] of Object.entries(sectionMap)) {
		if (statusKey(name) === wanted) {
			const section = sections.find((candidate) => candidate.gid === gid);
			if (section) return section;
		}
	}
	return sections.find((candidate) => statusKey(candidate.name) === wanted) ?? null;
}

/** The task priority an Asana custom field called "Priority" names (an enum value with urgent / high / medium / low in it). */
export function taskPriorityOf(task: AsanaTask): TaskPriorityEnum | null {
	const field = (task.custom_fields ?? []).find((candidate) => /priority/i.test(candidate?.name ?? '') && candidate?.enum_value?.name);
	const value = field?.enum_value?.name?.toLowerCase() ?? '';
	if (!value) return null;
	if (/urgent|critical|p0/.test(value)) return TaskPriorityEnum.URGENT;
	if (/high|p1/.test(value)) return TaskPriorityEnum.HIGH;
	if (/medium|normal|p2/.test(value)) return TaskPriorityEnum.MEDIUM;
	if (/low|p3/.test(value)) return TaskPriorityEnum.LOW;
	return null;
}

/** An Asana calendar date (`YYYY-MM-DD`) as a date at midnight UTC, or null. */
export function dueDateOf(dueOn: string | null | undefined): Date | null {
	if (!dueOn || !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return null;
	const date = new Date(`${dueOn}T00:00:00.000Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** A date as Asana's calendar date, or null. */
export function asanaDueOnOf(date: Date | string | null | undefined): string | null {
	if (!date) return null;
	const value = typeof date === 'string' ? new Date(date) : date;
	return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
}

/** The task fields an Asana task sets (the rest — project, members, tags, parent — is the sync's to resolve). */
export function taskFieldsOf(task: AsanaTask, projectGid: string, sectionMap: Record<string, string>, knownStatuses: ReadonlyMap<string, string>) {
	return {
		title: task.name?.trim() || `Asana ${task.gid}`,
		description: task.notes?.trim() ? task.notes : null,
		status: taskStatusOf(task, projectGid, sectionMap, knownStatuses),
		priority: taskPriorityOf(task),
		dueDate: dueDateOf(task.due_on)
	};
}

/** What a task sends back to its Asana task: the fields the mapping covers, the completion by status. */
export function asanaUpdateOf(task: { title?: string | null; description?: string | null; status?: string | null; dueDate?: Date | string | null }): AsanaTaskUpdateInput {
	const input: AsanaTaskUpdateInput = {};
	if (task.title?.trim()) input.name = task.title.trim();
	if (task.description !== undefined) input.notes = task.description ?? '';
	if (task.status !== undefined) input.completed = isCompletedStatus(task.status);
	if (task.dueDate !== undefined) input.due_on = asanaDueOnOf(task.dueDate);
	return input;
}

/** The platform keeps a comment as HTML: the text's characters that would read as markup, escaped. */
export function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * A comment's body as the platform keeps it (HTML): the author's words, one paragraph per line; and, when the author
 * is nobody here (no employee with their e-mail), who wrote them, named first, so the comment is not read as the
 * connecting person's. Empty for a story without text.
 */
export function commentHtmlOf(story: Pick<AsanaStory, 'text' | 'created_by'>, attributed: boolean): string {
	const text = (story.text ?? '').trim();
	if (!text) return '';
	const paragraphs = text
		.split(/\r?\n+/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => `<p>${escapeHtml(line)}</p>`)
		.join('');
	if (attributed) return paragraphs;
	const name = story.created_by?.name?.trim() || 'Someone';
	return `<p><strong>${escapeHtml(name)}</strong> (Asana)</p>${paragraphs}`;
}

/** The link an attachment is kept as: its name, and the address that opens it (the view page, else the permalink, else the download); null without one. */
export function attachmentLinkOf(attachment: Pick<AsanaAttachment, 'name' | 'view_url' | 'permalink_url' | 'download_url'>): { title: string; url: string } | null {
	const url = (attachment.view_url || attachment.permalink_url || attachment.download_url || '').trim();
	if (!/^https?:\/\//i.test(url)) return null;
	return { title: (attachment.name ?? '').trim().slice(0, 255) || url, url };
}
