import { ICommandHandler, CommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations } from 'typeorm';
import * as chalk from 'chalk';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	ID,
	IIntegrationMap,
	ITask,
	ITaskCreateInput,
	ITaskUpdateInput,
	SubscriptionTypeEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { IntegrationMap, TaskStatus } from '../../../core/entities/internal';
import { CreateSubscriptionEvent } from '../../../subscription/events';
import { AutomationTaskSyncCommand } from './../automation-task.sync.command';
import { EmployeeService } from '../../../employee/employee.service';
import { SubscriptionService } from '../../../subscription/subscription.service';
import { TaskService } from './../../task.service';
import { ActivityLogService } from '../../../activity-log/activity-log.service';
import { Task } from './../../task.entity';
import { TypeOrmIntegrationMapRepository } from '../../../integration-map/repository/type-orm-integration-map.repository';
import { TypeOrmTaskStatusRepository } from '../../statuses/repository/type-orm-task-status.repository';
import { TypeOrmTaskRepository } from '../../repository/type-orm-task.repository';

@CommandHandler(AutomationTaskSyncCommand)
export class AutomationTaskSyncHandler implements ICommandHandler<AutomationTaskSyncCommand> {
	constructor(
		private readonly _eventBus: EventBus,

		@InjectRepository(Task)
		private readonly typeOrmTaskRepository: TypeOrmTaskRepository,

		@InjectRepository(TaskStatus)
		private readonly typeOrmTaskStatusRepository: TypeOrmTaskStatusRepository,

		@InjectRepository(IntegrationMap)
		private readonly typeOrmIntegrationMapRepository: TypeOrmIntegrationMapRepository,

		private readonly _taskService: TaskService,
		private readonly activityLogService: ActivityLogService,
		private readonly _employeeService: EmployeeService,
		private readonly _subscriptionService: SubscriptionService
	) {}

	/**
	 * Executes the synchronization of automation tasks with the integration map.
	 *
	 * @param {AutomationTaskSyncCommand} command - The command containing the input data.
	 * @returns {Promise<IIntegrationMap>} - The integration map after synchronization.
	 */
	async execute(command: AutomationTaskSyncCommand): Promise<IIntegrationMap> {
		try {
			const { input } = command;
			const { sourceId, integrationId, organizationId, entity } = input;
			const { projectId } = entity;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			try {
				const taskStatus = await this.typeOrmTaskStatusRepository.findOneBy({
					tenantId,
					organizationId,
					projectId,
					name: entity.status
				});
				entity.taskStatus = taskStatus;
			} catch (error) {
				console.log(chalk.red(`Syncing GitHub Automation Task Status: %s`), entity.status);
			}

			try {
				// Check if an integration map already exists for the issue
				const integrationMap = await this.typeOrmIntegrationMapRepository.findOneByOrFail({
					entity: command.entity,
					sourceId,
					integrationId,
					organizationId,
					tenantId
				});

				// Try to find the corresponding task
				try {
					await this._taskService.findOneByIdString(integrationMap.gauzyId);

					// Update the corresponding task with the new input data
					await this.updateTask(integrationMap.gauzyId, {
						...entity,
						projectId,
						organizationId,
						tenantId
					});
				} catch (error) {
					// Create a new task with the provided entity data
					await this.createTask(
						{ projectId, organizationId, tenantId },
						{
							...entity,
							id: integrationMap.gauzyId
						}
					);
				}

				// Return the integration map
				return integrationMap;
			} catch (error) {
				// Create a new task with the provided entity data
				const task = await this.createTask({ projectId, organizationId, tenantId }, entity);

				// Create a new integration map for the issue
				return await this.typeOrmIntegrationMapRepository.save(
					this.typeOrmIntegrationMapRepository.create({
						gauzyId: task.id,
						entity: command.entity,
						integrationId,
						sourceId,
						organizationId,
						tenantId
					})
				);
			}
		} catch (error) {
			console.log('Failed to sync in issues and labels', error.message);
		}
	}

