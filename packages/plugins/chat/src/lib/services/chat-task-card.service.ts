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
	if (input.priority !== undefined) patch['priority'] = typeof input.priority === 'string' && input.priority.trim() ? input.priority.trim() : null;
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
 * the message's conversation (not archived), may view tasks, and the message refers to that task — a task of the
 * conversation's organization. A status or priority record named must be the tenant's; an assignee, an employee of the
 * task's organization.
 *
 * Every conversation that shows the task in a message hears `chat_message.updated` for those messages (the newest
 * {@link CHAT_TASK_CARD_FANOUT}), so an open card reads the task again; a client that listens to `task.updated` hears it
 * too.
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
		const { conversation } = await this.access.requireMember(message.conversationId, caller);
		if (conversation.archivedAt) throw new BadRequestException('This conversation is archived.');
		if (message.deletedAt) throw new BadRequestException('A deleted message has no task card.');

		const reference = await this.dataSource.getRepository(ChatTaskReference).findOne({ where: { messageId, taskId, tenantId: caller.tenantId } });
		if (!reference) throw new NotFoundException('The message shows no such task.');
		const organizationId = (conversation.organizationId ?? caller.organizationId ?? null) as ID | null;
		const task = (await this.dataSource.getRepository<ObjectLiteral>('Task').findOne({
			select: { id: true, organizationId: true },
			where: { id: taskId, tenantId: caller.tenantId, ...(organizationId ? { organizationId } : {}) }
		} as never)) as { id: ID; organizationId?: ID | null } | null;
		if (!task) throw new NotFoundException('The task was not found');

		await this.requireRecord('TaskStatus', input.taskStatusId, caller.tenantId, 'The status was not found');
		await this.requireRecord('TaskPriority', input.taskPriorityId, caller.tenantId, 'The priority was not found');
		const assignees = input.assigneeEmployeeIds ? await this.assignees(caller.tenantId, (task.organizationId ?? organizationId) as ID | null, input.assigneeEmployeeIds) : null;
		const patch = taskPatchOf(input, assignees);

		const updated: ITask = await this.commandBus.execute(new TaskUpdateCommand(taskId, patch as ITaskUpdateInput));
		return { task: updated, events: await this.tellCards(caller.tenantId, taskId) };
	}

	/** A record a change names (a status, a priority) must be the tenant's; null clears it and needs no check. */
	private async requireRecord(entity: string, id: ID | null | undefined, tenantId: ID, missing: string): Promise<void> {
		if (!id) return;
		const found = await this.dataSource.getRepository<ObjectLiteral>(entity).findOne({ select: { id: true }, where: { id, tenantId } } as never);
		if (!found) throw new NotFoundException(missing);
	}

	/** The assignees named, each an active employee of the organization (an unknown one is refused, not dropped). */
	private async assignees(tenantId: ID, organizationId: ID | null, employeeIds: readonly ID[]): Promise<Array<{ id: ID }>> {
		const ids = [...new Set(employeeIds.map(String))];
		if (!ids.length) return [];
		const rows = await this.dataSource
			.getRepository<ObjectLiteral>('Employee')
			.find({ select: { id: true }, where: { id: In(ids), tenantId, ...(organizationId ? { organizationId } : {}) } } as never);
		if (rows.length !== ids.length) throw new NotFoundException('An assignee is not an employee of the organization');
		return ids.map((id) => ({ id: id as ID }));
	}

	/**
	 * Tells every conversation that shows the task in a message — its members, through `chat_message.updated` — that
	 * those messages changed, so their cards read the task again. After the task's own commit and best effort: the task
	 * changed whether or not this is told.
	 */
	private async tellCards(tenantId: ID, taskId: ID): Promise<IChatEvent[]> {
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
					facts.push(await this.realtime.append(manager, this.realtime.messageFact(CHAT_EVENT_NAMES.MESSAGE_UPDATED, message, recipients)));
				}
				return facts;
			});
		} catch (error) {
			this.logger.warn(`The task cards of ${taskId} were not told of its change: ${(error as Error)?.message}`);
			return [];
		}
	}
}
