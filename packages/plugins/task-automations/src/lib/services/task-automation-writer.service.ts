import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { CommandBus, EventBus } from '@nestjs/cqrs';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	ID,
	IInboxItemWriter,
	INBOX_ITEM_WRITER,
	InboxItemBodyFormatEnum,
	InboxItemKindEnum,
	InboxItemPriorityEnum,
	ITaskUpdateInput
} from '@gauzy/contracts';
import { EmployeeCreateNotificationEvent, TaskUpdateCommand } from '@gauzy/core';
import { ITaskAutomationNotice, ITaskAutomationTaskUpdate } from '../engine/actions';
import { ITaskAutomationActorMarker } from '../engine/loop-guard';
import { ITaskAutomationTaskSnapshot } from '../engine/task-snapshot';
import { TASK_AUTOMATION_INBOX_EXTERNAL_SOURCE, TASK_AUTOMATION_INBOX_SOURCE } from '../task-automation.constants';
import { automationUser, runAsAutomation } from './task-automation-context';
import { TaskAutomationTaskReader } from './task-automation-task-reader.service';

/** The Inbox identity of one notice action of one run: rule, the action's place in the rule, the change (and task). */
export function noticeExternalId(ruleId: string, actionIndex: number, eventKey: string): string {
	return `${ruleId}:${actionIndex}:${eventKey}`.slice(0, 250);
}

/** What a plan does to a list: the ids it adds and the ids it removes, against the list it was planned on. */
export interface ITaskAutomationListEdit {
	add: ID[];
	remove: ID[];
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
	a.length === b.length && a.every((id) => b.includes(id));

/** The additions and removals that turn the list a plan was made on into the list it planned. */
export function listEdit(planned: readonly ID[], next: readonly ID[]): ITaskAutomationListEdit {
	return {
		add: [...new Set(next.filter((id) => !planned.includes(id)))],
		remove: [...new Set(planned.filter((id) => !next.includes(id)))]
	};
}

/**
 * A plan's additions and removals applied to a list as it is now: what was added or removed since the plan was made
 * stays so, and the list keeps its order, the additions last.
 */
export function applyListEdit(current: readonly ID[], edit: ITaskAutomationListEdit): ID[] {
	const kept = [...new Set(current)].filter((id) => !edit.remove.includes(id));
	return [...kept, ...edit.add.filter((id) => !kept.includes(id))];
}

/** The task was deleted after the run read it: nothing is written to it, and no notice is sent about it. */
export class TaskAutomationTaskGoneError extends Error {
	constructor() {
		super('The task no longer exists.');
		this.name = 'TaskAutomationTaskGoneError';
	}
}

/** What a write did. */
export interface ITaskAutomationWriteResult {
	/** Whether an update was sent: not when an edit made meanwhile already left the task as the rule wanted. */
	written: boolean;
	/** The task's assignees and labels as read just before the write, when the update changes a list. */
	lists: { memberIds: ID[]; tagIds: ID[] } | null;
	/** The lists the rule changes that were already as it wanted, so were not written. */
	unchanged: Array<'members' | 'tags'>;
}

/** How many people a notice reached, and through what. */
export interface ITaskAutomationNoticeResult {
	channel: 'inbox' | 'notification';
	recipients: number;
}

/**
 * Applies a rule's planned changes (spec FR-8, FR-16): through the platform's `TaskUpdateCommand` — so the
 * activity log, notifications, subscriptions, integrations and real-time hints follow as for a person's change —
 * inside a request context of the rule's system actor, whose marker attributes the activity to the rule and carries
 * the loop guard's depth to the change capture. Notices go to the Inbox when it is loaded, else to the platform's
 * notifications.
 */
@Injectable()
export class TaskAutomationWriter {
	private readonly logger = new Logger(TaskAutomationWriter.name);

	constructor(
		private readonly commandBus: CommandBus,
		private readonly eventBus: EventBus,
		private readonly reader: TaskAutomationTaskReader,
		@Optional() @Inject(INBOX_ITEM_WRITER) private readonly inbox?: IInboxItemWriter
	) {}

