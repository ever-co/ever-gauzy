import { TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { AsanaSection, AsanaTask, AsanaTaskUpdateInput } from '../client/asana-api.client';

/** The task status of a completed Asana task, and of one in a section the map does not name. */
export const ASANA_COMPLETED_STATUS = TaskStatusEnum.COMPLETED;
export const ASANA_DEFAULT_STATUS = TaskStatusEnum.OPEN;

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
 * The task status of an Asana task: completed → the completed status; else the section's status from the map;
 * else the section's name when it is a status name of the project (`knownStatuses`, lower-cased); else open.
 */
export function taskStatusOf(task: AsanaTask, projectGid: string, sectionMap: Record<string, string>, knownStatuses: ReadonlySet<string>): string {
	if (task.completed) return ASANA_COMPLETED_STATUS;
	const section = sectionOf(task, projectGid);
	if (!section) return ASANA_DEFAULT_STATUS;
	const mapped = sectionMap[section.gid];
	if (mapped) return mapped;
	const byName = section.name?.trim().toLowerCase();
	return byName && knownStatuses.has(byName) ? byName : ASANA_DEFAULT_STATUS;
}

/** Whether a task status means the Asana task is done. */
export function isCompletedStatus(status: string | null | undefined): boolean {
	const value = status?.trim().toLowerCase();
	return value === TaskStatusEnum.COMPLETED || value === TaskStatusEnum.DONE || value === TaskStatusEnum.CANCELLED;
}

/** The section a task status moves an Asana task to: the first section the map names for that status, or null. */
export function sectionForStatus(status: string | null | undefined, sectionMap: Record<string, string>, sections: readonly AsanaSection[]): AsanaSection | null {
	const wanted = status?.trim().toLowerCase();
	if (!wanted) return null;
	for (const [gid, name] of Object.entries(sectionMap)) {
		if (name.toLowerCase() === wanted) {
			const section = sections.find((candidate) => candidate.gid === gid);
			if (section) return section;
		}
	}
	return sections.find((candidate) => candidate.name?.trim().toLowerCase() === wanted) ?? null;
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
export function taskFieldsOf(task: AsanaTask, projectGid: string, sectionMap: Record<string, string>, knownStatuses: ReadonlySet<string>) {
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

/** The newest `modified_at` among the tasks (the watermark the next incremental import starts from). */
export function watermarkOf(tasks: readonly Pick<AsanaTask, 'modified_at'>[], current: string | null | undefined): string | null {
	let latest = current ?? null;
	for (const task of tasks) {
		if (task.modified_at && (!latest || task.modified_at > latest)) latest = task.modified_at;
	}
	return latest;
}