	/**
	 * Creates a new task within a project.
	 *
	 * @param options - An object containing parameters for task creation.
	 * @returns A Promise that resolves to the newly created task.
	 */
	async createTask(
		options: { projectId: ID; organizationId: ID; tenantId: ID },
		entity: ITaskCreateInput | ITaskUpdateInput
	): Promise<ITask> {
		try {
			// Retrieve the maximum task number for the project
			const maxNumber = await this._taskService.getMaxTaskNumberByProject(options);

			// Create a new task with the provided entity data
			const newTask = this.typeOrmTaskRepository.create({
				...entity,
				number: maxNumber + 1,
				organizationId: options.organizationId,
				tenantId: options.tenantId
			});

			console.log(chalk.magenta(`Syncing GitHub Automation Task: %s`), newTask);

			// Save the new task
			const createdTask = await this.typeOrmTaskRepository.save(newTask);

			// Subscribe creator to the task
			const { organizationId, tenantId } = createdTask;
			this._eventBus.publish(
				new CreateSubscriptionEvent({
					entity: BaseEntityEnum.Task,
					entityId: createdTask.id,
					userId: createdTask.creatorId,
					type: SubscriptionTypeEnum.CREATED_ENTITY,
					organizationId,
					tenantId
				})
			);

			// Subscribe assignees to the task
			if (entity.members.length > 0) {
				try {
					const employeeIds = entity.members.map(({ id }) => id);
					const employees = await this._employeeService.findActiveEmployeesByEmployeeIds(
						employeeIds,
						organizationId,
						tenantId
					);
					await Promise.all(
						employees.map(({ userId }) =>
							this._eventBus.publish(
								new CreateSubscriptionEvent({
									entity: BaseEntityEnum.Task,
									entityId: createdTask.id,
									userId,
									type: SubscriptionTypeEnum.ASSIGNMENT,
									organizationId,
									tenantId
								})
							)
						)
					);
				} catch (error) {
					console.error('Error subscribing new members to the task:', error);
				}
			}

			// Activity Log Task Creation
			this.activityLogService.logActivity<Task>(
				BaseEntityEnum.Task,
				ActionTypeEnum.Created,
				ActorTypeEnum.System,
				createdTask.id,
				createdTask.title,
				createdTask,
				organizationId,
				tenantId
			);

			// Return the created Task
			return createdTask;
		} catch (error) {
			// Handle and log errors, and return a rejected promise or throw an exception.
			console.log(chalk.red(`Error while creating task using Automation Task: %s`, error.message), entity);
		}
	}

	/**
	 * Updates a task with new data.
	 *
	 * @param id - The ID of the task to update.
	 * @param entity - The new data for the task.
	 * @returns A Promise that resolves to the updated task.
	 */
	async updateTask(id: ID, entity: ITaskUpdateInput): Promise<ITask> {
		try {
			const { members = [] } = entity;
			// Find task relations
			const relations: FindOptionsRelations<Task> = {
				tags: true,
				members: true,
				teams: true,
				modules: true,
				parent: true,
				project: true,
				organizationSprint: true,
				taskStatus: true,
				taskSize: true,
				taskPriority: true,
				linkedIssues: true,
				dailyPlans: true
			};

			// Find the existing task by its ID
			const existingTask = await this._taskService.findOneByIdString(id, { relations });
			if (!existingTask) {
				return;
			}
			const taskMembers = existingTask.members;

			// Separate members into removed and new members
			const memberIds = members.map(({ id }) => id);
			const existingMemberIds = taskMembers.map(({ id }) => id);

			const removedMembers = taskMembers.filter((member) => !memberIds.includes(member.id));
			const newMembers = members.filter((member) => !existingMemberIds.includes(member.id));

			// Update the existing task with the new entity data
			this.typeOrmTaskRepository.merge(existingTask, entity);

			// Save the updated task
			const updatedTask = await this.typeOrmTaskRepository.save(existingTask);
			const { organizationId, tenantId } = updatedTask;

			// Unsubscribe members who were unassigned from task
			if (removedMembers.length > 0) {
				try {
					await Promise.all(
						removedMembers.map(
							async (member) =>
								await this._subscriptionService.delete({
									entity: BaseEntityEnum.Task,
									entityId: updatedTask.id,
									userId: member.userId,
									type: SubscriptionTypeEnum.ASSIGNMENT
								})
						)
					);
				} catch (error) {
					console.error('Error subscribing new members to the task:', error);
				}
			}

			// Subscribe new assignees to the task
			if (newMembers.length) {
				try {
					await Promise.all(
						newMembers.map(({ userId }) =>
							this._eventBus.publish(
								new CreateSubscriptionEvent({
									entity: BaseEntityEnum.Task,
									entityId: updatedTask.id,
									userId,
									type: SubscriptionTypeEnum.ASSIGNMENT,
									organizationId,
									tenantId
								})
							)
						)
					);
				} catch (error) {
					console.error('Error subscribing new members to the task:', error);
				}
			}

			// Activity Log Task Update
			this.activityLogService.logActivity<Task>(
				BaseEntityEnum.Task,
				ActionTypeEnum.Updated,
				ActorTypeEnum.System,
				updatedTask.id,
				updatedTask.title,
				updatedTask,
				organizationId,
				tenantId,
				existingTask,
				entity
			);

			// Return the updated Task
			return updatedTask;
		} catch (error) {
			// Handle and log errors, and return a rejected promise or throw an exception.
			console.log(chalk.red(`Error while updating task using Automation Task: %s`), error.message);
		}
	}
}