	/**
	 * Writes the update; throws what the task update threw.
	 *
	 * The plan's assignee and label lists were computed from `task`, read when the run began. The run's lock keeps
	 * other automations out, not a person's edit, and the task update replaces whole lists: written as planned, a list
	 * would put back an assignee removed since, or drop a label added since. So the lists are not written as planned:
	 * the rule's additions and removals are applied to the lists as stored just before the write, and a list they
	 * leave as it is is not written at all.
	 *
	 * What is left is the gap every task update has: `TaskService.update` reads the task and then saves the lists it
	 * is given, so an edit landing between this read and that save is still replaced, as it would be by a person's
	 * edit. A row lock cannot close it from here: the update runs in a transaction of its own, on another connection,
	 * which a lock held here would block.
	 */
	async applyUpdate(
		task: ITaskAutomationTaskSnapshot,
		update: ITaskAutomationTaskUpdate,
		marker: ITaskAutomationActorMarker
	): Promise<ITaskAutomationWriteResult> {
		const input: Record<string, unknown> = { organizationId: task.organizationId };
		let changes = false;
		if ('status' in update) {
			input['status'] = update.status;
			input['taskStatusId'] = update.taskStatusId ?? null;
			changes = true;
		}
		if ('priority' in update) {
			input['priority'] = update.priority;
			input['taskPriorityId'] = update.taskPriorityId ?? null;
			changes = true;
		}
		const result: ITaskAutomationWriteResult = { written: false, lists: null, unchanged: [] };
		const members = update.memberIds ? listEdit(task.memberIds, update.memberIds) : null;
		const tags = update.tagIds ? listEdit(task.tagIds, update.tagIds) : null;
		if (members || tags) {
			const current = await this.reader.lists(task.tenantId, task.id);
			if (!current) throw new TaskAutomationTaskGoneError();
			result.lists = current;
			const memberIds = members ? applyListEdit(current.memberIds, members) : null;
			if (memberIds && !sameSet(memberIds, current.memberIds)) {
				input['members'] = memberIds.map((id) => ({ id }));
				changes = true;
			} else if (memberIds) {
				result.unchanged.push('members');
			}
			const tagIds = tags ? applyListEdit(current.tagIds, tags) : null;
			if (tagIds && !sameSet(tagIds, current.tagIds)) {
				input['tags'] = tagIds.map((id) => ({ id }));
				changes = true;
			} else if (tagIds) {
				result.unchanged.push('tags');
			}
		}
		// What the rule was to change is already so (an edit since made it): nothing to write.
		if (!changes) return result;
		const user = automationUser({ tenantId: task.tenantId, organizationId: task.organizationId }, marker);
		await runAsAutomation(user, () => this.commandBus.execute(new TaskUpdateCommand(task.id, input as unknown as ITaskUpdateInput)));
		result.written = true;
		return result;
	}

	/** A task's assignees and labels as stored now, or `null` when the task is gone (see `applyUpdate`). */
	currentLists(task: ITaskAutomationTaskSnapshot): Promise<{ memberIds: ID[]; tagIds: ID[] } | null> {
		return this.reader.lists(task.tenantId, task.id);
	}

	/**
	 * Sends a notice to the task's assignees. In the Inbox it is a NOTICE whose identity is the rule, the action's place
	 * in it, the change and the task, so a redelivered change updates the notice instead of sending a second one, and a
	 * rule with two notice actions files two.
	 */
	async notify(
		task: ITaskAutomationTaskSnapshot,
		notice: ITaskAutomationNotice,
		marker: ITaskAutomationActorMarker,
		eventKey: string
	): Promise<ITaskAutomationNoticeResult> {
		const label = task.reference ? `${task.reference} ${task.title}` : task.title;
		const title = notice.message ?? `${label} — ${marker.ruleName}`;
		if (this.inbox) {
			const users = await this.reader.userIdsOfEmployees(task.tenantId, notice.employeeIds);
			const recipients = [...new Set(users.values())].map((userId) => ({ userId }));
			if (!recipients.length) return { channel: 'inbox', recipients: 0 };
			const result = await this.inbox.upsertExternal({
				tenantId: task.tenantId,
				organizationId: task.organizationId,
				kind: InboxItemKindEnum.NOTICE,
				source: TASK_AUTOMATION_INBOX_SOURCE,
				title: title.slice(0, 250),
				body: notice.message ? `${label}\n\n${marker.ruleName}` : `By automation "${marker.ruleName}".`,
				bodyFormat: InboxItemBodyFormatEnum.PLAIN,
				priority: InboxItemPriorityEnum.NORMAL,
				entity: BaseEntityEnum.Task,
				entityId: task.id,
				taskId: task.id,
				projectId: task.projectId,
				externalSource: TASK_AUTOMATION_INBOX_EXTERNAL_SOURCE,
				externalId: noticeExternalId(marker.ruleId, notice.actionIndex, eventKey),
				metadata: { ruleId: marker.ruleId, runId: marker.runId },
				recipients
			});
			return { channel: 'inbox', recipients: result.recipientUserIds.length };
		}
		for (const employeeId of notice.employeeIds) {
			this.eventBus.publish(
				new EmployeeCreateNotificationEvent({
					entity: BaseEntityEnum.Task,
					entityId: task.id,
					type: EmployeeNotificationTypeEnum.TASK_UPDATE,
					title: title.slice(0, 250),
					message: `By automation "${marker.ruleName}".`,
					organizationId: task.organizationId,
					tenantId: task.tenantId,
					receiverEmployeeId: employeeId
				} as never)
			);
		}
		return { channel: 'notification', recipients: notice.employeeIds.length };
	}

	/** Whether the Inbox is loaded (the dry run tells where a notice would go). */
	get inboxLoaded(): boolean {
		return !!this.inbox;
	}

	/** For the logs: the reason a write failed, without a stack. */
	describe(error: unknown): string {
		const message = error instanceof Error ? error.message : String(error);
		this.logger.debug(`An automation write failed: ${message}`);
		return message;
	}
}
