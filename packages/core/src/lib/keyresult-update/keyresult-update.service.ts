import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, SaveOptions } from 'typeorm';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { IFindOneOptions, IPartialEntity } from '../core/crud/icrud.service';
import { LegacyFindOneOptions, MultiORMEnum } from './../core/utils';
import {
	assertCallerIsAuthorOrTenantAdmin,
	isCallerAuthor,
	isCallerTenantAdmin,
	withoutAuthorChange
} from '../shared/ownership';
import { GoalService } from '../goal/goal.service';
import { KeyResult } from '../keyresult/keyresult.entity';
import { KeyResultService } from '../keyresult/keyresult.service';
import { TypeOrmKeyResultUpdateRepository } from './repository/type-orm-keyresult-update.repository';
import { MikroOrmKeyResultUpdateRepository } from './repository/mikro-orm-keyresult-update.repository';
import { KeyResultUpdate } from './keyresult-update.entity';
import { goalProgress, keyResultProgress } from './keyresult-progress';

@Injectable()
export class KeyResultUpdateService extends TenantAwareCrudService<KeyResultUpdate> {
	constructor(
		typeOrmKeyResultUpdateRepository: TypeOrmKeyResultUpdateRepository,
		mikroOrmKeyResultUpdateRepository: MikroOrmKeyResultUpdateRepository,
		private readonly keyResultService: KeyResultService,
		private readonly goalService: GoalService
	) {
		super(typeOrmKeyResultUpdateRepository, mikroOrmKeyResultUpdateRepository);
	}

