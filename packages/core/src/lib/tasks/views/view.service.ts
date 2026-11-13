import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
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
import { FindOptionsWhere, IsNull, Not } from 'typeorm';
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
		// latest view to merge into, nothing is overwritten. The changes and the version move in one conditional
		// write, so two saves that read the same version cannot both pass, and a failed save bumps nothing.
		const { expectedVersion, version: _version, ...changes } = input;
		void _version;
		try {
			const updatedTaskView = await this.saveVersioned(existingTaskView, expectedVersion, tenantId, changes);

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
			// The typed refusals of the save keep their status and body (the 409 carries the latest view to merge into).
			if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to update view: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * The views as the caller may list them: every shared view the query reaches, and the caller's own personal
	 * views. The condition is part of the query, so counts and pages are right and a `select` that leaves the
	 * visibility out cannot widen the read. Another person's personal views never appear, whatever the query asks.
	 */
	public async findAll(filter?: LegacyFindManyOptions<TaskView>): Promise<IPagination<TaskView>> {
		return super.findAll(this.visibleOnly(filter));
	}

	public async paginate(filter?: LegacyFindManyOptions<TaskView>): Promise<IPagination<TaskView>> {
		return super.paginate(this.visibleOnly(filter));
	}

	public async count(filter?: LegacyFindManyOptions<TaskView>): Promise<number> {
		return super.count(this.visibleOnly(filter));
	}

	public async find(filter?: LegacyFindManyOptions<TaskView>): Promise<TaskView[]> {
		return super.find(this.visibleOnly(filter));
	}

	/** A personal view reads as not found to anyone but its creator, whatever columns the caller selected. */
	public async findOneByIdString(id: ID, options?: LegacyFindOneOptions<TaskView>): Promise<TaskView> {
		const view = await super.findOneByIdString(id, options);
		if (await this.isHiddenFromCaller(view)) {
			throw new NotFoundException('View not found');
		}
		return view;
	}

	/**
	 * Sets the order the view shows its tasks in (manual ordering): the whole list, each task once. Bumps the
	 * version like any save; a stated `expectedVersion` is checked first, in the same conditional write.
	 */
	async setOrder(id: ID, input: ITaskViewOrderInput): Promise<ITaskView> {
		const tenantId = RequestContext.currentTenantId() || input.tenantId;
		const existing = await this.findOneByIdString(id);
		if (!existing) {
			throw new NotFoundException('View not found');
		}
		const manualOrder = [...new Set((input.taskIds ?? []).map((taskId) => String(taskId)))] as ID[];
		const updated = await this.saveVersioned(existing, input.expectedVersion, tenantId, { manualOrder });
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

	/**
	 * Writes the changes and moves the version in one conditional `UPDATE`, then answers the row as saved. With an
	 * `expectedVersion` the write matches that version and moves it one on: nothing matched means another save got
	 * there first, 409 with the latest view so the caller can merge, and nothing (the version included) changed.
	 * Without one the write matches the row alone and the database adds one to whatever version it holds, so a
	 * caller that did not ask for the check never gets a conflict. Only columns and relations of the view are
	 * written; a stated version is a positive integer, whatever validated the input.
	 */
	private async saveVersioned(
		existing: ITaskView,
		expectedVersion: number | undefined,
		tenantId: ID | undefined,
		changes: Record<string, unknown>
	): Promise<TaskView> {
		if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
			throw new BadRequestException('TASK_VIEW_VERSION_INVALID: expectedVersion is a positive integer.');
		}
		const metadata = this.typeOrmRepository.metadata;
		const values: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(changes)) {
			if (value === undefined || key === 'id' || key === 'tenantId' || key === 'version') continue;
			if (metadata.findColumnWithPropertyPath(key) || metadata.findRelationWithPropertyPath(key)) values[key] = value;
		}
		const where = { id: existing.id, ...(tenantId ? { tenantId } : {}), ...(expectedVersion !== undefined ? { version: expectedVersion } : {}) };
		const version = expectedVersion !== undefined ? expectedVersion + 1 : () => 'version + 1';
		const result = await this.typeOrmRepository.update(where as FindOptionsWhere<TaskView>, { ...values, version } as never);
		if (!result.affected) {
			const latest = await super.findOneByIdString(existing.id as ID).catch(() => null);
			if (expectedVersion === undefined || !latest) {
				throw new NotFoundException('View not found');
			}
			throw new ConflictException({
				message: `TASK_VIEW_VERSION_CONFLICT: the view is at version ${latest.version ?? 1}, not ${expectedVersion}.`,
				code: 'TASK_VIEW_VERSION_CONFLICT',
				view: latest
			});
		}
		return super.findOneByIdString(existing.id as ID);
	}

	/** The caller's read conditions with the visibility rule added as alternatives (an OR of the shared and own cases). */
	private visibleOnly(filter?: LegacyFindManyOptions<TaskView>): LegacyFindManyOptions<TaskView> {
		const userId = RequestContext.currentUserId();
		const bases = Array.isArray(filter?.where) ? filter.where : [filter?.where ?? {}];
		const where = bases.flatMap((base) => visibleAlternatives(base as FindOptionsWhere<TaskView>, userId));
		return { ...(filter ?? {}), where } as LegacyFindManyOptions<TaskView>;
	}

	/** Whether a view read with the caller's own `select` is a personal view of someone else (re-read when unsure). */
	private async isHiddenFromCaller(view: TaskView | null | undefined): Promise<boolean> {
		if (!view) return false;
		const userId = RequestContext.currentUserId();
		let visibility = view.visibility;
		let createdByUserId = view.createdByUserId;
		if (visibility === undefined || createdByUserId === undefined) {
			const columns = await this.typeOrmRepository.findOne({
				where: { id: view.id } as FindOptionsWhere<TaskView>,
				select: { id: true, visibility: true, createdByUserId: true } as never,
				withDeleted: true
			});
			visibility = columns?.visibility;
			createdByUserId = columns?.createdByUserId;
		}
		return isPersonalOfSomeoneElse({ visibility, createdByUserId }, userId);
	}
}

/** The three ways a view is readable: shared by value, shared by default (no visibility yet), or the caller's own. */
export function visibleAlternatives(base: FindOptionsWhere<TaskView>, userId: ID | null | undefined): FindOptionsWhere<TaskView>[] {
	const alternatives: FindOptionsWhere<TaskView>[] = [
		{ ...base, visibility: Not(TaskViewVisibilityEnum.PERSONAL) } as FindOptionsWhere<TaskView>,
		{ ...base, visibility: IsNull() } as FindOptionsWhere<TaskView>
	];
	if (userId) {
		alternatives.push({ ...base, visibility: TaskViewVisibilityEnum.PERSONAL, createdByUserId: userId } as FindOptionsWhere<TaskView>);
	}
	return alternatives;
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
