import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, In, IsNull, ObjectLiteral } from 'typeorm';
import { CHAT_EVENT_NAMES, ID, IChatEvent, IChatTaskUpdateInput, IChatTaskUpdateResult, ITask, ITaskUpdateInput, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext, TaskUpdateCommand } from '@gauzy/core';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatTaskReference } from '../entities/chat-task-reference.entity';
import { ChatRealtime } from '../realtime/chat-realtime';
import { inWriteTransaction } from '../realtime/chat-write-transaction';
import { ChatAccessService, IChatCaller } from './chat-access.service';

/** The most messages one change from a card tells their conversations about (the newest that show the task). */
export const CHAT_TASK_CARD_FANOUT = 100;

/** A status or priority record, as a card change reads it. */
interface IChatTaskRecord {
	id: ID;
	name?: string | null;
	value?: string | null;
}

/** Where a task's status and priority records may come from. */
interface ChatTaskRecordScope {
	tenantId: ID;
	organizationId: ID | null;
	projectId: ID | null;
}

/** The records a task may take: its organization's, the tenant's shared ones (no organization), the platform's defaults. */
function scopeOf(scope: ChatTaskRecordScope): Array<Record<string, unknown>> {
	return [
		...(scope.organizationId ? [{ tenantId: scope.tenantId, organizationId: scope.organizationId }] : []),
		{ tenantId: scope.tenantId, organizationId: IsNull() },
		{ tenantId: IsNull(), organizationId: IsNull() }
	];
}

/** The name a task holds for a record, as the task page writes it (`value || name`). */
function recordName(record: IChatTaskRecord): string | null {
	return (record.value ?? '').trim() || (record.name ?? '').trim() || null;
}

/**
 * The task update a card's change makes: only what the input names, as the task page writes it (`status` with its
 * `taskStatusId`, `priority` with its `taskPriorityId`, `members` for the assignees). Throws when it names nothing.
 */
export function taskPatchOf(input: IChatTaskUpdateInput, assignees: Array<{ id: ID }> | null): Partial<ITaskUpdateInput> {
	const patch: Record<string, unknown> = {};
	if (typeof input.status === 'string') {
		const status = input.status.trim();
		if (!status) throw new BadRequestException('A status needs a name.');
		patch['status'] = status;
	}
	if (input.taskStatusId !== undefined) patch['taskStatusId'] = input.taskStatusId ?? null;
	if (input.priority !== undefined) {
		const priority = typeof input.priority === 'string' && input.priority.trim() ? input.priority.trim() : null;
		patch['priority'] = priority;
		// A cleared priority takes its record with it, unless the change names the record itself.
		if (priority === null && input.taskPriorityId === undefined) patch['taskPriorityId'] = null;
	}
	if (input.taskPriorityId !== undefined) patch['taskPriorityId'] = input.taskPriorityId ?? null;
	if (assignees) patch['members'] = assignees;
	if (!Object.keys(patch).length) throw new BadRequestException('Name what to change: the status, the priority or the assignees.');
	return patch as Partial<ITaskUpdateInput>;
}

/**
 * Changing a task from its card in a message (the Chat spec, FR-14): status, priority and assignees.
 *
 * The change is the task page's: the platform's task update command (`TaskUpdateCommand`, which `PUT /tasks/:id` and
 * `PUT /tasks/:id/status` run), so the same service writes it, the same activity log entry records it, the same
 * subscriptions follow the assignees and the same `task.updated` hint reaches everyone who may read the task. The same
 * permission is asked (`ORG_TASK_EDIT` or `ALL_ORG_EDIT`), and the card's own rules on top: the caller is a member of
 * the message's conversation (a channel manager who has not joined it is not), the conversation is not archived, the
 * caller may view tasks, and the message refers to that task — a task of the conversation's organization. A status or
 * priority record named must be the task organization's or a shared one (no organization; the platform's defaults
 * have no tenant either); an assignee, an active employee of the task's organization.
 *
 * Every conversation that shows the task in a message hears `chat_message.updated` for those messages (the newest
 * {@link CHAT_TASK_CARD_FANOUT}), so an open card reads the task again; a client that listens to `task.updated` hears it
 * too. The answer carries only the events of conversations the caller is a member of.
 */
