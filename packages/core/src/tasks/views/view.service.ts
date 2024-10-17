import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	ID,
	ITaskView,
	ITaskViewCreateInput,
	ITaskViewUpdateInput
} from '@gauzy/contracts';
import { FavoriteService } from '../../core/decorators';
import { TenantAwareCrudService } from '../../core/crud';
import { RequestContext } from '../../core/context';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { TaskView } from './view.entity';
import { TypeOrmTaskViewRepository } from './repository/type-orm-task-view.repository';
import { MikroOrmTaskViewRepository } from './repository/mikro-orm-task-view.repository';

@FavoriteService(BaseEntityEnum.TaskView)
@Injectable()
export class TaskViewService extends TenantAwareCrudService<TaskView> {
	constructor(
		@InjectRepository(TaskView)
		typeOrmTaskViewRepository: TypeOrmTaskViewRepository,

		mikroOrmTaskViewRepository: MikroOrmTaskViewRepository,

		private readonly activityLogService: ActivityLogService
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
			const taskView = await super.create({ ...entity, tenantId });

			// Generate the activity log
			this.activityLogService.logActivity<TaskView>(
				BaseEntityEnum.TaskView,
				ActionTypeEnum.Created,
				ActorTypeEnum.User,
				taskView.id,
				taskView.name,
				taskView,
				organizationId,
				tenantId
			);

			// return the created task view
			return taskView;
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to create view : ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * @description Update a Task View
	 * @param {ID} id - The ID of the Task View to be updated
	 * @param {ITaskViewUpdateInput} input - The updated information for the Task View
	 * @throws NotFoundException if there's an error if requested update view was not found.
	 * @throws BadRequest if there's an error during the update process.
	 * @returns {Promise<ITaskView>} A Promise resolving to the updated Task View
	 * @memberof TaskViewService
	 */
	async update(id: ID, input: ITaskViewUpdateInput): Promise<ITaskView> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		try {
			// Retrieve existing view.
			const existingTaskView = await this.findOneByIdString(id);

			if (!existingTaskView) {
				throw new NotFoundException('View not found');
			}

			const updatedTaskView = await super.create({
				...input,
				tenantId,
				id
			});

			// Generate the activity log
			const { organizationId } = updatedTaskView;
			this.activityLogService.logActivity<TaskView>(
				BaseEntityEnum.TaskView,
				ActionTypeEnum.Updated,
				ActorTypeEnum.User,
				updatedTaskView.id,
				updatedTaskView.name,
				updatedTaskView,
				organizationId,
				tenantId,
				existingTaskView,
				input
			);

			// return updated view
			return updatedTaskView;
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to update view: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
