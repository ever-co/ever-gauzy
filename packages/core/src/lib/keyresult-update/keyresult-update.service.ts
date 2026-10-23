import { Injectable } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, SaveOptions } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IFindOneOptions, IPartialEntity } from '../core/crud/icrud.service';
import { LegacyFindOneOptions, MultiORMEnum } from './../core/utils';
import {
	assertCallerIsAuthorOrTenantAdmin,
	isCallerAuthor,
	isCallerTenantAdmin,
	withoutAuthorChange
} from '../shared/ownership';
import { TypeOrmKeyResultUpdateRepository } from './repository/type-orm-keyresult-update.repository';
import { MikroOrmKeyResultUpdateRepository } from './repository/mikro-orm-keyresult-update.repository';
import { KeyResultUpdate } from './keyresult-update.entity';

@Injectable()
export class KeyResultUpdateService extends TenantAwareCrudService<KeyResultUpdate> {
	constructor(
		typeOrmKeyResultUpdateRepository: TypeOrmKeyResultUpdateRepository,
		mikroOrmKeyResultUpdateRepository: MikroOrmKeyResultUpdateRepository
	) {
		super(typeOrmKeyResultUpdateRepository, mikroOrmKeyResultUpdateRepository);
	}

	/**
	 *
	 * @param keyResultId
	 * @returns
	 */
	async findByKeyResultId(keyResultId: ID): Promise<KeyResultUpdate[]> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const items = await this.mikroOrmRepository.find({ keyResultId } as any);
				return items.map((e) => this.serialize(e)) as KeyResultUpdate[];
			}
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmRepository
					.createQueryBuilder('key_result_update')
					.where('key_result_update.keyResultId = :keyResultId', {
						keyResultId
					})
					.getMany();
		}
	}

	/**
	 * Files a progress update (`POST /key-result-updates`, `createKeyResultUpdate`), or changes one when the payload
	 * names it (`PUT /key-result-updates/:id` and `updateKeyResultUpdate` both write through here, because `save()`
	 * is what keeps the relations).
	 *
	 * A new update is the caller's: its author (`createdByUserId`) is stamped from the request. An existing one is
	 * changed only by its author or a tenant administrator ({@link assertCallerMayChange}) — before this, any member
	 * of the tenant could overwrite another member's update by naming its id — and the patch cannot say someone else
	 * wrote it. An id that names no update of the caller's tenant is a 404 rather than a new row under that id.
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

		return super.create(entity);
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
