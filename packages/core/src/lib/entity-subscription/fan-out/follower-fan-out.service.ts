import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { DataSource, In } from 'typeorm';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	ID,
	ITaskUpdateInput,
	NotificationActionTypeEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';
import { Employee, EntitySubscription, Task } from '../../core/entities/internal';
import { CommentEvent } from '../../comment/events';
import { EmployeeNotificationService } from '../../employee-notification/employee-notification.service';
import { EventBus } from '../../event-bus/event-bus';
import { TaskEvent } from '../../event-bus/events/task.event';
import { isNotificationFanOutEnabled } from './fan-out-enabled';

/** The members of a task update that count as "the task changed" for its followers. */
export const FOLLOWED_TASK_FIELDS: readonly string[] = ['status', 'taskStatusId', 'priority', 'taskPriorityId', 'dueDate', 'members'];

/**
 * Which of the followed fields an update stated.
 *
 * @param input The update's input, when the event carries one.
 * @returns The stated fields, in {@link FOLLOWED_TASK_FIELDS} order; empty when none is stated.
 */
export function followedTaskFieldsChanged(input: Partial<ITaskUpdateInput> | undefined | null): string[] {
	if (!input || typeof input !== 'object') {
		return [];
	}
	return FOLLOWED_TASK_FIELDS.filter((field) => (input as Record<string, unknown>)[field] !== undefined);
}

/** The display name of the signed-in user, for a notification title. */
export function actorDisplayName(user: { firstName?: string; lastName?: string; name?: string; email?: string } | null | undefined): string {
	if (!user) return 'Someone';
	const parts = [user.firstName, user.lastName].filter((part) => typeof part === 'string' && part.trim().length > 0);
	return parts.length ? parts.join(' ') : user.name || user.email || 'Someone';
}

/**
 * Tells the followers of a record that it changed.
 *
 * The platform already records who follows what (`EntitySubscription`: the creator and the assignees of a task,
 * the author of a comment, whoever was mentioned, anyone who subscribed by hand) but, until now, told nobody.
 * This service closes the loop for two facts: a comment on a followed record (`EmployeeNotificationTypeEnum.COMMENT`)
 * and a change of a followed task's status, priority, due date or members (`TASK_UPDATE`). Each follower gets one
 * notification through the same event the assignment and mention notifications travel, so the receiver's own
 * per-type switches apply; the actor is never told about their own change.
 *
 * Off unless `GAUZY_NOTIFICATION_FANOUT_ENABLED=true`.
 */
