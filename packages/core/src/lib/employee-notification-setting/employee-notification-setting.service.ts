import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ID, IEmployeeNotificationSettingCreateInput } from '@gauzy/contracts';
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
			const user = RequestContext.currentUser();
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			const employeeId = input.employeeId ?? user?.employeeId;

			return super.create({ ...input, employeeId, tenantId });
		} catch (error) {
			throw new HttpException(
				`Failed to create the notification setting: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}

	/**
	 * The settings of the given employee, whoever the caller is.
	 *
	 * The plain reads limit a caller without CHANGE_SELECTED_EMPLOYEE to their own employee (the filter is
	 * merged over the given `employeeId`), so a notification sent by an employee or a manager was checked
	 * against the SENDER's settings. Callers resolve the employee themselves (the notification receiver).
	 */
	async findByEmployee(where: {
		employeeId: ID;
		organizationId?: ID;
		tenantId?: ID;
	}): Promise<EmployeeNotificationSetting> {
		return await this.withoutEmployeeFilter(() => this.findOneByWhereOptions(where));
	}

	/**
	 * Creates the settings of the given employee, whoever the caller is (see {@link findByEmployee}: the
	 * plain create would have stored the row for the caller instead).
	 */
	async createForEmployee(
		input: IEmployeeNotificationSettingCreateInput & { employeeId: ID }
	): Promise<EmployeeNotificationSetting> {
		return await this.withoutEmployeeFilter(() => this.create(input));
	}
}
