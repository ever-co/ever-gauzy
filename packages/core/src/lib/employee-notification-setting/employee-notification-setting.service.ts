import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { ID, IEmployeeNotificationSettingCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { assertHasOwnEmployee } from '../core/crud/own-employee.helper';
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
	 * The settings are their employee's. A caller who may not act for other employees and has no employee record (a
	 * viewer, a candidate) owns none, so the reads and writes the CRUD base scopes match no row for them, instead of
	 * the tenant-wide scope it keeps by default, through which such a caller read, changed and deleted every
	 * employee's notification settings.
	 */
	protected override findConditionsWithoutOwnEmployee(): FindOptionsWhere<EmployeeNotificationSetting> {
		return this.neverMatchingEmployeeCondition();
	}

	/**
	 * Creates the caller's own employee notification setting record.
	 *
	 * A caller with no employee record who may not act for other employees is refused: the row would have been
	 * filed under whichever employee the body named.
	 *
	 * @param {IEmployeeNotificationSetting} input - The input data for creating a notification setting
	 * @returns {Promise<EmployeeNotificationSetting>} The created notification setting
	 */
	async create(input: IEmployeeNotificationSettingCreateInput): Promise<EmployeeNotificationSetting> {
		assertHasOwnEmployee('Only an employee has notification settings.');
		return await this.createRow(input);
	}

	/**
	 * Stores a notification setting, for the employee named or else the caller's.
	 */
	private async createRow(input: IEmployeeNotificationSettingCreateInput): Promise<EmployeeNotificationSetting> {
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
		return await this.withoutEmployeeFilter(() => this.createRow(input));
	}
}
