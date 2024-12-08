import { EventBus } from '@nestjs/cqrs';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	IScreeningTask,
	IScreeningTaskCreateInput,
	ScreeningTaskStatusEnum,
	SubscriptionTypeEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { TenantAwareCrudService } from '../../core/crud';
import { TaskService } from '../task.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { MentionService } from '../../mention/mention.service';
import { CreateSubscriptionEvent } from '../../subscription/events';
import { Task } from '../task.entity';
import { ScreeningTask } from './screening-task.entity';
import { TypeOrmScreeningTaskRepository } from './repository/type-orm-screening-task.repository';
import { MikroOrmScreeningTaskRepository } from './repository/mikro-orm-screening-task.repository';

@Injectable()
export class ScreeningTasksService extends TenantAwareCrudService<ScreeningTask> {
	constructor(
		private readonly eventBus: EventBus,
		readonly typeOrmScreeningTaskRepository: TypeOrmScreeningTaskRepository,
		readonly mikroOrmScreeningTaskRepository: MikroOrmScreeningTaskRepository,
		private readonly taskService: TaskService,
		private readonly mentionService: MentionService,
		private readonly activityLogService: ActivityLogService
	) {
		super(typeOrmScreeningTaskRepository, mikroOrmScreeningTaskRepository);
	}

	/**
	 * Creates a new screening task along with its associated task, subscriptions, mentions, and activity logs.
	 *
	 * @param {IScreeningTaskCreateInput} input - The input data required to create the screening task.
	 * @returns {Promise<IScreeningTask>} A promise that resolves to the created screening task.
	 * @throws {HttpException} an exception if the creation process fails.
	 */
	async create(input: IScreeningTaskCreateInput): Promise<IScreeningTask> {
		try {
			const userId = RequestContext.currentUserId();
			const tenantId = RequestContext.currentTenantId();
			const { mentionUserIds = [] } = input;

			// Create task
			const task = await this.taskService.create({ ...input.task, isScreeningTask: true, creatorId: userId });

			// Create the screening task
			const screeningTask = await super.create({
				...input,
				taskId: task.id,
				task,
				status: ScreeningTaskStatusEnum.PENDING,
				creatorId: userId,
				tenantId
			});

			// Apply mentions if needed
			const mentionPromises = mentionUserIds.map((mentionedUserId) =>
				this.mentionService.publishMention({
					entity: BaseEntityEnum.Task,
					entityId: task.id,
					mentionedUserId,
					mentionById: userId
				})
			);

			// Subscribe creator to the task
			const subscriptionEvent = new CreateSubscriptionEvent({
				entity: BaseEntityEnum.Task,
				entityId: task.id,
				userId: userId,
				type: SubscriptionTypeEnum.CREATED_ENTITY,
				organizationId: task.organizationId,
				tenantId
			});
			this.eventBus.publish(subscriptionEvent);

			// Generate the activity logs
			const activityLogPromises = [
				this.activityLogService.logActivity<Task>(
					BaseEntityEnum.Task,
					ActionTypeEnum.Created,
					ActorTypeEnum.User,
					task.id,
					task.title,
					task,
					task.organizationId,
					tenantId
				),
				this.activityLogService.logActivity<ScreeningTask>(
					BaseEntityEnum.ScreeningTask,
					ActionTypeEnum.Created,
					ActorTypeEnum.User,
					screeningTask.id,
					`Screening task for #${task.taskNumber} ${task.title}`,
					screeningTask,
					task.organizationId,
					tenantId
				)
			];

			await Promise.all([...mentionPromises, ...activityLogPromises]);

			// Return the created screening task
			return screeningTask;
		} catch (error) {
			throw new HttpException('Screening task creation failed', HttpStatus.BAD_REQUEST);
		}
	}
}