	/**
	 * The progress updates of one key result, in the caller's tenant.
	 *
	 * The repositories are read directly, so the tenant condition is stated here: filtering on the key result alone
	 * answered the updates of another tenant's key result to anyone who named it. Without a tenant in the request
	 * nothing is answered.
	 *
	 * @param keyResultId - The key result.
	 * @returns Its updates in the caller's tenant; none for a key result of another tenant.
	 */
	async findByKeyResultId(keyResultId: ID): Promise<KeyResultUpdate[]> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId || !keyResultId) {
			return [];
		}

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const items = await this.mikroOrmRepository.find({ keyResultId, tenantId } as any);
				return items.map((e) => this.serialize(e)) as KeyResultUpdate[];
			}
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmRepository
					.createQueryBuilder('key_result_update')
					.where('key_result_update.keyResultId = :keyResultId', {
						keyResultId
					})
					.andWhere('key_result_update.tenantId = :tenantId', { tenantId })
					.getMany();
		}
	}

	/**
	 * Files a progress update (`POST /key-result-updates`, `createKeyResultUpdate`), or changes one when the payload
	 * names it (`PUT /key-result-updates/:id` and `updateKeyResultUpdate` both write through here, because `save()`
	 * is what keeps the relations).
	 *
	 * A new update is the caller's: its author (`createdByUserId`) is stamped from the request, and filing it moves the
	 * key result and the goal it reports on ({@link fileProgressUpdate}). An existing one is changed only by its author
	 * or a tenant administrator ({@link assertCallerMayChange}) — before this, any member of the tenant could overwrite
	 * another member's update by naming its id — and the patch cannot say someone else wrote it. Changing a filed
	 * update corrects the history row only; the goals page never does it. An id that names no update of the caller's
	 * tenant is a 404 rather than a new row under that id.
	 *
	 * @param entity - The update to file, or the id and the columns to change.
	 * @returns The saved update.
	 */
	public async create(entity: IPartialEntity<KeyResultUpdate>): Promise<KeyResultUpdate> {
		if (entity?.id) {
			// Read for everyone, tenant administrators included: an id that names nothing is a 404
			const update = await this.findOneByIdString(entity.id);
			assertCallerIsAuthorOrTenantAdmin({ userId: update.createdByUserId }, 'a key result update');

			return super.create(withoutAuthorChange(entity));
		}

		return this.fileProgressUpdate(entity);
	}

	/**
	 * Files a progress update and applies it (owner decision 2(a), 2026-10-23): the key result it names moves to the
	 * reported value, its progress and its status, and the goal the key result belongs to moves to the weighted
	 * progress of its key results.
	 *
	 * The goals page used to compute both and write them back itself with `PUT /key-results/:id` and `PUT /goals/:id`.
	 * Those routes need `GOALS_EDIT` (ever-co/ever-gauzy#11323), so an employee's report half-failed: the history row
	 * was filed and the key result and goal stayed where they were. Applying the report here keeps it whole without
	 * `GOALS_EDIT`, and the progress is computed on the server ({@link keyResultProgress}, {@link goalProgress})
	 * rather than taken from the request, so a report cannot set a percentage its value does not reach.
	 *
	 * Because a report now moves the key result, filing one is limited to the people the page offers it to
	 * ({@link assertCallerMayReportProgress}). The key result, its goal and the goal's other key results are read
	 * first, in the caller's tenant and organization boundary — one the caller cannot reach is a 404 — so a refused
	 * or impossible report writes nothing. The key result is written first, then its goal, then the history row:
	 * a retry after a failure applies the same values again and files the row once.
	 *
	 * @param entity - The update to file.
	 * @returns The filed update.
	 */
	private async fileProgressUpdate(entity: IPartialEntity<KeyResultUpdate>): Promise<KeyResultUpdate> {
		const report = (entity ?? {}) as Partial<KeyResultUpdate>;
		const keyResultId = report.keyResultId ?? report.keyResult?.id;
		if (!keyResultId) {
			throw new BadRequestException('A progress update names the key result it reports on');
		}

		const keyResult = await this.keyResultService.findOneByIdString(keyResultId, { relations: { kpi: true } });
		this.assertCallerMayReportProgress(keyResult);

		const { update, progress } = keyResultProgress(keyResult, report.update);
		const status = report.status ?? keyResult.status;
		const goal = keyResult.goalId ? await this.goalProgressAfter(keyResult, progress) : null;

		await this.keyResultService.create({ id: keyResult.id, update, progress, status });
		if (goal) {
			await this.goalService.create({ id: goal.id, progress: goal.progress });
		}

		return super.create({
			update,
			progress,
			status,
			owner: keyResult.ownerId ?? report.owner,
			keyResultId: keyResult.id,
			organizationId: keyResult.organizationId ?? report.organizationId
		});
	}

	/**
	 * The progress the goal of a key result stands at once the key result has moved: the weighted progress of every
	 * key result of the goal, the moved one at its new progress.
	 *
	 * @param keyResult - The key result a report moves.
	 * @param progress - The progress it moves to.
	 * @returns The goal and its new progress.
	 */
	private async goalProgressAfter(keyResult: KeyResult, progress: number): Promise<{ id: ID; progress: number }> {
		// The goal's own read, so a goal the caller cannot reach is a 404 before anything is written
		const goal = await this.goalService.findOneByIdString(keyResult.goalId);
		const keyResults = await this.keyResultService.find({
			where: { goalId: goal.id } as FindOptionsWhere<KeyResult>
		});

		const moved = { id: keyResult.id, progress, weight: keyResult.weight };
		const current = keyResults.some((row) => row.id === keyResult.id)
			? keyResults.map((row) => (row.id === keyResult.id ? { ...row, progress } : row))
			: [...keyResults, moved];

		return { id: goal.id, progress: goalProgress(current) };
	}

	/**
	 * Who may report a key result's progress, now that a report moves the key result and its goal: the employee who
	 * owns the key result or leads it — the people the goals page offers the Update button to — a `GOALS_EDIT`
	 * holder, who may set the key result through `PUT /key-results/:id` anyway, or a tenant administrator. Anyone
	 * else in the tenant could file a report on any key result before, but it moved nothing; it is refused now
	 * rather than moving someone else's key result.
	 *
	 * @param keyResult - The key result the report names.
	 * @throws ForbiddenException when the caller may not report on it.
	 */
	private assertCallerMayReportProgress(keyResult: KeyResult): void {
		if (isCallerTenantAdmin() || RequestContext.hasPermission(PermissionsEnum.GOALS_EDIT)) {
			return;
		}

		const employeeId = RequestContext.currentUser()?.employeeId;
		if (employeeId && (employeeId === keyResult.ownerId || employeeId === keyResult.leadId)) {
			return;
		}

		throw new ForbiddenException(
			'Only the owner or lead of a key result, a GOALS_EDIT holder or a tenant admin may report its progress'
		);
	}

	/**
	 * Removes a progress update (`DELETE /key-result-updates/:id`, `deleteKeyResultUpdate`), if the caller wrote it
	 * or administers the tenant. A call with object criteria is a service-level call and keeps the base behaviour.
	 *
	 * @param criteria - The update's id, or criteria.
	 * @param options - Additional where conditions, passed to the base method unchanged.
	 * @returns The delete result.
	 */
	public async delete(
		criteria: string | FindOptionsWhere<KeyResultUpdate>,
		options?: LegacyFindOneOptions<KeyResultUpdate>
	): Promise<DeleteResult> {
		if (typeof criteria === 'string') {
			await this.assertCallerMayChange(criteria, true);
		}

		return super.delete(criteria, options);
	}

	/**
	 * Withdraws a progress update (`DELETE /key-result-updates/:id/soft`, `softDeleteKeyResultUpdate`), if the
	 * caller wrote it or administers the tenant.
	 *
	 * @param id - The update to withdraw.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The withdrawn update.
	 */
	public async softRemove(
		id: ID,
		options?: IFindOneOptions<KeyResultUpdate>,
		saveOptions?: SaveOptions
	): Promise<KeyResultUpdate> {
		await this.assertCallerMayChange(id, false);

		return super.softRemove(id, options, saveOptions);
	}

	/**
	 * Restores a withdrawn progress update (`PUT /key-result-updates/:id/recover`, `recoverKeyResultUpdate`), if the
	 * caller wrote it or administers the tenant.
	 *
	 * @param id - The update to restore.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The restored update.
	 */
	public async softRecover(
		id: ID,
		options?: IFindOneOptions<KeyResultUpdate>,
		saveOptions?: SaveOptions
	): Promise<KeyResultUpdate> {
		await this.assertCallerMayChange(id, true);

		return super.softRecover(id, options, saveOptions);
	}

	/**
	 * Removes the progress updates of one key result (`DELETE /key-result-updates/deleteBulkByKeyResultId`,
	 * `deleteKeyResultUpdates`): the caller's own, or — for a tenant administrator — all of them.
	 *
	 * The updates are read in the caller's tenant, and a member who is not a tenant administrator removes only the
	 * ones they wrote; another member's updates stay. Before this, any member of the tenant removed every update of
	 * any key result of it.
	 *
	 * @param keyResultId - The key result whose updates to remove.
	 * @returns The delete result.
	 */
	public async deleteByKeyResultId(keyResultId: ID): Promise<DeleteResult> {
		const updates = await this.find({ where: { keyResultId } as FindOptionsWhere<KeyResultUpdate> });
		const removable = isCallerTenantAdmin()
			? updates
			: updates.filter((update) => isCallerAuthor({ userId: update.createdByUserId }));

		return this.deleteMany(removable.map((update) => update.id));
	}

	/**
	 * Who may change a progress update: the one who wrote it (`createdByUserId` — not `owner`, which names the
	 * employee who owns the key result, whoever filed the update), or a tenant administrator (owner decision 2,
	 * 2026-10-22). The update routes state no permission, so before this any member of the tenant could rewrite,
	 * withdraw, restore or remove another member's update.
	 *
	 * The read is the tenant-scoped one, so an update of another tenant, or one that is not there, is a 404.
	 *
	 * @param id - The update's id.
	 * @param withDeleted - Whether a withdrawn update counts (a recovery, and a removal, act on one).
	 * @throws ForbiddenException when the caller neither wrote it nor administers the tenant.
	 */
	private async assertCallerMayChange(id: ID, withDeleted: boolean): Promise<void> {
		if (isCallerTenantAdmin()) {
			return;
		}

		const update = await this.findOneByIdString(id, withDeleted ? { withDeleted: true } : undefined);
		assertCallerIsAuthorOrTenantAdmin({ userId: update.createdByUserId }, 'a key result update');
	}
}
