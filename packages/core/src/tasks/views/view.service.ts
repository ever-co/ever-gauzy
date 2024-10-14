import { EventBus } from '@nestjs/cqrs';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	EntityEnum,
	FavoriteEntityEnum,
	ID,
	ITaskView,
	ITaskViewCreateInput,
	ITaskViewUpdateInput
} from '@gauzy/contracts';
import { FavoriteService } from '../../core/decorators';
import { TenantAwareCrudService } from '../../core/crud';
import { RequestContext } from '../../core/context';
import { ActivityLogEvent } from '../../activity-log/events';
import {
	activityLogUpdatedFieldsAndValues,
	generateActivityLogDescription
} from '../../activity-log/activity-log.helper';
import { TaskView } from './view.entity';
import { TypeOrmTaskViewRepository } from './repository/type-orm-task-view.repository';
import { MikroOrmTaskViewRepository } from './repository/mikro-orm-task-view.repository';

@FavoriteService(FavoriteEntityEnum.OrganizationTeam)
@Injectable()
export class TaskViewService extends TenantAwareCrudService<TaskView> {
	constructor(
		@InjectRepository(TaskView)
		typeOrmTaskViewRepository: TypeOrmTaskViewRepository,

		mikroOrmTaskViewRepository: MikroOrmTaskViewRepository,

		private readonly _eventBus: EventBus
	) {
		super(typeOrmTaskViewRepository, mikroOrmTaskViewRepository);
	}

	/**
	 * @description Creates a Task View based on provided input
	 * @param {ITaskViewCreateInput} entity - Input data for creating the task view
	 * @returns A promise resolving to the created Task View
	 * @throws BadRequestException if there is an error in the creation process.
	 * @memberof TaskViewService
	 */
	async create(entity: ITaskViewCreateInput): Promise<ITaskView> {
		const tenantId = RequestContext.currentTenantId() || entity.tenantId;
		const { organizationId } = entity;
		try {
			const view = await super.create({ ...entity, tenantId });

			// Generate the activity log description.
			const description = generateActivityLogDescription(ActionTypeEnum.Created, EntityEnum.TaskView, view.name);

			// Emit an event to log the activity
			this._eventBus.publish(
				new ActivityLogEvent({
					entity: EntityEnum.TaskView,
					entityId: view.id,
					action: ActionTypeEnum.Created,
					actorType: ActorTypeEnum.User,
					description,
					data: view,
					organizationId,
					tenantId
				})
			);

			return view;
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to create view : ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * @description Update a Task View
	 * @param {ID} id - The ID of the Task View to be updated
	 * @param {ITaskViewUpdateInput} input - The updated information for the Task View
	 * @throws BadRequestException if there's an error during the update process.
	 * @returns {Promise<ITaskView>} A Promise resolving to the updated Task View
	 * @memberof TaskViewService
	 */
	async update(id: ID, input: ITaskViewUpdateInput): Promise<ITaskView> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		try {
			const updatedTaskView = await super.create({
				...input,
				tenantId,
				id
			});

			// Generate the activity log description.
			const description = generateActivityLogDescription(
				ActionTypeEnum.Updated,
				EntityEnum.TaskView,
				updatedTaskView.name
			);

			// Compare values before and after update then add updates to fields
			const { updatedFields, previousValues, updatedValues } = activityLogUpdatedFieldsAndValues(
				updatedTaskView,
				input
			);

			// Emit event to log activity
			this._eventBus.publish(
				new ActivityLogEvent({
					entity: EntityEnum.TaskView,
					entityId: updatedTaskView.id,
					action: ActionTypeEnum.Updated,
					actorType: ActorTypeEnum.User,
					description,
					updatedFields,
					updatedValues,
					previousValues,
					data: updatedTaskView,
					organizationId: updatedTaskView.organizationId,
					tenantId
				})
			);

			// return updated view
			return updatedTaskView;
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to update view: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
