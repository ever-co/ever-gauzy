import {
	IBasePerTenantAndOrganizationEntityModel,
	IBasePerTenantAndOrganizationEntityMutationInput,
	ID
} from './base-entity.model';
import { IContact } from './contact.model';
import { IEmployeeJobsStatistics } from './employee-job.model';
import { IOrganizationDepartment } from './organization-department.model';
import { IOrganizationEmploymentType } from './organization-employment-type.model';
import { CrudActionEnum, TimeFormatEnum } from './organization.model';
import { IOrganizationPosition } from './organization-positions.model';
import { IOrganizationTeam } from './organization-team.model';
import { IRequestApprovalEmployee } from './request-approval-employee.model';
import { ISkill } from './skill-entity.model';
import { ITaggable } from './tag.model';
import { IUser } from './user.model';
import { IOrganizationContact } from './organization-contact.model';
import { IOrganizationProject } from './organization-projects.model';
import { IEmployeeSetting } from './employee-settings.model';
import { IExpense } from './expense.model';
import { ITimesheet, ITimeSlot } from './timesheet.model';
import { ITask } from './task.model';
import { ICandidate } from './candidate.model';
import { IEmployeeAward } from './employee-award.model';
import { IOrganizationProjectModule } from './organization-project-module.model';
import { CurrenciesEnum } from './currency.model';

export interface IFindMembersInput extends IBasePerTenantAndOrganizationEntityModel {
	organizationTeamId: ID;
	organizationProjectId: ID;
}

export interface IEmployeeEntityMutationInput {
	employeeId?: ID;
	employee?: Pick<IEmployee, 'id'>;
}

export interface IRelationalEmployee {
	readonly employee?: IEmployee;
	readonly employeeId?: ID;
}

export interface IEmployee extends IBasePerTenantAndOrganizationEntityModel, ITaggable {
	endWork?: Date;
	startedWorkOn?: Date;
	user: IUser;
	userId: string;
	valueDate?: Date;
	short_description?: string;
	description?: string;
	teams?: IOrganizationTeam[];
	payPeriod?: string;
	billRateValue?: number;
	billRateCurrency?: CurrenciesEnum;
	minimumBillingRate?: number;
	reWeeklyLimit?: number;
	organizationDepartments?: IOrganizationDepartment[];
	organizationContacts?: IOrganizationContact[];
	projects?: IOrganizationProject[];
	organizationPosition?: IOrganizationPosition;
	skills?: ISkill[];
	awards?: IEmployeeAward[];
	offerDate?: Date;
	acceptDate?: Date;
	rejectDate?: Date;
	employeeLevel?: string;
	anonymousBonus?: boolean;
	organizationEmploymentTypes?: IOrganizationEmploymentType[];
	requestApprovalEmployee?: IRequestApprovalEmployee[];
	settings?: IEmployeeSetting[];
	expenses?: IExpense[];
	timesheets?: ITimesheet[];
	tasks?: ITask[];
	modules?: IOrganizationProjectModule[];
	timeSlots?: ITimeSlot[];
	contact?: IContact;
	candidate?: ICandidate;
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
	show_start_work_on?: boolean;
	isJobSearchActive?: boolean;
	linkedInUrl?: string;
	facebookUrl?: string;
	instagramUrl?: string;
	twitterUrl?: string;
	githubUrl?: string;
	gitlabUrl?: string;
	upworkUrl?: string;
	stackoverflowUrl?: string;
	jobSuccess?: number;
	isVerified?: boolean;
	isVetted?: boolean;
	totalJobs?: number;
	fullName?: string;
	profile_link?: string;
	isTrackingEnabled?: boolean;
	isDeleted?: boolean;
	allowScreenshotCapture?: boolean;
	/** Upwork ID For Gauzy AI*/
	upworkId?: string;
	/** LinkedIn ID For Gauzy AI*/
	linkedInId?: string;
	/** Employee status (Online/Offline) */
	isOnline?: boolean;
	/** Employee time tracking status */
	isTrackingTime?: boolean;
	// True mean active, false away
	isAway?: boolean;
}

export type IEmployeeJobsStatisticsResponse = IEmployee & IEmployeeJobsStatistics;

export interface UpdateEmployeeJobsStatistics extends IBasePerTenantAndOrganizationEntityModel {
	isJobSearchActive?: boolean;
}

