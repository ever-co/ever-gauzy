import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';

export interface IEmployeeSetting
	extends IBasePerTenantAndOrganizationEntityModel {
	month: number;
	year: number;
	settingType: string;
	value: number;
	currency: string;
	employeeId: string;
	employee: IEmployee;
}

export interface IEmployeeSettingFindInput {
	employeeId?: string;
	employee?: IEmployee;
	month?: number;
	year?: number;
	currency?: string;
}
