import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization, OrganizationFindInput } from './organization.model';
import { Employee, EmployeeFindInput } from './employee.model';

export interface GoalTimeFrame extends IBaseEntityModel {
	name: string;
	status: string;
	startDate: Date;
	endDate: Date;
	organization: Organization;
}

export interface GoalGeneralSetting extends IBaseEntityModel {
	maxObjectives: number;
	maxKeyResults: number;
	employeeCanCreateObjective: boolean;
	canOwnObjectives: string;
	canOwnKeyResult: string;
	krTypeKPI: boolean;
	krTypeTask: boolean;
}

export interface KPI extends IBaseEntityModel {
	name: string;
	description: string;
	metric: string;
	currentValue: number;
	targetValue: number;
	lead?: Employee;
	operator: string;
}

export enum TimeFrameStatusEnum {
	ACTIVE = 'Active',
	INACTIVE = 'Inactive'
}

export enum KpiMetricEnum {
	NUMBER = 'number',
	PERCENTAGE = 'percentage'
}

export enum KpiOperatorEnum {
	GREATER_THAN_EQUAL_TO = '>=',
	LESSER_THAN_EQUAL_TO = '<='
}

export interface SettingFindInput extends IBaseEntityModel {
	employee?: EmployeeFindInput;
	organization?: OrganizationFindInput;
}

export enum GoalOwnershipEnum {
	EMPLOYEES = 'Employees',
	TEAMS = 'Teams',
	EMPLOYEES_AND_TEAMS = 'Employees and Teams'
}
