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
	type: string;
	unit?: string;
	currentValue: number;
	targetValue: number;
	lead?: Employee;
	operator: string;
}

export interface GoalTemplate extends IBaseEntityModel {
	name: string;
	level: string;
	keyResults?: Array<KeyResultTemplate>;
	category?: string;
}

export interface KeyResultTemplate extends IBaseEntityModel {
	name: string;
	type: string;
	unit?: string;
	deadline: string;
	targetValue?: number;
	initialValue?: number;
	hardDeadline?: Date;
	softDeadline?: Date;
	goal: GoalTemplate;
	goalId?: string;
	kpi?: GoalKPITemplate;
	kpiId?: string;
}

export interface GoalKPITemplate extends IBaseEntityModel {
	name: string;
	description: string;
	type: string;
	unit?: string;
	currentValue?: number;
	targetValue?: number;
	lead?: Employee;
	operator: string;
}

export enum TimeFrameStatusEnum {
	ACTIVE = 'Active',
	INACTIVE = 'Inactive'
}

export enum KpiMetricEnum {
	NUMERICAL = 'Numerical',
	PERCENTAGE = 'Percentage',
	CURRENCY = 'Currency'
}

export enum GoalTemplateCategoriesEnum {
	PRODUCT_MANAGEMENT = 'Product Management',
	SALES = 'Sales',
	HR = 'HR',
	MARKETING = 'Marketing'
}

export enum KpiOperatorEnum {
	GREATER_THAN_EQUAL_TO = '>=',
	LESSER_THAN_EQUAL_TO = '<='
}

export interface SettingFindInput extends IBaseEntityModel {
	employee?: EmployeeFindInput;
	organization?: OrganizationFindInput;
}

export interface GoalTimeFrameFindInput extends IBaseEntityModel {
	name?: string;
	organization?: OrganizationFindInput;
}

export enum GoalOwnershipEnum {
	EMPLOYEES = 'Employees',
	TEAMS = 'Teams',
	EMPLOYEES_AND_TEAMS = 'Employees and Teams'
}