@Injectable()
export class FollowerFanOutService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(FollowerFanOutService.name);
	private taskEvents?: Subscription;
	private readonly enabled: boolean;

	constructor(
		private readonly dataSource: DataSource,
		private readonly notifications: EmployeeNotificationService,
		@Optional() private readonly eventBus?: EventBus
	) {
		this.enabled = isNotificationFanOutEnabled(process.env, (message) => this.logger.warn(message));
	}

	onModuleInit(): void {
		if (!this.enabled || !this.eventBus) {
			return;
		}
		this.taskEvents = this.eventBus.ofType(TaskEvent).subscribe((event) => void this.onTaskEvent(event));
	}

	onModuleDestroy(): void {
		this.taskEvents?.unsubscribe();
	}

	/**
	 * A comment was created on a record: its followers (not the author) are told. The notification names the record
	 * (`entity` / `entityId`, as before) and the comment (`commentId`), so a client opens the thread rather than the
	 * record's comment list; the Inbox files it as an entry about the comment.
	 */
	async onCommentCreated(event: CommentEvent): Promise<void> {
		if (!this.enabled || event.type !== 'created') {
			return;
		}
		const comment = event.comment;
		if (!comment?.entity || !comment.entityId || !comment.tenantId) {
			return;
		}
		await this.notifyFollowers({
			entity: String(comment.entity) as BaseEntityEnum,
			entityId: comment.entityId,
			tenantId: comment.tenantId,
			organizationId: comment.organizationId ?? undefined,
			type: EmployeeNotificationTypeEnum.COMMENT,
			action: NotificationActionTypeEnum.Commented,
			...(comment.id ? { commentId: comment.id } : {})
		});
	}

	/** A task was updated: when a followed field changed, its followers (not the actor) are told. */
	async onTaskEvent(event: TaskEvent): Promise<void> {
		if (!this.enabled || event.type !== 'updated') {
			return;
		}
		const task = event.entity;
		if (!task?.id || !task.tenantId || followedTaskFieldsChanged(event.input as Partial<ITaskUpdateInput>).length === 0) {
			return;
		}
		await this.notifyFollowers({
			entity: BaseEntityEnum.Task,
			entityId: task.id,
			tenantId: task.tenantId,
			organizationId: task.organizationId ?? undefined,
			type: EmployeeNotificationTypeEnum.TASK_UPDATE,
			action: NotificationActionTypeEnum.Updated,
			entityName: task.title
		});
	}

	/**
	 * Publishes one notification event per follower of the record, except the actor.
	 */
	async notifyFollowers(input: {
		entity: BaseEntityEnum;
		entityId: ID;
		tenantId: ID;
		organizationId?: ID;
		type: EmployeeNotificationTypeEnum;
		action: NotificationActionTypeEnum;
		entityName?: string | null;
		/** The comment the notification is about, when it is about one. */
		commentId?: ID;
	}): Promise<number> {
		try {
			const actorEmployeeId = RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId ?? null;
			const followers = await this.followersOf(input.entity, input.entityId, input.tenantId, input.organizationId ?? null);
			const receivers = followers.filter((employeeId) => !actorEmployeeId || String(employeeId) !== String(actorEmployeeId));
			if (!receivers.length) {
				return 0;
			}
			const entityName = input.entityName ?? (await this.entityName(input.entity, input.entityId, input.tenantId, input.organizationId ?? null));
			const actorName = actorDisplayName(RequestContext.currentUser());
			for (const receiverEmployeeId of receivers) {
				this.notifications.publishNotificationEvent(
					{
						entity: input.entity,
						entityId: input.entityId,
						type: input.type,
						receiverEmployeeId,
						...(actorEmployeeId ? { sentByEmployeeId: actorEmployeeId } : {}),
						organizationId: input.organizationId,
						tenantId: input.tenantId,
						...(input.commentId ? { commentId: input.commentId } : {})
					},
					input.action,
					entityName,
					actorName
				);
			}
			return receivers.length;
		} catch (error) {
			this.logger.warn(`Followers of ${input.entity} ${input.entityId} were not notified: ${(error as Error)?.message}`);
			return 0;
		}
	}

	/**
	 * The distinct employees following a record who may hear of it: the subscriptions of the record's own
	 * organization, held by active employees of that organization. A subscription filed from another organization
	 * (the subscription API checks no access to its target) names nobody here, so a record's title never reaches
	 * an employee who cannot read the record.
	 */
	private async followersOf(entity: BaseEntityEnum, entityId: ID, tenantId: ID, organizationId: ID | null): Promise<ID[]> {
		const rows = await this.dataSource.getRepository(EntitySubscription).find({
			select: { employeeId: true },
			where: { entity, entityId, tenantId, ...(organizationId ? { organizationId } : {}) }
		});
		const employeeIds = [...new Set(rows.map((row) => row.employeeId).filter(Boolean))] as ID[];
		if (!employeeIds.length) {
			return [];
		}
		const employees = await this.dataSource.getRepository(Employee).find({
			select: { id: true },
			where: {
				id: In(employeeIds),
				tenantId,
				...(organizationId ? { organizationId } : {}),
				isActive: true,
				isArchived: false
			}
		});
		return employees.map((employee) => employee.id as ID);
	}

	/** The name a notification title shows for the record (a task's title; otherwise the entity kind). */
	private async entityName(entity: BaseEntityEnum, entityId: ID, tenantId: ID, organizationId: ID | null): Promise<string> {
		if (entity === BaseEntityEnum.Task) {
			const task = await this.dataSource
				.getRepository(Task)
				.findOne({
					select: { id: true, title: true },
					where: { id: entityId, tenantId, ...(organizationId ? { organizationId } : {}) }
				})
				.catch(() => null);
			if (task?.title) return task.title;
		}
		return String(entity);
	}
}