@Injectable()
export class ChatTaskCardService {
	private readonly logger = new Logger('ChatTaskCardService');

	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChatAccessService,
		private readonly realtime: ChatRealtime,
		private readonly commandBus: CommandBus
	) {}

	async update(caller: IChatCaller, messageId: ID, taskId: ID, input: IChatTaskUpdateInput): Promise<IChatTaskUpdateResult> {
		if (!RequestContext.hasPermission(PermissionsEnum.ORG_TASK_EDIT) && !RequestContext.hasPermission(PermissionsEnum.ALL_ORG_EDIT)) {
			throw new ForbiddenException(`Changing a task needs ${PermissionsEnum.ORG_TASK_EDIT}.`);
		}
		if (!RequestContext.hasPermission(PermissionsEnum.ORG_TASK_VIEW) && !RequestContext.hasPermission(PermissionsEnum.ALL_ORG_VIEW)) {
			throw new ForbiddenException(`Changing a task needs ${PermissionsEnum.ORG_TASK_VIEW}.`);
		}
		// Nothing to change is refused before anything is read.
		taskPatchOf(input, input.assigneeEmployeeIds ? [] : null);

		const message = await this.dataSource.getRepository(ChatMessage).findOne({ where: { id: messageId, tenantId: caller.tenantId }, withDeleted: true });
		if (!message) throw new NotFoundException('The requested record was not found');
		const { conversation, member } = await this.access.requireMember(message.conversationId, caller);
		// A channel manager reads a channel without joining it; changing its cards is for its members, as sending is.
		if (!member) throw new NotFoundException('The requested record was not found');
		if (conversation.archivedAt) throw new BadRequestException('This conversation is archived.');
		if (message.deletedAt) throw new BadRequestException('A deleted message has no task card.');

		const reference = await this.dataSource.getRepository(ChatTaskReference).findOne({ where: { messageId, taskId, tenantId: caller.tenantId } });
		if (!reference) throw new NotFoundException('The message shows no such task.');
		const organizationId = (conversation.organizationId ?? caller.organizationId ?? null) as ID | null;
		const task = (await this.dataSource.getRepository<ObjectLiteral>('Task').findOne({
			select: { id: true, organizationId: true, projectId: true },
			where: { id: taskId, tenantId: caller.tenantId, ...(organizationId ? { organizationId } : {}) }
		} as never)) as { id: ID; organizationId?: ID | null; projectId?: ID | null } | null;
		if (!task) throw new NotFoundException('The task was not found');

		const scope: ChatTaskRecordScope = { tenantId: caller.tenantId, organizationId: (task.organizationId ?? organizationId) as ID | null, projectId: task.projectId ?? null };
		const statusRecord = await this.requireRecord('TaskStatus', input.taskStatusId, scope, 'The status was not found');
		const priorityRecord = await this.requireRecord('TaskPriority', input.taskPriorityId, scope, 'The priority was not found');
		const assignees = input.assigneeEmployeeIds ? await this.assignees(caller.tenantId, scope.organizationId, input.assigneeEmployeeIds) : null;
		const patch = taskPatchOf(input, assignees) as Record<string, unknown>;
		// The task page writes a status with its record, and a priority with its record: a card does too.
		await this.pair(patch, 'status', 'taskStatusId', 'TaskStatus', statusRecord, scope);
		await this.pair(patch, 'priority', 'taskPriorityId', 'TaskPriority', priorityRecord, scope);

		const updated: ITask = await this.commandBus.execute(new TaskUpdateCommand(taskId, patch as unknown as ITaskUpdateInput));
		return { task: updated, events: await this.tellCards(caller, taskId) };
	}

	/**
	 * Keeps a name and its record together, as the task page writes them (`status: value || name` with `taskStatusId`):
	 * a record named gives its name; a name given alone takes the matching record of the task's scope (its project's
	 * first, then its organization's, the tenant's shared ones, the platform's defaults), or none — so a card never
	 * leaves the task showing the record it had before. A record cleared (null) leaves the name as given.
	 */
	private async pair(
		patch: Record<string, unknown>,
		nameField: 'status' | 'priority',
		idField: 'taskStatusId' | 'taskPriorityId',
		entity: 'TaskStatus' | 'TaskPriority',
		record: IChatTaskRecord | null,
		scope: ChatTaskRecordScope
	): Promise<void> {
		if (record) {
			patch[nameField] = recordName(record);
			return;
		}
		const name = patch[nameField];
		if (typeof name !== 'string' || !name || patch[idField] !== undefined) return;
		const found = await this.recordNamed(entity, name, scope);
		patch[idField] = found?.id ?? null;
		if (found) patch[nameField] = recordName(found) ?? name;
	}

	/** The record of the task's scope whose value or name is this one (any case): the most specific scope first. */
	private async recordNamed(entity: 'TaskStatus' | 'TaskPriority', name: string, scope: ChatTaskRecordScope): Promise<IChatTaskRecord | null> {
		const records = (await this.dataSource.getRepository<ObjectLiteral>(entity).find({
			select: { id: true, name: true, value: true, tenantId: true, organizationId: true, projectId: true, organizationTeamId: true },
			where: scopeOf(scope)
		} as never)) as Array<IChatTaskRecord & { tenantId?: ID | null; organizationId?: ID | null; projectId?: ID | null; organizationTeamId?: ID | null }>;
		const wanted = name.trim().toLowerCase();
		const ofProject = (record: { projectId?: ID | null }) => !!scope.projectId && String(record.projectId ?? '') === String(scope.projectId);
		const matching = records.filter(
			(record) =>
				// Another project's record is not the task's to take, nor is a team's own (a name alone cannot say whose).
				(!record.projectId || ofProject(record)) &&
				!record.organizationTeamId &&
				[record.value, record.name].some((text) => typeof text === 'string' && text.trim().toLowerCase() === wanted)
		);
		// The project's own, then the organization's, then the tenant's shared ones, then the platform's defaults.
		const rank = (record: { tenantId?: ID | null; organizationId?: ID | null; projectId?: ID | null }) =>
			ofProject(record) ? 0 : record.organizationId ? 1 : record.tenantId ? 2 : 3;
		return matching.sort((a, b) => rank(a) - rank(b))[0] ?? null;
	}

	/**
	 * A record a change names (a status, a priority) must be one the task may take: the task organization's, the
	 * tenant's shared one (no organization), or a platform default (no tenant, no organization), and not another
	 * project's. Another organization's or project's record reads as not found. A team's record is the client's choice
	 * (it lists its team's statuses). Null clears it and needs no check.
	 *
	 * @returns The record (its name and value), or null when none is named.
	 */
	private async requireRecord(entity: 'TaskStatus' | 'TaskPriority', id: ID | null | undefined, scope: ChatTaskRecordScope, missing: string): Promise<IChatTaskRecord | null> {
		if (!id) return null;
		const where = scopeOf(scope).map((clause) => ({ id, ...clause }));
		const found = (await this.dataSource.getRepository<ObjectLiteral>(entity).findOne({ select: { id: true, name: true, value: true, projectId: true }, where } as never)) as
			| (IChatTaskRecord & { projectId?: ID | null })
			| null;
		if (!found || (found.projectId && String(found.projectId) !== String(scope.projectId ?? ''))) throw new NotFoundException(missing);
		return { id: found.id, name: found.name, value: found.value };
	}

	/**
	 * The assignees named, each an active, unarchived employee of the organization (the platform's working-employee
	 * rule; End Work clears it). An unknown or inactive one is refused, not dropped.
	 */
	private async assignees(tenantId: ID, organizationId: ID | null, employeeIds: readonly ID[]): Promise<Array<{ id: ID }>> {
		const ids = [...new Set(employeeIds.map(String))];
		if (!ids.length) return [];
		const rows = await this.dataSource.getRepository<ObjectLiteral>('Employee').find({
			select: { id: true },
			where: { id: In(ids), tenantId, isActive: true, isArchived: false, ...(organizationId ? { organizationId } : {}) }
		} as never);
		if (rows.length !== ids.length) throw new NotFoundException('An assignee is not an active employee of the organization');
		return ids.map((id) => ({ id: id as ID }));
	}

	/**
	 * Tells every conversation that shows the task in a message — its members, through `chat_message.updated` — that
	 * those messages changed, so their cards read the task again. After the task's own commit and best effort: the task
	 * changed whether or not this is told.
	 *
	 * @returns The events of the conversations the caller is a member of (the others are told, never shown to the caller:
	 * their ids are not the caller's to learn).
	 */
	private async tellCards(caller: IChatCaller, taskId: ID): Promise<IChatEvent[]> {
		const tenantId = caller.tenantId;
		try {
			const references = await this.dataSource
				.getRepository(ChatTaskReference)
				.find({ select: { messageId: true }, where: { taskId, tenantId }, order: { createdAt: 'DESC' }, take: CHAT_TASK_CARD_FANOUT });
			if (!references.length) return [];
			const messages = await this.dataSource.getRepository(ChatMessage).find({
				where: { id: In([...new Set(references.map((reference) => String(reference.messageId)))]), tenantId, deletedAt: IsNull() }
			});
			const members = new Map<string, ID[]>();
			for (const conversationId of new Set(messages.map((message) => String(message.conversationId)))) {
				members.set(conversationId, (await this.access.members(tenantId, conversationId as ID)).map((member) => member.userId));
			}
			return await inWriteTransaction(this.dataSource, async (manager) => {
				const facts: IChatEvent[] = [];
				for (const message of messages) {
					const recipients = members.get(String(message.conversationId)) ?? [];
					if (!recipients.length) continue;
					const fact = await this.realtime.append(manager, this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_UPDATED, message, recipients));
					if (recipients.some((userId) => String(userId) === String(caller.userId))) facts.push(fact);
				}
				return facts;
			});
		} catch (error) {
			this.logger.warn(`The task cards of ${taskId} were not told of its change: ${(error as Error)?.message}`);
			return [];
		}
	}
}
