import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, IsNull } from 'typeorm';
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
import { assertHasOwnEmployee } from '../core/crud/own-employee.helper';
import { TenantAwareCrudService } from './../core/crud';
import { MultiORMEnum } from '../core/utils';
import { EmployeeSetting } from './employee-setting.entity';
import { applyEmployeeSettingDataOperations } from './employee-setting-data.utils';
import { TypeOrmEmployeeSettingRepository } from './repository/type-orm-employee-setting.repository';
import { MikroOrmEmployeeSettingRepository } from './repository/mikro-orm-employee-setting.repository';

@Injectable()
export class EmployeeSettingService extends TenantAwareCrudService<EmployeeSetting> {
	/**
	 * This process's data patches on the embedded dialect, chained one after the other. TypeORM and MikroORM drive
	 * SQLite through a single connection, where a transaction cannot start while another is open ("cannot start a
	 * transaction within a transaction"), so two concurrent patches would otherwise fail.
	 */
	private static embeddedPatches: Promise<unknown> = Promise.resolve();

	constructor(
		typeOrmEmployeeSettingRepository: TypeOrmEmployeeSettingRepository,
		mikroOrmEmployeeSettingRepository: MikroOrmEmployeeSettingRepository
	) {
		super(typeOrmEmployeeSettingRepository, mikroOrmEmployeeSettingRepository);
	}

	/**
	 * A setting is its employee's. A caller who may not act for other employees and has no employee record (a viewer,
	 * a candidate) owns none, so the reads and writes the CRUD base scopes match no row for them, instead of the
	 * tenant-wide scope it keeps by default, through which such a caller read, changed and deleted every employee's
	 * settings.
	 */
	protected override findConditionsWithoutOwnEmployee(): FindOptionsWhere<EmployeeSetting> {
		return this.neverMatchingEmployeeCondition();
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
		// A caller who has no employee record and may not act for other employees owns no setting. They used to file
		// it under whichever employee the body named, and the de-duplication read below (tenant-wide for them) made
		// that an overwrite of the employee's own row.
		assertHasOwnEmployee('Only an employee has employee settings.');
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
	 * the row is read and written in one transaction. On Postgres and MySQL it holds a row lock, so concurrent
	 * patches apply one after the other, each on top of the last, whichever API process they reach. On the embedded
	 * dialect (a single-process database, e.g. the demo) a process-local queue orders the patches instead (see
	 * `embeddedPatches`); separate processes sharing one SQLite file are not coordinated by it.
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

		await this.runPatch(async () => {
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
		});

		return await this.findOneByIdString(id);
	}

	/**
	 * Runs one patch transaction: right away on Postgres and MySQL (a pooled connection each, with the row lock),
	 * after this process's earlier patches on the embedded dialect (see `embeddedPatches`).
	 *
	 * @param work The patch transaction.
	 * @returns What the transaction answers.
	 */
	private runPatch<T>(work: () => Promise<T>): Promise<T> {
		if (isPostgres() || isMySQL()) {
			return work();
		}
		const run = EmployeeSettingService.embeddedPatches.catch(() => undefined).then(work);
		EmployeeSettingService.embeddedPatches = run.catch(() => undefined);
		return run;
	}

	/**
	 * Refuses a patch of another employee's setting, unless the caller may act for other employees.
	 *
	 * @param setting The setting about to be patched.
	 * @throws ForbiddenException when the caller may not patch it.
	 */
	private assertMayPatch(setting: EmployeeSetting): void {
		// Compared only for a caller with an employee: a setting without one would otherwise match a caller without one
		const employeeId = RequestContext.currentEmployeeId();
		if (employeeId && setting.employeeId === employeeId) {
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
