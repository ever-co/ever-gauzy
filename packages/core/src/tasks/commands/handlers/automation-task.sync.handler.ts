import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import {
	IIntegrationMap,
	IOrganization,
	IOrganizationProject,
	ITask,
	ITaskCreateInput,
	ITaskUpdateInput
} from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { IntegrationMap, TaskStatus } from '../../../core/entities/internal';
import { AutomationTaskSyncCommand } from './../automation-task.sync.command';
import { TaskService } from './../../task.service';
import { Task } from './../../task.entity';
import { TypeOrmIntegrationMapRepository } from '../../../integration-map/repository/type-orm-integration-map.repository';
import { TypeOrmTaskStatusRepository } from '../../statuses/repository/type-orm-task-status.repository';
import { TypeOrmTaskRepository } from '../../repository/type-orm-task.repository';

@CommandHandler(AutomationTaskSyncCommand)
export class AutomationTaskSyncHandler implements ICommandHandler<AutomationTaskSyncCommand> {
	constructor(
		@InjectRepository(Task)
		private readonly typeOrmTaskRepository: TypeOrmTaskRepository,

		@InjectRepository(TaskStatus)
		private readonly typeOrmTaskStatusRepository: TypeOrmTaskStatusRepository,

		@InjectRepository(IntegrationMap)
		private readonly typeOrmIntegrationMapRepository: TypeOrmIntegrationMapRepository,

		private readonly _taskService: TaskService
	) {}

	async execute(command: AutomationTaskSyncCommand): Promise<IIntegrationMap> {
		try {
			const { input } = command;
			const { sourceId, integrationId, organizationId, entity } = input;
			const { projectId } = entity;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			const taskStatus = await this.typeOrmTaskStatusRepository.findOneBy({
				tenantId,
				organizationId,
				projectId,
				name: entity.status
			});
			entity.taskStatus = taskStatus;

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
						{
							projectId,
							organizationId,
							tenantId
						},
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
				const task = await this.createTask(
					{
						projectId,
						organizationId,
						tenantId
					},
					entity
				);
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
		options: {
			projectId: IOrganizationProject['id'];
			organizationId: IOrganization['id'];
			tenantId: IOrganization['tenantId'];
		},
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

			// Save the new task
			const createdTask = await this.typeOrmTaskRepository.save(newTask);
			return createdTask;
		} catch (error) {
			// Handle and log errors, and return a rejected promise or throw an exception.
			console.error('Error automation syncing a task:', error);
		}
	}

	/**
	 * Updates a task with new data.
	 *
	 * @param id - The ID of the task to update.
	 * @param entity - The new data for the task.
	 * @returns A Promise that resolves to the updated task.
	 */
	async updateTask(id: ITaskUpdateInput['id'], entity: ITaskUpdateInput): Promise<ITask> {
		try {
			// Find the existing task by its ID
			const existingTask = await this._taskService.findOneByIdString(id);
			if (!existingTask) {
				return;
			}

			// Update the existing task with the new entity data
			this.typeOrmTaskRepository.merge(existingTask, entity);

			// Save the updated task
			const updatedTask = await this.typeOrmTaskRepository.save(existingTask);
			return updatedTask;
		} catch (error) {
			// Handle and log errors, and return a rejected promise or throw an exception.
			console.error('Error automation syncing a task:', error);
		}
	}
}
