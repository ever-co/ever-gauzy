import { CommandHandler, ICommandHandler, EventBus as CqrsEventBus } from '@nestjs/cqrs';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import {
	ActionTypeEnum,
	ActivityLogEntityEnum,
	ActorTypeEnum,
	IActivityLogUpdatedValues,
	ID,
	ITask,
	ITaskUpdateInput
} from '@gauzy/contracts';
import { ActivityLogEvent } from '../../../activity-log/events';
import { generateActivityLogDescription } from '../../../activity-log/activity-log.helper';
import { TaskEvent } from '../../../event-bus/events';
import { EventBus } from '../../../event-bus/event-bus';
import { BaseEntityEventTypeEnum } from '../../../event-bus/base-entity-event';
import { RequestContext } from '../../../core/context';
import { TaskService } from '../../task.service';
import { TaskUpdateCommand } from '../task-update.command';

@CommandHandler(TaskUpdateCommand)
export class TaskUpdateHandler implements ICommandHandler<TaskUpdateCommand> {
	private readonly logger = new Logger('TaskUpdateHandler');

	constructor(
		private readonly _eventBus: EventBus,
		private readonly _cqrsEventBus: CqrsEventBus,
		private readonly _taskService: TaskService
	) {}

	/**
	 * Executes the TaskUpdateCommand.
	 *
	 * @param command - The command containing the task ID, update data, and a flag indicating whether to trigger an event.
	 * @returns The updated task.
	 */
	public async execute(command: TaskUpdateCommand): Promise<ITask> {
		// Destructure the command object to get the task ID, input data, and the triggered event flag
		const { id, input, triggeredEvent } = command;

		// Call the update method with the extracted parameters and return the updated task
		return await this.update(id, input, triggeredEvent);
	}

	/**
	 * Update task, if already exist
	 *
	 * @param id - The ID of the task to update
	 * @param input - The data to update the task with
	 * @param triggeredEvent - Flag to indicate if an event should be triggered
	 * @returns The updated task
	 */
	public async update(id: ID, input: ITaskUpdateInput, triggeredEvent: boolean): Promise<ITask> {
		try {
			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const task = await this._taskService.findOneByIdString(id);

			if (input.projectId && input.projectId !== task.projectId) {
				const { organizationId, projectId } = task;

				// Get the maximum task number for the project
				const maxNumber = await this._taskService.getMaxTaskNumberByProject({
					tenantId,
					organizationId,
					projectId
				});

				// Update the task with the new project and task number
				await this._taskService.update(id, {
					projectId,
					number: maxNumber + 1
				});
			}

			// Update the task with the provided data
			const updatedTask = await this._taskService.create({
				...input,
				id
			});

			// The "2 Way Sync Triggered Event" for Synchronization
			if (triggeredEvent) {
				// Publish the task created event
				const ctx = RequestContext.currentRequestContext(); // Get current request context;
				const event = new TaskEvent(ctx, updatedTask, BaseEntityEventTypeEnum.UPDATED, input);
				this._eventBus.publish(event); // Publish the event using EventBus
			}

			// Generate the activity log description
			const description = generateActivityLogDescription(
				ActionTypeEnum.Updated,
				ActivityLogEntityEnum.Task,
				updatedTask.title
			);

			const { updatedFields, previousValues, updatedValues } = this.activityLogUpdatedFieldsAndValues(
				updatedTask,
				input
			);

			// Emit an event to log the activity
			this._cqrsEventBus.publish(
				new ActivityLogEvent({
					entity: ActivityLogEntityEnum.Task,
					entityId: updatedTask.id,
					action: ActionTypeEnum.Updated,
					actorType: ActorTypeEnum.User, // TODO : Since we have Github Integration, make sure we can also store "System" for actor
					description,
					updatedFields,
					updatedValues,
					previousValues,
					data: updatedTask,
					organizationId: updatedTask.organizationId,
					tenantId
				})
			);

			return updatedTask;
		} catch (error) {
			this.logger.error(`Error while updating task: ${error.message}`, error.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * @description - Compare values before and after update then add updates to fields
	 * @param {ITask} task - Updated task
	 * @param {ITaskUpdateInput} entity - Input data with new values
	 */
	private activityLogUpdatedFieldsAndValues(task: ITask, entity: ITaskUpdateInput) {
		const updatedFields = [];
		const previousValues: IActivityLogUpdatedValues[] = [];
		const updatedValues: IActivityLogUpdatedValues[] = [];

		for (const key of Object.keys(entity)) {
			if (task[key] !== entity[key]) {
				// Add updated field
				updatedFields.push(key);

				// Add old and new values
				previousValues.push({ [key]: task[key] });
				updatedValues.push({ [key]: task[key] });
			}
		}

		return { updatedFields, previousValues, updatedValues };
	}
}
