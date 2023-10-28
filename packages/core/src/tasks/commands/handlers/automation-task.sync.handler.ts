import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IIntegrationMap,
	IOrganization,
	IOrganizationProject,
	ITask,
	ITaskCreateInput,
	ITaskUpdateInput,
	IntegrationEntity
} from '@gauzy/contracts';
import { RequestContext } from 'core/context';
import { IntegrationMap, TaskStatus } from 'core/entities/internal';
import { AutomationTaskSyncCommand } from './../automation-task.sync.command';
import { TaskService } from './../../task.service';
import { Task } from './../../task.entity';

@CommandHandler(AutomationTaskSyncCommand)
export class AutomationTaskSyncHandler implements ICommandHandler<AutomationTaskSyncCommand> {

	constructor(
		@InjectRepository(Task) private readonly taskRepository: Repository<Task>,
		@InjectRepository(TaskStatus) private readonly taskStatusRepository: Repository<TaskStatus>,
		@InjectRepository(IntegrationMap) private readonly integrationMapRepository: Repository<IntegrationMap>,
		private readonly _taskService: TaskService
	) { }

	async execute(command: AutomationTaskSyncCommand): Promise<IIntegrationMap> {
		try {
			const { input } = command;
			const { sourceId, integrationId, organizationId, entity } = input;
			const { projectId } = entity;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			const taskStatus = await this.taskStatusRepository.findOneBy({
				tenantId,
				organizationId,
				projectId,
				name: entity.status
			});
			entity.taskStatus = taskStatus;

			try {
				// Check if an integration map already exists for the issue
				const integrationMap = await this.integrationMapRepository.findOneByOrFail({
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
					console.log(`${IntegrationEntity.TASK} Not Found for integration GauzyID %s: `, integrationMap.gauzyId);
					// Create a new task with the provided entity data
					await this.createTask({
						projectId,
						organizationId,
						tenantId
					}, {
						...entity,
						id: integrationMap.gauzyId
					});
				}

				// Return the integration map
				return integrationMap;
			} catch (error) {
				// Create a new task with the provided entity data
				const task = await this.createTask({
					projectId,
					organizationId,
					tenantId
				}, entity);
				// Create a new integration map for the issue
				return await this.integrationMapRepository.save(
					this.integrationMapRepository.create({
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
	async createTask(options: {
		projectId: IOrganizationProject['id'];
		organizationId: IOrganization['id'];
		tenantId: IOrganization['tenantId'];
	}, entity: ITaskCreateInput | ITaskUpdateInput): Promise<ITask> {
		try {
			// Retrieve the maximum task number for the project
			const maxNumber = await this._taskService.getMaxTaskNumberByProject(options);

			// Create a new task with the provided entity data
			const newTask = this.taskRepository.create({
				...entity,
				number: maxNumber + 1,
				organizationId: options.organizationId,
				tenantId: options.tenantId
			});

			// Save the new task
			const createdTask = await this.taskRepository.save(newTask);
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
	async updateTask(
		id: ITaskUpdateInput['id'],
		entity: ITaskUpdateInput
	): Promise<ITask> {
		try {
			// Find the existing task by its ID
			const existingTask = await this._taskService.findOneByIdString(id);
			if (!existingTask) {
				return;
			}

			// Update the existing task with the new entity data
			this.taskRepository.merge(existingTask, entity);

			// Save the updated task
			const updatedTask = await this.taskRepository.save(existingTask);
			return updatedTask;
		} catch (error) {
			// Handle and log errors, and return a rejected promise or throw an exception.
			console.error('Error automation syncing a task:', error);
		}
	}
}
