import {
	IUser,
	ITag,
	ISkill,
	IOrganizationDepartment,
	IOrganizationPosition
} from '..';
import { IOrganization, IOrganizationFindInput } from './organization.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IUserFindInput } from './user.model';
import { IOrganizationTeam } from './organization-team-model';
import { IContact } from './contact.model';
import { IOrganizationEmploymentType } from './organization-employment-type.model';
import { IRequestApprovalEmployee } from './request-approval-employee.model';

export interface IEmployee extends IBasePerTenantAndOrganizationEntityModel {
	[x: string]: any;
	endWork?: any;
	startedWorkOn?: any;
	user: IUser;
	userId: string;
	valueDate?: Date;
	isActive: boolean;
	short_description?: string;
	description?: string;
	teams?: IOrganizationTeam[];
	payPeriod?: string;
	billRateValue?: number;
	billRateCurrency?: string;
	reWeeklyLimit?: number;
	organizationDepartments?: IOrganizationDepartment[];
	organizationPosition?: IOrganizationPosition;
	tags: ITag[];
	skills: ISkill[];
	offerDate?: Date;
	acceptDate?: Date;
	rejectDate?: Date;
	employeeLevel?: string;
	anonymousBonus?: boolean;
	organizationEmploymentTypes?: IOrganizationEmploymentType[];
	requestApprovalEmployee?: IRequestApprovalEmployee[];
	contact: IContact;
	averageIncome?: number;
	totalWorkHours?: number;
	averageExpenses?: number;
	averageBonus?: number;
	show_anonymous_bonus?: boolean;
	show_average_bonus?: boolean;
	show_average_expenses?: boolean;
	show_average_income?: boolean;
	show_billrate?: boolean;
	show_payperiod?: boolean;
}

export interface IEmployeeFindInput {
	id?: string;
	organization?: IOrganizationFindInput;
	user?: IUserFindInput;
	valueDate?: Date;
	organizationId?: string;
	tenantId?: string;
	tags?: ITag[];
	skills?: ISkill[];
}

export interface IEmployeeUpdateInput {
	payPeriod?: string;
	billRateValue?: number;
	billRateCurrency?: string;
	reWeeklyLimit?: number;
	organizationDepartment?: IOrganizationDepartment;
	organizationPosition?: IOrganizationPosition;
	offerDate?: Date;
	acceptDate?: Date;
	rejectDate?: Date;
	short_description?: string;
	description?: string;
	averageIncome?: number;
	averageExpenses?: number;
	averageBonus?: number;
	skills?: ISkill[];
}

export interface IEmployeeCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	user: IUser;
	password?: string;
	offerDate?: Date;
	acceptDate?: Date;
	rejectDate?: Date;
	members?: IEmployee[];
	tags?: ITag[];
	skills?: ISkill[];
	startedWorkOn?: any;
	short_description?: string;
	description?: string;
	originalUrl?: string;
	isActive?: boolean;
}

export enum PayPeriodEnum {
	NONE = 'NONE',
	BI_WEEKLY = 'BI_WEEKLY',
	WEEKLY = 'WEEKLY',
	TWICE_PER_MONTH = 'TWICE_PER_MONTH',
	MONTHLY = 'MONTHLY'
}
export interface IEmployeeLevel {
	id: string;
	level: string;
	organizationId: string;
	tag?: ITag[];
	skills?: ISkill[];
}

export interface IEmployeeLevelInput {
	id?: string;
	level: string;
	organizationId: string;
	tags?: ITag[];
	skills?: ISkill[];
}

export interface IEmployeeLevelFindInput {
	organizationId?: string;
	tenantId: string;
}
