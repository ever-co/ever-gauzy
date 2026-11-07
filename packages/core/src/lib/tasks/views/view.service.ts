import { ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	ID,
	IPagination,
	ITaskView,
	ITaskViewCreateInput,
	ITaskViewOrderInput,
	ITaskViewUpdateInput,
	TaskViewVisibilityEnum
} from '@gauzy/contracts';
import { FavoriteService } from '../../core/decorators';
import { TenantAwareCrudService } from '../../core/crud';
import { LegacyFindManyOptions, LegacyFindOneOptions } from '../../core/utils';
import { RequestContext } from '../../core/context';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { TaskView } from './view.entity';
import { TypeOrmTaskViewRepository } from './repository/type-orm-task-view.repository';
import { MikroOrmTaskViewRepository } from './repository/mikro-orm-task-view.repository';

@FavoriteService(BaseEntityEnum.TaskView)
@Injectable()
export class TaskViewService extends TenantAwareCrudService<TaskView> {
	constructor(
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
		// Retrieve existing view.
		const existingTaskView = await this.findOneByIdString(id);
		if (!existingTaskView) {
			throw new NotFoundException('View not found');
		}
		// A save that states the version it read is refused when the view moved on since: the caller gets the
		// latest view to merge into, nothing is overwritten.
		this.assertExpectedVersion(existingTaskView, input.expectedVersion);
		const { expectedVersion: _expected, ...changes } = input;
		void _expected;
		try {
			const updatedTaskView = await super.create({
				...changes,
				tenantId,
				id,
				version: (existingTaskView.version ?? 1) + 1
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

	/**
	 * The views as the caller may list them: every shared view the query reaches, and the caller's own personal
	 * views. Another person's personal views never appear, whatever the query asks.
	 */
	public async findAll(filter?: LegacyFindManyOptions<TaskView>): Promise<IPagination<TaskView>> {
		const page = await super.findAll(filter);
		const userId = RequestContext.currentUserId();
		const hidden = page.items.filter((view) => isPersonalOfSomeoneElse(view, userId)).length;
		if (hidden === 0) {
			return page;
		}
		return {
			items: page.items.filter((view) => !isPersonalOfSomeoneElse(view, userId)),
			total: Math.max(0, page.total - hidden)
		};
	}

	/** A personal view reads as not found to anyone but its creator. */
	public async findOneByIdString(id: ID, options?: LegacyFindOneOptions<TaskView>): Promise<TaskView> {
		const view = await super.findOneByIdString(id, options);
		if (isPersonalOfSomeoneElse(view, RequestContext.currentUserId())) {
			throw new NotFoundException('View not found');
		}
		return view;
	}

	/**
	 * Sets the order the view shows its tasks in (manual ordering): the whole list, each task once. Bumps the
	 * version like any save; a stated `expectedVersion` is checked first.
	 */
	async setOrder(id: ID, input: ITaskViewOrderInput): Promise<ITaskView> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;
		const existing = await this.findOneByIdString(id);
		if (!existing) {
			throw new NotFoundException('View not found');
		}
		this.assertExpectedVersion(existing, input.expectedVersion);
		const manualOrder = [...new Set((input.taskIds ?? []).map((taskId) => String(taskId)))] as ID[];
		const updated = await super.create({ id, tenantId, manualOrder, version: (existing.version ?? 1) + 1 });
		this.activityLogService.logActivity<TaskView>(
			BaseEntityEnum.TaskView,
			ActionTypeEnum.Updated,
			ActorTypeEnum.User,
			updated.id,
			updated.name,
			updated,
			updated.organizationId,
			tenantId,
			existing,
			{ manualOrder }
		);
		return updated;
	}

	/** 409 with the latest view when the caller's version is behind. */
	private assertExpectedVersion(existing: ITaskView, expectedVersion: number | undefined): void {
		if (expectedVersion === undefined || expectedVersion === null) {
			return;
		}
		const current = existing.version ?? 1;
		if (expectedVersion !== current) {
			throw new ConflictException({
				message: `TASK_VIEW_VERSION_CONFLICT: the view is at version ${current}, not ${expectedVersion}.`,
				code: 'TASK_VIEW_VERSION_CONFLICT',
				view: existing
			});
		}
	}
}

/** Whether a view is personal and belongs to someone other than `userId`. */
export function isPersonalOfSomeoneElse(
	view: Pick<ITaskView, 'visibility' | 'createdByUserId'> | null | undefined,
	userId: ID | null | undefined
): boolean {
	if (!view || view.visibility !== TaskViewVisibilityEnum.PERSONAL) {
		return false;
	}
	return !view.createdByUserId || !userId || String(view.createdByUserId) !== String(userId);
}
