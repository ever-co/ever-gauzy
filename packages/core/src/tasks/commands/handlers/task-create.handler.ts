import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ITask } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { OrganizationProjectService } from './../../../organization-project/organization-project.service';
import { TaskCreatedEvent } from './../../events/task-created.event';
import { TaskCreateCommand } from './../task-create.command';
import { TaskService } from '../../task.service';

@CommandHandler(TaskCreateCommand)
export class TaskCreateHandler implements ICommandHandler<TaskCreateCommand> {
	private readonly logger = new Logger('TaskCreateCommand');

	constructor(
		private readonly _eventBus: EventBus,
		private readonly _taskService: TaskService,
		private readonly _organizationProjectService: OrganizationProjectService
	) { }

	public async execute(command: TaskCreateCommand): Promise<ITask> {
		try {
			const { input, triggeredEvent } = command;
			let { organizationId, project } = input;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			/** If project found then use project name as a task prefix */
			if (input.projectId) {
				const { projectId } = input;
				project = await this._organizationProjectService.findOneByIdString(projectId);
			}

			const projectId = project ? project.id : null;
			const taskPrefix = project ? project.name.substring(0, 3) : null;

			const maxNumber = await this._taskService.getMaxTaskNumberByProject({
				tenantId,
				organizationId,
				projectId,
			});

			const createdTask = await this._taskService.create({
				...input,
				number: maxNumber + 1,
				prefix: taskPrefix,
				tenantId,
				organizationId,
			});

			// The "2 Way Sync Triggered Event" for Synchronization
			if (triggeredEvent) {
				this._eventBus.publish(new TaskCreatedEvent(createdTask));
			}

			return createdTask;
		} catch (error) {
			this.logger.error(`Error while creating task: ${error.message}`, error.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}
}
