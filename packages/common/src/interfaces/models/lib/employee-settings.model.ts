import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IEmployeeSetting
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId: string;
	month: number;
	year: number;
	settingType: string;
	value: number;
	currency: string;
}

export interface IEmployeeSettingFindInput {
	employeeId?: string;
	month?: number;
	year?: number;
	currency?: string;
}
