import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IContact } from './contact.model';
import { IEmployeeJobsStatistics } from './employee-job.model';
import { IOrganizationDepartment } from './organization-department.model';
import { IOrganizationEmploymentType } from './organization-employment-type.model';
import { CrudActionEnum, IOrganizationFindInput } from './organization.model';
import { IOrganizationPosition } from './organization-positions.model';
import { IOrganizationTeam } from './organization-team.model';
import { IRequestApprovalEmployee } from './request-approval-employee.model';
import { ISkill } from './skill-entity.model';
import { ITag } from './tag.model';
import { IUser, IUserFindInput } from './user.model';
import { IOrganizationContact } from './organization-contact.model';
import { IOrganizationProject } from './organization-projects.model';
import { IEmployeeSetting } from './employee-settings.model';
import { IExpense } from './expense.model';
import { ITimesheet, ITimeSlot } from './timesheet.model';
import { ITask } from './task.model';
import { ICandidate } from './candidate.model';
import { IEmployeeAward } from './employee-award.model';

export interface IRelationalEmployee {
	readonly employee?: IEmployee;
	readonly employeeId?: IEmployee['id'];
}

export interface IEmployee extends IBasePerTenantAndOrganizationEntityModel {
	[x: string]: any;
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
	billRateCurrency?: string;
	minimumBillingRate?: number;
	reWeeklyLimit?: number;
	organizationDepartments?: IOrganizationDepartment[];
	organizationContacts?: IOrganizationContact[];
	projects?: IOrganizationProject[];
	organizationPosition?: IOrganizationPosition;
	tags?: ITag[];
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
	isTrackingEnabled: boolean;
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

export interface IEmployeeFindInput {
	id?: string;
	organization?: IOrganizationFindInput;
	user?: IUserFindInput;
	userId?: IUser['id'];
	valueDate?: Date;
	organizationId?: string;
	tenantId?: string;
	tags?: ITag[];
	skills?: ISkill[];
	profile_link?: string;
	/** Employee status (Online/Offline) */
	isOnline?: boolean;
	/** Employee time tracking status */
	isTrackingTime?: boolean;
	// True mean active, false away
	isAway?: boolean;
}

export interface IEmployeeUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	payPeriod?: string;
	billRateValue?: number;
	minimumBillingRate?: number;
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

export interface IEmployeeCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	user?: IUser;
	userId?: IUser['id'];
	password?: string;
	offerDate?: Date;
	acceptDate?: Date;
	rejectDate?: Date;
	members?: IEmployee[];
	tags?: ITag[];
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

export interface ISelectedEmployee {
	id: string;
	firstName: string;
	lastName: string;
	fullName?: string;
	imageUrl: string;
	shortDescription?: string;
	employeeLevel?: string;
	billRateCurrency?: string;
	billRateValue?: number;
	minimumBillingRate?: number;
	defaultType?: DEFAULT_TYPE;
	tags?: ITag[];
	skills?: ISkill[];
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
export interface IEmployeeLevel extends IBasePerTenantAndOrganizationEntityModel {
	level: string;
	tag?: ITag[];
	skills?: ISkill[];
}

export interface IEmployeeLevelInput extends IBasePerTenantAndOrganizationEntityModel {
	level: string;
	tags?: ITag[];
	skills?: ISkill[];
}

export interface IEmployeeLevelFindInput {
	organizationId?: string;
	tenantId: string;
}
export interface EmployeeViewModel {
	fullName: string;
	email: string;
	bonus?: number;
	endWork?: Date;
	id: string;
	imageUrl?: string;
	averageIncome?: number;
	averageExpenses?: number;
	averageBonus?: number;
	workStatus?: string;
	startedWorkOn?: Date;
	isActive?: boolean;
	isTrackingEnabled: boolean;
	isDeleted?: boolean;
	tags?: ITag[];
}

export interface IEmployeeStoreState {
	employees: IEmployee[];
	action: CrudActionEnum;
}

export interface IEmployeeUpdateProfileStatus extends IBasePerTenantAndOrganizationEntityModel {
	readonly isActive: boolean;
}
