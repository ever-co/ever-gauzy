import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationFindInput } from './organization.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';

export interface IGoalTimeFrame
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	status: string;
	startDate: Date;
	endDate: Date;
}

export interface IGoalGeneralSetting
	extends IBasePerTenantAndOrganizationEntityModel {
	maxObjectives: number;
	maxKeyResults: number;
	employeeCanCreateObjective: boolean;
	canOwnObjectives: string;
	canOwnKeyResult: string;
	krTypeKPI: boolean;
	krTypeTask: boolean;
}

export interface IKPI extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description: string;
	type: string;
	unit?: string;
	currentValue: number;
	targetValue: number;
	lead?: IEmployee;
	operator: string;
}

export interface IGoalTemplate
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	level: string;
	keyResults?: Array<IKeyResultTemplate>;
	category?: string;
}

export interface IGoalTemplateFind
	extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
}

export interface IKeyResultTemplate
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	type: string;
	unit?: string;
	deadline: string;
	targetValue?: number;
	initialValue?: number;
	hardDeadline?: Date;
	softDeadline?: Date;
	goal: IGoalTemplate;
	goalId?: string;
	kpi?: IGoalKPITemplate;
	kpiId?: string;
}

export interface IGoalKPITemplate
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description: string;
	type: string;
	unit?: string;
	currentValue?: number;
	targetValue?: number;
	lead?: IEmployee;
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

export interface ISettingFindInput {
	id?: string;
	employee?: IEmployeeFindInput;
	organization?: IOrganizationFindInput;
	tenantId?: string;
}

export interface IGoalTimeFrameFindInput {
	name?: string;
	organization?: IOrganizationFindInput;
}

export enum GoalOwnershipEnum {
	EMPLOYEES = 'Employees',
	TEAMS = 'Teams',
	EMPLOYEES_AND_TEAMS = 'Employees and Teams'
}

export interface IGoalTimeFrameResponse {
	items: IGoalTimeFrame[];
	count: number;
}

export interface IKpiResponse {
	items: IKPI[];
	count: number;
}

export interface IGeneralSettingResponse {
	items: IGoalGeneralSetting[];
	count: number;
}
