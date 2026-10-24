import { IBasePerEntityType, IBasePerTenantAndOrganizationEntityModel, JsonData } from './base-entity.model';
import { IEmployee, IEmployeeEntityInput } from './employee.model';

export interface IEmployeeSetting
	extends IBasePerTenantAndOrganizationEntityModel,
		Required<IEmployeeEntityInput>,
		Partial<IBasePerEntityType> {
	settingType?: EmployeeSettingTypeEnum;
	data?: JsonData;
	defaultData?: JsonData;
}

export interface IEmployeeSettingCreateInput extends IEmployeeSetting {}

export interface IEmployeeSettingUpdateInput extends Omit<IEmployeeSettingCreateInput, 'employee' | 'employeeId'> {}

/**
 * What one operation of an employee-setting data patch does.
 */
export enum EmployeeSettingDataOperationEnum {
	/** Writes `value` at `path`, creating the missing objects on the way. */
	SET = 'set',
	/** Removes the key at `path`; a path that is not there is left alone. */
	UNSET = 'unset'
}

/**
 * One change to the `data` of an employee setting.
 *
 * `path` lists the object keys from the root of `data` to the location, e.g. `['sidebar_preferences', 'views',
 * 'is_pinned']`. A key is used as given, so it may contain dots.
 */
export interface IEmployeeSettingDataOperation {
	op: EmployeeSettingDataOperationEnum;
	path: string[];
	/** The value `set` writes; ignored by `unset`. */
	value?: unknown;
}

/**
 * The input of `PATCH /employee-settings/:id/data`: changes applied to the stored `data` in one atomic step, so
 * two clients saving different keys of the same setting at the same time both keep their change.
 */
export interface IEmployeeSettingDataPatchInput extends IBasePerTenantAndOrganizationEntityModel {
	operations: IEmployeeSettingDataOperation[];
}

export interface IEmployeeSettingFindInput extends Partial<IBasePerEntityType> {
	employeeId?: string;
	employee?: IEmployee;
	settingType?: EmployeeSettingTypeEnum;
}

export enum EmployeeSettingTypeEnum {
	NORMAL = 'Normal',
	TASK_VIEWS = 'Task-View',
	CUSTOM = 'Custom'
}
