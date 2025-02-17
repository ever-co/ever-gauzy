import { CommandHandler, ICommandHandler, EventBus as CqrsEventBus } from '@nestjs/cqrs';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import {
	BaseEntityEnum,
	ActorTypeEnum,
	ITask,
	ActionTypeEnum,
	SubscriptionTypeEnum,
	ID,
	IEmployee,
	EmployeeNotificationTypeEnum,
	NotificationActionTypeEnum
} from '@gauzy/contracts';
import { EventBus } from '../../../event-bus';
import { TaskEvent } from '../../../event-bus/events';
import { BaseEntityEventTypeEnum } from '../../../event-bus/base-entity-event';
import { Employee } from '../../../core/entities/internal';
import { RequestContext } from './../../../core/context';
import { OrganizationProjectService } from './../../../organization-project/organization-project.service';
import { CreateSubscriptionEvent } from '../../../subscription/events';
import { TaskCreateCommand } from './../task-create.command';
import { TaskService } from '../../task.service';
import { Task } from './../../task.entity';
import { EmployeeService } from '../../../employee/employee.service';
import { MentionService } from '../../../mention/mention.service';
import { ActivityLogService } from '../../../activity-log/activity-log.service';
import { EmployeeNotificationService } from '../../../employee-notification/employee-notification.service';

@CommandHandler(TaskCreateCommand)
export class TaskCreateHandler implements ICommandHandler<TaskCreateCommand> {
	private readonly logger = new Logger('TaskCreateCommand');

	constructor(
		private readonly _eventBus: EventBus,
		private readonly _cqrsEventBus: CqrsEventBus,
		private readonly _taskService: TaskService,
		private readonly _organizationProjectService: OrganizationProjectService,
		private readonly _employeeService: EmployeeService,
		private readonly mentionService: MentionService,
		private readonly activityLogService: ActivityLogService,
		private readonly EmployeeNotificationService: EmployeeNotificationService
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
			const { organizationId, mentionEmployeeIds = [], members = [], ...data } = input;

			// Retrieve current tenant ID from request context or use input tenant ID
			const tenantId = RequestContext.currentTenantId() ?? data.tenantId;

			// Retrieve current user and employee from the request context
			const user = RequestContext.currentUser();
			const employeeId = RequestContext.currentEmployeeId();

			const employee = await this._employeeService.findOneByIdString(employeeId);
			// Ensure the current employee is added to the members list
			if (employee && !members.some((member) => member.id === employeeId)) {
				members.push(employee);
			}

			// Determine the project based on the provided data
			const project = data.projectId
				? await this._organizationProjectService.findOneByIdString(data.projectId)
				: data.project ?? null;

			// Extract the project prefix (first 3 characters of the project name) if the project exists
			const projectPrefix = project?.name?.slice(0, 3) || null;

			// Log or throw an exception if both projectId and project are not provided (optional)
			if (!project) {
				this.logger.warn('No projectId or project provided. Proceeding without project information.');
			}

			// Retrieve the maximum task number for the specified project, or handle null projectId if no project
			const maxNumber = await this._taskService.getMaxTaskNumberByProject({
				tenantId,
				organizationId,
				projectId: project?.id ?? null // If no project is provided, this will pass null for projectId
			});

			// Create the task with incremented number, project prefix, and other task details
			const task = await this._taskService.create({
				...data, // Spread the input properties
				members: members.map(({ id }) => new Employee({ id })),
				number: maxNumber + 1, // Increment the task number
				prefix: projectPrefix, // Use the project prefix, or null if no project
				tenantId, // Pass the tenant ID
				organizationId // Pass the organization ID
			});

			// Publish a task created event if triggeredEvent flag is set
			if (triggeredEvent) {
				const ctx = RequestContext.currentRequestContext(); // Get current request context;
				this._eventBus.publish(new TaskEvent(ctx, task, BaseEntityEventTypeEnum.CREATED, data)); // Publish the event using EventBus
			}

			// Apply mentions if needed
			if (mentionEmployeeIds.length > 0) {
				await Promise.all(
					mentionEmployeeIds.map((mentionedUserId: ID) =>
						this.mentionService.publishMention({
							entity: BaseEntityEnum.Task,
							entityId: task.id,
							mentionedUserId,
							mentionById: task.creatorId,
							organizationId,
							tenantId,
							entityName: task.title
						})
					)
				);
			}

			// Subscribe creator to the task
			this._cqrsEventBus.publish(
				new CreateSubscriptionEvent({
					entity: BaseEntityEnum.Task,
					entityId: task.id,
					userId: task.creatorId,
					type: SubscriptionTypeEnum.CREATED_ENTITY,
					organizationId,
					tenantId
				})
			);

			// Subscribe assignees to the task
			if (members.length > 0) {
				try {
					// Map employee IDs to IDs
					const employeeIds = members.map(({ id }) => id);

					// Find active employees by employee IDs
					const employees = await this._employeeService.findActiveEmployeesByEmployeeIds(
						employeeIds,
						organizationId,
						tenantId
					);

					// Publish subscription events for each employee and send internal notification to users
					await Promise.all(
						employees.map(({ userId }: IEmployee) => {
							this._cqrsEventBus.publish(
								new CreateSubscriptionEvent({
									entity: BaseEntityEnum.Task,
									entityId: task.id,
									userId,
									type: SubscriptionTypeEnum.ASSIGNMENT,
									organizationId,
									tenantId
								})
							);

							this.EmployeeNotificationService.publishNotificationEvent(
								{
									entity: BaseEntityEnum.Task,
									entityId: task.id,
									type: EmployeeNotificationTypeEnum.ASSIGNMENT,
									sentById: task.creatorId,
									receiverId: userId,
									organizationId,
									tenantId
								},
								NotificationActionTypeEnum.Assigned,
								task.title,
								`${user.firstName} ${user.lastName}`
							);
						})
					);
				} catch (error) {
					this.logger.error('Error while subscribing members to task', error);
				}
			}

			// Generate the activity log
			this.activityLogService.logActivity<Task>(
				BaseEntityEnum.Task,
				ActionTypeEnum.Created,
				ActorTypeEnum.User, // TODO : Since we have Github Integration, make sure we can also store "System" for actor
				task.id,
				task.title,
				task,
				organizationId,
				tenantId
			);

			return task; // Return the created task
		} catch (error) {
			// Handle errors during task creation
			this.logger.error(`Error while creating task: ${error.message}`, error.message);
			throw new HttpException({ message: error?.message, error }, HttpStatus.BAD_REQUEST);
		}
	}
}
