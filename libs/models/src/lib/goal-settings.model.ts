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

export interface KPI extends IBaseEntityModel {
	name: string;
	description: string;
	metric: string;
	currentValue: number;
	targetValue: number;
	lead: Employee;
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

export interface KpiFindInput extends IBaseEntityModel {
	employee?: EmployeeFindInput;
	organization?: OrganizationFindInput;
}
