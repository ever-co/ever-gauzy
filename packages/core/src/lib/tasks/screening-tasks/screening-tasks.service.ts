import { EventBus } from '@nestjs/cqrs';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	ID,
	IScreeningTask,
	IScreeningTaskCreateInput,
	IScreeningTaskUpdateInput,
	ScreeningTaskStatusEnum,
	SubscriptionTypeEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { TenantAwareCrudService } from '../../core/crud';
import { TaskService } from '../task.service';
import { OrganizationProjectService } from '../../organization-project';
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
		private readonly organizationProjectService: OrganizationProjectService,
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
			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const { organizationId, mentionEmployeeIds = [] } = input;

			// Check if projectId is provided, if not use the provided project object from the input.
			// If neither is provided, set project to null.
			const project = input.task.projectId
				? await this.organizationProjectService.findOneByIdString(input.task.projectId)
				: input.task.project || null;

			// Check if the project exists and extract the project prefix
			const prefix = project?.name?.substring(0, 3) ?? null;

			// Log info if both projectId and project are not provided
			if (!project) {
				console.warn('No projectId or project provided. Proceeding without project information');
			}

			// Retrieve the maximum task number for the specified project, or handle null projectId if no project
			const maxNumber = await this.taskService.getMaxTaskNumberByProject({
				tenantId,
				organizationId,
				projectId: project?.id ?? null
			});

			// Create task
			const task = await this.taskService.create({
				...input.task,
				number: maxNumber + 1, // Increment the task number
				prefix,
				isScreeningTask: true,
				creatorId: userId,
				tenantId,
				organizationId
			});

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
			const mentionPromises = mentionEmployeeIds.map((mentionedUserId) =>
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
				organizationId,
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
					organizationId,
					tenantId
				),
				this.activityLogService.logActivity<ScreeningTask>(
					BaseEntityEnum.ScreeningTask,
					ActionTypeEnum.Created,
					ActorTypeEnum.User,
					screeningTask.id,
					`Screening task for #${task.taskNumber} ${task.title}`,
					screeningTask,
					organizationId,
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

	/**
	 * Updates an existing screening task and synchronizes related task data and activity logs.
	 *
	 * @param {ID} id - The unique identifier of the screening task to update.
	 * @param {IScreeningTaskUpdateInput} input - The data to update the screening task with.
	 * @returns {Promise<IScreeningTask>} A promise resolving to the updated screening task.
	 * @throws {HttpException} a BadRequest exception if the update process fails.
	 */
	async update(id: ID, input: IScreeningTaskUpdateInput): Promise<IScreeningTask> {
		try {
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			const screeningTask = await this.findOneByIdString(id, { relations: { task: true } });
			const task = screeningTask.task;

			const updatedScreeningTask = await super.create({ ...input, id });

			// Update the task accordingly to the screening status
			if (input.status !== updatedScreeningTask.status) {
				const isScreeningTask =
					[input.status, updatedScreeningTask.status].includes(ScreeningTaskStatusEnum.PENDING) ||
					[input.status, updatedScreeningTask.status].includes(ScreeningTaskStatusEnum.SNOOZED);

				const taskStatus = [ScreeningTaskStatusEnum.DECLINED, ScreeningTaskStatusEnum.DUPLICATED].includes(
					input.status
				)
					? TaskStatusEnum.CANCELLED
					: task.status;

				await this.taskService.update(task.id, { isScreeningTask, status: taskStatus });
			}

			// Generate the activity log
			this.activityLogService.logActivity<ScreeningTask>(
				BaseEntityEnum.ScreeningTask,
				ActionTypeEnum.Updated,
				ActorTypeEnum.User,
				updatedScreeningTask.id,
				`Screening task for #${task.number} ${task.title}`,
				updatedScreeningTask,
				updatedScreeningTask.organizationId,
				tenantId,
				updatedScreeningTask,
				input
			);

			// Return the updated screening task
			return updatedScreeningTask;
		} catch (error) {
			throw new HttpException(`Failed to update screening task with ID ${id}`, HttpStatus.BAD_REQUEST);
		}
	}
}
