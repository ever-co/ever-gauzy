import { ChatTaskReferenceKindEnum, CHAT_MESSAGE_MAX_LENGTH, IChatConversationWithState, IChatMessageWithRelations, IChatTaskReference, ITask } from '@gauzy/contracts';
import { ChatPerson, plainBody } from './chat-ui.helpers';

/** What a task card shows of a task the reader may see. */
export interface ChatTaskSummary {
	id: string;
	/** `KEY-12` (the project's prefix and the task's number), `#12` without a prefix, or null. */
	key: string | null;
	title: string;
	/** The status's name (the board column), or the task's own status. */
	status: string | null;
	/** The status record, when the status is one (what a change from the card writes with the name). */
	statusId?: string | null;
	/** The priority's name, or null. */
	priority?: string | null;
	/** The assignees (employee ids). */
	assigneeIds?: string[];
	/** The task's project and organization (where its statuses come from). */
	projectId?: string | null;
	organizationId?: string | null;
}

/** The priorities a card offers when the task has no priority records of its own: the platform's four. */
export const CHAT_TASK_PRIORITIES: readonly string[] = ['urgent', 'high', 'medium', 'low'];

/** A status a card offers: its name (what the task's `status` holds) and its record, when it is one. */
export interface ChatTaskStatusChoice {
	name: string;
	id: string | null;
}

/**
 * The statuses a card offers, from the platform's status records of the task's project (or organization): by their
 * order, each name once; the task's own status first when the records do not hold it, so the card never hides it.
 */
export function statusChoicesOf(
	records: ReadonlyArray<{ id?: string | null; name?: string | null; value?: string | null; order?: number | null }>,
	current: string | null
): ChatTaskStatusChoice[] {
	const seen = new Set<string>();
	const choices: ChatTaskStatusChoice[] = [];
	for (const record of [...records].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
		const name = (record.name ?? record.value ?? '').trim();
		if (!name || seen.has(name.toLowerCase())) continue;
		seen.add(name.toLowerCase());
		choices.push({ name, id: record.id ? String(record.id) : null });
	}
	if (current && !seen.has(current.toLowerCase())) choices.unshift({ name: current, id: null });
	return choices;
}

/** The assignees after a person is added or taken off (a card toggles one person at a time). */
export function toggledAssignees(current: readonly string[] | undefined, employeeId: string): string[] {
	const list = [...new Set((current ?? []).map(String))];
	return list.includes(String(employeeId)) ? list.filter((id) => id !== String(employeeId)) : [...list, String(employeeId)];
}

/** The longest title a task made from a message gets (the first line, shortened). */
export const CHAT_TASK_TITLE_MAX = 120;

/** A task as its card shows it. */
export function taskSummaryOf(
	task: Pick<ITask, 'id' | 'title' | 'number' | 'prefix' | 'status' | 'taskStatus'> &
		Partial<Pick<ITask, 'taskStatusId' | 'priority' | 'members' | 'projectId' | 'organizationId'>>
): ChatTaskSummary {
	const number = typeof task.number === 'number' && Number.isFinite(task.number) ? task.number : null;
	const prefix = (task.prefix ?? '').trim();
	return {
		id: String(task.id),
		key: number === null ? null : prefix ? `${prefix.toUpperCase()}-${number}` : `#${number}`,
		title: (task.title ?? '').trim(),
		status: task.taskStatus?.name?.trim() || (task.status ? String(task.status) : null),
		statusId: task.taskStatusId ? String(task.taskStatusId) : (task.taskStatus?.id ? String(task.taskStatus.id) : null),
		priority: task.priority ? String(task.priority) : null,
		assigneeIds: (task.members ?? []).map((member) => String(member?.id)).filter((id) => !!id && id !== 'undefined'),
		projectId: task.projectId ? String(task.projectId) : null,
		organizationId: task.organizationId ? String(task.organizationId) : null
	};
}

/**
 * The title a task made from a message starts with: the message's first line of text (mentions as names, the
 * Markdown marks of the line taken off), shortened; empty when the message holds no text.
 */
export function taskTitleFromBody(
	body: string,
	people: ReadonlyMap<string, ChatPerson>,
	conversations: ReadonlyMap<string, string>,
	max = CHAT_TASK_TITLE_MAX
): string {
	// Line by line (a mention token never spans two): the preview joins lines, so the first is found before it runs.
	const line =
		(body ?? '')
			.replace(/```[\s\S]*?```/g, ' ')
			.split('\n')
			.map((part) =>
				plainBody(part.replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, ''), people, conversations)
					.replace(/(\*\*|__|~~|`)/g, '')
					.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
					.trim()
			)
			.find((part) => part.length > 0) ?? '';
	return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/**
 * The text of a "send to chat" message: the note written beside the task, or else the task's key and title (the
 * platform needs a body; the card itself comes from the task reference).
 */
export function sendToChatBody(note: string, task: ChatTaskSummary | null): string {
	const written = (note ?? '').trim();
	if (written) return written.slice(0, CHAT_MESSAGE_MAX_LENGTH);
	const label = [task?.key, task?.title].filter((part) => !!part).join(' ');
	return (label || 'Task').slice(0, CHAT_MESSAGE_MAX_LENGTH);
}

/**
 * The conversations a task can be sent to: those I am a member of and that are not archived, matching a query on
 * their title, the favourites first, then the most recent.
 */
export function conversationChoices(
	conversations: readonly IChatConversationWithState[],
	query: string,
	titleOf: (conversation: IChatConversationWithState) => string
): IChatConversationWithState[] {
	const needle = (query ?? '').trim().toLowerCase();
	return conversations
		.filter((conversation) => !!conversation.state && !conversation.archivedAt)
		.filter((conversation) => !needle || titleOf(conversation).toLowerCase().includes(needle))
		.sort((a, b) => {
			const favorite = Number(!!b.state?.isFavorite) - Number(!!a.state?.isFavorite);
			if (favorite) return favorite;
			const last = (value?: Date | string | null) => (value ? new Date(value).getTime() : 0);
			return last(b.lastMessageAt) - last(a.lastMessageAt) || titleOf(a).localeCompare(titleOf(b));
		});
}

/** The message with a task reference added (a task created from it), each task once. */
export function withTaskReference(message: IChatMessageWithRelations, reference: IChatTaskReference): IChatMessageWithRelations {
	const references = message.taskReferences ?? [];
	if (references.some((item) => String(item.taskId) === String(reference.taskId))) return message;
	return { ...message, taskReferences: [...references, { ...reference, kind: reference.kind ?? ChatTaskReferenceKindEnum.CREATED }] };
}
