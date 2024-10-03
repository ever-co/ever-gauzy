import { CommandHandler, ICommandHandler, EventBus as CqrsEventBus } from '@nestjs/cqrs';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ActionTypeEnum, ActivityLogEntityEnum, ActorTypeEnum, ITask } from '@gauzy/contracts';
import { ActivityLogEvent } from '../../../activity-log/events';
import { generateActivityLogDescription } from '../../../activity-log/activity-log.helper';
import { EventBus } from '../../../event-bus';
import { TaskEvent } from '../../../event-bus/events';
import { BaseEntityEventTypeEnum } from '../../../event-bus/base-entity-event';
import { RequestContext } from './../../../core/context';
import { OrganizationProjectService } from './../../../organization-project/organization-project.service';
import { TaskCreateCommand } from './../task-create.command';
import { TaskService } from '../../task.service';

@CommandHandler(TaskCreateCommand)
export class TaskCreateHandler implements ICommandHandler<TaskCreateCommand> {
	private readonly logger = new Logger('TaskCreateCommand');

	constructor(
		// TODO : use only one event bus type
		private readonly _eventBus: EventBus,
		private readonly _cqrsEventBus: CqrsEventBus,
		private readonly _taskService: TaskService,
		private readonly _organizationProjectService: OrganizationProjectService
	) {}

	/**
	 * Executes the task creation command, handling project association and event publishing.
	 *
	 * @param command The command containing task creation input and event triggering flag.
	 * @returns The created task.
	 */
	public async execute(command: TaskCreateCommand): Promise<ITask> {
		try {
			// Destructure input and triggered event flag from the command
			const { input, triggeredEvent } = command;
			let { organizationId, project } = input;

			// Retrieve current tenant ID from request context or use input tenant ID
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			// If input contains project ID, fetch project details
			if (input.projectId) {
				const { projectId } = input;
				project = await this._organizationProjectService.findOneByIdString(projectId);
			}

			// Determine project ID and task prefix based on project existence
			const projectId = project ? project.id : null;
			const taskPrefix = project ? project.name.substring(0, 3) : null;

			// Retrieve the maximum task number for the specified project
			const maxNumber = await this._taskService.getMaxTaskNumberByProject({
				tenantId,
				organizationId,
				projectId
			});

			// Create the task with incremented number, prefix, and other details
			const createdTask = await this._taskService.create({
				...input,
				number: maxNumber + 1,
				prefix: taskPrefix,
				tenantId,
				organizationId
			});

			// Publish a task created event if triggeredEvent flag is set
			if (triggeredEvent) {
				// Publish the task created event
				const ctx = RequestContext.currentRequestContext(); // Get current request context;
				const event = new TaskEvent(ctx, createdTask, BaseEntityEventTypeEnum.CREATED, input);
				this._eventBus.publish(event); // Publish the event using EventBus
			}

			// Generate the activity log description
			const description = generateActivityLogDescription(
				ActionTypeEnum.Created,
				ActivityLogEntityEnum.Task,
				createdTask.title
			);

			// Emit an event to log the activity
			this._cqrsEventBus.publish(
				new ActivityLogEvent({
					entity: ActivityLogEntityEnum.Task,
					entityId: createdTask.id,
					action: ActionTypeEnum.Created,
					actorType: ActorTypeEnum.User, // TODO : Since we have Github Integration, make sure we can also store "System" for actor
					description,
					data: createdTask,
					organizationId,
					tenantId
				})
			);

			return createdTask; // Return the created task
		} catch (error) {
			// Handle errors during task creation
			this.logger.error(`Error while creating task: ${error.message}`, error.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}
}