export interface IEmployeeFindInput extends IBasePerTenantAndOrganizationEntityMutationInput {
	userId?: ID;
	valueDate?: Date;
	profile_link?: string;
	isOnline?: boolean; // Employee status (Online/Offline)
	isTrackingTime?: boolean; // Employee time tracking status
	isAway?: boolean; // True mean active, false away
}

export interface IEmployeeUpdateInput extends IBasePerTenantAndOrganizationEntityModel, ITaggable {
	payPeriod?: string;
	billRateValue?: number;
	minimumBillingRate?: number;
	billRateCurrency?: CurrenciesEnum;
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
	isJobSearchActive?: boolean;
	contact?: IContact;
	linkedInUrl?: string;
	facebookUrl?: string;
	instagramUrl?: string;
	twitterUrl?: string;
	githubUrl?: string;
	gitlabUrl?: string;
	upworkUrl?: string;
	profile_link?: string;
	allowScreenshotCapture?: boolean;
	/** Upwork ID For Gauzy AI*/
	upworkId?: string;
	/** LinkedIn ID For Gauzy AI*/
	linkedInId?: string;
	/** Employee status (Online/Offline) */
	isOnline?: boolean;
	/** Employee time tracking status */
	isTrackingTime?: boolean;
	// True mean active, false away
	isAway?: boolean;
}

export interface IEmployeeCreateInput extends IBasePerTenantAndOrganizationEntityMutationInput, ITaggable {
	user?: IUser;
	userId?: IUser['id'];
	password?: string;
	offerDate?: Date;
	acceptDate?: Date;
	rejectDate?: Date;
	members?: IEmployee[];
	skills?: ISkill[];
	startedWorkOn?: Date;
	short_description?: string;
	description?: string;
	originalUrl?: string;
	isActive?: boolean;
	/** Upwork ID For Gauzy AI*/
	upworkId?: string;
	/** LinkedIn ID For Gauzy AI*/
	linkedInId?: string;
	/** Employee status (Online/Offline) */
	isOnline?: boolean;
	/** Employee time tracking status */
	isTrackingTime?: boolean;
	// True mean active, false away
	isAway?: boolean;
}

export interface ISelectedEmployee extends IBasePerTenantAndOrganizationEntityModel, ITaggable {
	firstName: string;
	lastName: string;
	fullName?: string;
	imageUrl: string;
	shortDescription?: string;
	employeeLevel?: string;
	billRateCurrency?: CurrenciesEnum;
	billRateValue?: number;
	minimumBillingRate?: number;
	defaultType?: DEFAULT_TYPE;
	skills?: ISkill[];
	timeZone?: string;
	timeFormat?: TimeFormatEnum;
}

export enum DEFAULT_TYPE {
	ALL_EMPLOYEE = 'ALL_EMPLOYEE',
	NO_EMPLOYEE = 'NO_EMPLOYEE'
}

export enum PayPeriodEnum {
	NONE = 'NONE',
	BI_WEEKLY = 'BI_WEEKLY',
	WEEKLY = 'WEEKLY',
	TWICE_PER_MONTH = 'TWICE_PER_MONTH',
	MONTHLY = 'MONTHLY'
}

export interface IEmployeeLevel extends IBasePerTenantAndOrganizationEntityModel, ITaggable {
	level: string;
	skills?: ISkill[];
}

export interface IEmployeeLevelInput extends IEmployeeLevel {}

export interface IEmployeeLevelFindInput {
	organizationId?: string;
	tenantId: string;
}

export interface EmployeeViewModel extends IBasePerTenantAndOrganizationEntityModel, ITaggable {
	fullName: string;
	email: string;
	bonus?: number;
	endWork?: Date;
	imageUrl?: string;
	averageIncome?: number;
	averageExpenses?: number;
	averageBonus?: number;
	workStatus?: string;
	startedWorkOn?: Date;
	isTrackingEnabled?: boolean;
	isDeleted?: boolean;
}

export interface IEmployeeStoreState {
	employees: IEmployee[];
	action: CrudActionEnum;
}

export interface IEmployeeUpdateProfileStatus extends IBasePerTenantAndOrganizationEntityModel {
	readonly isActive: boolean;
}
