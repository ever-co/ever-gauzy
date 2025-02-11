import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { IEmployeeNotificationSettingCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { EmployeeNotificationSetting } from './employee-notification-setting.entity';
import { TypeOrmEmployeeNotificationSettingRepository } from './repository/type-orm-employee-notification-setting.repository';
import { MikroOrmEmployeeNotificationSettingRepository } from './repository/mikro-orm-employee-notification-setting.repository';

@Injectable()
export class EmployeeNotificationSettingService extends TenantAwareCrudService<EmployeeNotificationSetting> {
	constructor(
		readonly typeOrmEmployeeNotificationSettingRepository: TypeOrmEmployeeNotificationSettingRepository,
		readonly mikroOrmEmployeeNotificationSettingRepository: MikroOrmEmployeeNotificationSettingRepository
	) {
		super(typeOrmEmployeeNotificationSettingRepository, mikroOrmEmployeeNotificationSettingRepository);
	}

	/**
	 * Creates an employee notification setting record
	 *
	 * @param {IEmployeeNotificationSetting} input - The input data for creating a notification setting
	 * @returns {Promise<EmployeeNotificationSetting>} The created notification setting
	 */
	async create(input: IEmployeeNotificationSettingCreateInput): Promise<EmployeeNotificationSetting> {
		try {
			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const employeeId = input.employeeId || RequestContext.currentEmployeeId();

			return super.create({ ...input, employeeId, tenantId });
		} catch (error) {
			throw new HttpException(
				`Failed to create the notification setting: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}
}
