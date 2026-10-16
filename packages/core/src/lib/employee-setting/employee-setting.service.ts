import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { LockMode } from '@mikro-orm/core';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ID,
	IEmployeeSetting,
	IEmployeeSettingCreateInput,
	IEmployeeSettingDataPatchInput,
	IEmployeeSettingUpdateInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { MultiORMEnum } from '../core/utils';
import { EmployeeSetting } from './employee-setting.entity';
import { applyEmployeeSettingDataOperations } from './employee-setting-data.utils';
import { TypeOrmEmployeeSettingRepository } from './repository/type-orm-employee-setting.repository';
import { MikroOrmEmployeeSettingRepository } from './repository/mikro-orm-employee-setting.repository';

@Injectable()
export class EmployeeSettingService extends TenantAwareCrudService<EmployeeSetting> {
	constructor(
		typeOrmEmployeeSettingRepository: TypeOrmEmployeeSettingRepository,
		mikroOrmEmployeeSettingRepository: MikroOrmEmployeeSettingRepository
	) {
		super(typeOrmEmployeeSettingRepository, mikroOrmEmployeeSettingRepository);
	}

	/**
	 * Creates or updates an EmployeeSetting.
	 * If an existing EmployeeSetting is found with matching criteria, it updates the existing record.
	 * Otherwise, it creates a new record.
	 *
	 * @param {IEmployeeSettingCreateInput} input - The input data for creating an EmployeeSetting.
	 * @returns {Promise<IEmployeeSetting>} A promise that resolves to the created or updated EmployeeSetting.
	 * @throws {BadRequestException} If an error occurs during the process.
	 */
	async create(input: IEmployeeSettingCreateInput): Promise<IEmployeeSetting> {
		try {
			const employeeId = RequestContext.currentEmployeeId() || input.employeeId;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			const { entity, entityId, organizationId } = input;

			// Check if a setting already exists for current employee and for the same entity. A setting
			// that is not bound to an entity has entity/entityId NULL — match exactly that (a null used to
			// be dropped from the query, so the de-duplication hit an unrelated setting of the employee
			// and overwrote it).
			try {
				const employeeSetting = await this.findOneByOptions({
					where: {
						entity: entity ?? IsNull(),
						entityId: entityId ?? IsNull(),
						employeeId,
						// null -> IS NULL (an organization-less setting), undefined -> not filtered
						organizationId,
						tenantId
					}
				});

				if (employeeSetting) {
					// If exists, update and return the setting with provided input data
					return await super.create({ ...input, tenantId, id: employeeSetting.id });
				}
			} catch (error) {
				// If NotFoundException, continue with Employee Setting creation
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

			return await super.create({ ...input, employeeId, tenantId });
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Updates an existing EmployeeSetting.
	 *
	 * @param {ID} id - The unique identifier of the EmployeeSetting to update.
	 * @param {IEmployeeSettingUpdateInput} input - The input data containing the updated properties for the EmployeeSetting.
	 * @returns {Promise<IEmployeeSetting>} A promise that resolves to the updated EmployeeSetting.
	 * @throws {BadRequestException} If the EmployeeSetting is not found or the update fails.
	 */
	async update(id: ID, input: IEmployeeSettingUpdateInput): Promise<IEmployeeSetting> {
		try {
			const employeeSetting = await this.findOneByIdString(id);

			if (!employeeSetting) {
				throw new BadRequestException('Employee Setting not found');
			}

			return await super.create({ ...input, id });
		} catch (error) {
			throw new BadRequestException('Employee Setting update failed', error);
		}
	}

	/**
	 * Applies data-patch operations to the setting's `data` in one atomic step.
	 *
	 * `update` replaces `data` with what the client sends, so two clients that each read the setting, change a
	 * different key and write it back lose one change (the second write carries the first one's stale copy). Here
	 * the row is read and written in one transaction, under a row lock on Postgres and MySQL (the embedded
	 * dialect serializes writers, so there the transaction is the lock): concurrent patches apply one after the
	 * other, each on top of the last, whichever API process they reach.
	 *
	 * Only the setting's own employee may patch it, unless the caller may act for other employees.
	 *
	 * @param id The setting to patch.
	 * @param input The operations, applied in order.
	 * @returns The setting with the patched data.
	 * @throws NotFoundException when the setting is not in the caller's tenant.
	 * @throws ForbiddenException when it belongs to another employee and the caller may not act for them.
	 * @throws BadRequestException when an operation is malformed or its path cannot be written.
	 */
	async patchData(id: ID, input: IEmployeeSettingDataPatchInput): Promise<IEmployeeSetting> {
		const tenantId = RequestContext.currentTenantId();
		const where = { id, tenantId } as Record<string, unknown>;
		const rowLock = isPostgres() || isMySQL();

		const apply = (setting: EmployeeSetting | null): EmployeeSetting => {
			if (!setting) {
				throw new NotFoundException('Employee Setting not found');
			}
			this.assertMayPatch(setting);
			const stored = typeof setting.data === 'string' ? safeParse(setting.data) : setting.data;
			setting.data = applyEmployeeSettingDataOperations(stored, input.operations);
			return setting;
		};

		if (this.ormType === MultiORMEnum.MikroORM) {
			await this.mikroOrmRepository.getEntityManager().transactional(async (em) => {
				apply(
					await em.findOne(
						EmployeeSetting,
						where as never,
						rowLock ? { lockMode: LockMode.PESSIMISTIC_WRITE } : {}
					)
				);
				await em.flush();
			});
		} else {
			await this.typeOrmRepository.manager.transaction(async (manager) => {
				const query = manager.createQueryBuilder(EmployeeSetting, 'setting').where(where);
				// `pessimistic_write` maps to FOR UPDATE on both dialects.
				const setting = apply(
					rowLock ? await query.setLock('pessimistic_write').getOne() : await query.getOne()
				);
				// `save` runs the entity subscriber, which serializes `data` on the embedded dialect.
				await manager.save(EmployeeSetting, setting);
			});
		}

		return await this.findOneByIdString(id);
	}

	/**
	 * Refuses a patch of another employee's setting, unless the caller may act for other employees.
	 *
	 * @param setting The setting about to be patched.
	 * @throws ForbiddenException when the caller may not patch it.
	 */
	private assertMayPatch(setting: EmployeeSetting): void {
		if (setting.employeeId === RequestContext.currentEmployeeId()) {
			return;
		}
		if (RequestContext.hasAnyPermission([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE])) {
			return;
		}
		throw new ForbiddenException('You can only change your own employee settings.');
	}
}

/**
 * Parses `data` stored as text (the embedded dialect), treating unreadable text as no data.
 */
function safeParse(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}
