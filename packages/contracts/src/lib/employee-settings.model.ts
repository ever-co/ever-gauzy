import { IBasePerEntityType, IBasePerTenantAndOrganizationEntityModel, JsonData } from './base-entity.model';
import { IEmployee, IEmployeeEntityInput } from './employee.model';

export interface IEmployeeSetting
	extends IBasePerTenantAndOrganizationEntityModel,
		Required<IEmployeeEntityInput>,
		Partial<IBasePerEntityType> {
	month?: number;
	year?: number;
	settingType?: EmployeeSettingTypeEnum;
	value?: number;
	currency?: string;
	data?: JsonData;
	defaultData?: JsonData;
}

export interface IEmployeeSettingCreateInput extends IEmployeeSetting {}

export interface IEmployeeSettingUpdateInput extends Omit<IEmployeeSettingCreateInput, 'employee' | 'employeeId'> {}

export interface IEmployeeSettingFindInput {
	employeeId?: string;
	employee?: IEmployee;
	month?: number;
	year?: number;
	currency?: string;
}

export enum EmployeeSettingTypeEnum {
	NORMAL = 'Normal',
	TASK_VIEWS = 'Task-View',
	CUSTOM = 'Custom'
}
