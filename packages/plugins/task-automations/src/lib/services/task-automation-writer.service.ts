import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { CommandBus, EventBus } from '@nestjs/cqrs';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
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

	/** Writes the update; throws what the task update threw. */
	async applyUpdate(task: ITaskAutomationTaskSnapshot, update: ITaskAutomationTaskUpdate, marker: ITaskAutomationActorMarker): Promise<void> {
		const input: Record<string, unknown> = { organizationId: task.organizationId };
		if ('status' in update) {
			input['status'] = update.status;
			input['taskStatusId'] = update.taskStatusId ?? null;
		}
		if ('priority' in update) {
			input['priority'] = update.priority;
			input['taskPriorityId'] = update.taskPriorityId ?? null;
		}
		if (update.memberIds) input['members'] = update.memberIds.map((id) => ({ id }));
		if (update.tagIds) input['tags'] = update.tagIds.map((id) => ({ id }));
		const user = automationUser({ tenantId: task.tenantId, organizationId: task.organizationId }, marker);
		await runAsAutomation(user, () => this.commandBus.execute(new TaskUpdateCommand(task.id, input as unknown as ITaskUpdateInput)));
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
