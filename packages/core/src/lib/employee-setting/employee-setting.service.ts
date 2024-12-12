import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ID, IEmployeeSetting, IEmployeeSettingCreateInput, IEmployeeSettingUpdateInput } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { EmployeeSetting } from './employee-setting.entity';
import { TypeOrmEmployeeSettingRepository } from './repository/type-orm-employee-setting.repository';
import { MikroOrmEmployeeSettingRepository } from './repository/mikro-orm-employee-setting.repository';

@Injectable()
export class EmployeeSettingService extends TenantAwareCrudService<EmployeeSetting> {
	constructor(
		@InjectRepository(EmployeeSetting)
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

			const employeeSetting = await this.findOneByWhereOptions({ entity, entityId, organizationId, tenantId });

			if (employeeSetting) {
				return await super.create({ ...input, id: employeeSetting.id, tenantId });
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
}
