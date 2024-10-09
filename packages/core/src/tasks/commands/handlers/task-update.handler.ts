import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ID, ITask, ITaskUpdateInput } from '@gauzy/contracts';
import { TaskEvent } from '../../../event-bus/events';
import { EventBus } from '../../../event-bus/event-bus';
import { BaseEntityEventTypeEnum } from '../../../event-bus/base-entity-event';
import { RequestContext } from '../../../core/context';
import { TaskService } from '../../task.service';
import { TaskUpdateCommand } from '../task-update.command';

@CommandHandler(TaskUpdateCommand)
export class TaskUpdateHandler implements ICommandHandler<TaskUpdateCommand> {
	private readonly logger = new Logger('TaskUpdateHandler');

	constructor(private readonly _eventBus: EventBus, private readonly _taskService: TaskService) {}

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
			// Update the task with the provided data
			const updatedTask = await this._taskService.update(id, input);

			// The "2 Way Sync Triggered Event" for Synchronization
			if (triggeredEvent) {
				// Publish the task created event
				const ctx = RequestContext.currentRequestContext(); // Get current request context;
				const event = new TaskEvent(ctx, updatedTask, BaseEntityEventTypeEnum.UPDATED, input);
				this._eventBus.publish(event); // Publish the event using EventBus
			}

			return updatedTask;
		} catch (error) {
			this.logger.error(`Error while updating task: ${error.message}`, error.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}
}
