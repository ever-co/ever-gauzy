import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IImageAsset as IDocumentAsset } from './image-asset.model';

/**
 * How often leave is accrued under a Time Off policy.
 */
export enum LeaveAccrualFrequencyEnum {
	DAILY = 'DAILY',
	WEEKLY = 'WEEKLY',
	BIWEEKLY = 'BIWEEKLY',
	MONTHLY = 'MONTHLY',
	ANNUALLY = 'ANNUALLY'
}

/**
 * Category of leave a Time Off policy grants, used for grouping and reporting.
 */
export enum LeaveTypeEnum {
	ANNUAL = 'ANNUAL',
	SICK = 'SICK',
	MATERNITY = 'MATERNITY',
	PATERNITY = 'PATERNITY',
	UNPAID = 'UNPAID',
	COMPENSATORY = 'COMPENSATORY',
	BEREAVEMENT = 'BEREAVEMENT',
	STUDY = 'STUDY',
	OTHER = 'OTHER'
}

/**
 * Accrual and entitlement configuration shared by the Time Off policy model and its inputs.
 */
export interface ITimeOffPolicyEntitlement {
	/** Leave category, used for grouping and reporting. */
	leaveType?: LeaveTypeEnum;
	/** Upper bound on the days an employee may take in a year under this policy. */
	maxDaysPerYear?: number;
	/** Whether unused days roll over into the next year. */
	allowCarryForward?: boolean;
	/** Upper bound on the days that may roll over. `0` or unset means no cap. */
	maxCarryForwardDays?: number;
	/** Days accrued per accrual period. */
	accrualRate?: number;
	/** How often `accrualRate` is granted. */
	accrualFrequency?: LeaveAccrualFrequencyEnum;
	/** Whether this is the organization's default policy. */
	isDefault?: boolean;
}

export interface ITimeOffPolicy extends IBasePerTenantAndOrganizationEntityModel, ITimeOffPolicyEntitlement {
	name: string;
	requiresApproval: boolean;
	paid: boolean;
	employees?: IEmployee[];
}

export interface ITimeOffPolicyCreateInput extends IBasePerTenantAndOrganizationEntityModel, ITimeOffPolicyEntitlement {
	employees?: IEmployee[];
	// teams?: OrganizationTeams[];
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
}

export interface ITimeOffPolicyUpdateInput extends IBasePerTenantAndOrganizationEntityModel, ITimeOffPolicyEntitlement {
	employees?: IEmployee[];
	// teams?: OrganizationTeams[];
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
}

export interface ITimeOffPolicyFindInput extends IBasePerTenantAndOrganizationEntityModel {
	employees?: IEmployee[];
	// teams?: OrganizationTeams[];
	name?: string;
	requiresApproval?: boolean;
	paid?: boolean;
	leaveType?: LeaveTypeEnum;
	isDefault?: boolean;
}

export interface ITimeOff extends IBasePerTenantAndOrganizationEntityModel {
	employees?: IEmployee[];
	description?: string;
	policy?: ITimeOffPolicy;
	policyId?: ITimeOffPolicy['id'];
	document?: IDocumentAsset | null;
	documentId?: IDocumentAsset['id'] | null;
	start: Date;
	end: Date;
	requestDate: Date;
	status?: string;
	isHoliday?: boolean;
	documentUrl?: string;
	fullName?: string;
	imageUrl?: string;
}

export interface ITimeOffFindInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	isArchived?: boolean;
	startDate?: Date;
	endDate?: Date;
}

export interface ITimeOffUpdateInput {
	status?: string;
}

export interface ITimeOffCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	employees?: IEmployee[];
	description?: string;
	policy?: ITimeOffPolicy;
	start?: Date;
	end?: Date;
	requestDate?: Date;
	status?: string;
	isHoliday?: boolean;
	documentUrl?: string;
}

export enum StatusTypesEnum {
	REQUESTED = 'REQUESTED',
	APPROVED = 'APPROVED',
	DENIED = 'DENIED',
	ALL = 'ALL'
}

export enum StatusTypesMapRequestApprovalEnum {
	REQUESTED = 1,
	APPROVED = 2,
	DENIED = 3
}

/**
 * A publicly recognized holiday for a country, kept per organization.
 *
 * Issue #314 asks for an `OfficialHolidays` table so the "Add Holidays" dialog can offer a
 * predefined list and pre-fill the From/To dates once a holiday is picked, filtered by the
 * organization's country.
 */
export interface IOfficialHoliday extends IBasePerTenantAndOrganizationEntityModel {
	/** Display name of the holiday, e.g. "Christmas Day". */
	name: string;
	/** ISO 3166-1 alpha-2 country code, e.g. "US", "DE". */
	countryCode: string;
	/** The holiday date, or the first day of a multi-day holiday. */
	date: Date;
	/** Last day of a multi-day holiday. Unset for a single-day holiday. */
	endDate?: Date;
	/** Whether the holiday falls on the same date every year. */
	isRecurring?: boolean;
}

export interface IOfficialHolidayCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	countryCode: string;
	date: Date;
	endDate?: Date;
	isRecurring?: boolean;
}

export interface IOfficialHolidayUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	countryCode?: string;
	date?: Date;
	endDate?: Date;
	isRecurring?: boolean;
}

export interface IOfficialHolidayFindInput extends IBasePerTenantAndOrganizationEntityModel {
	countryCode?: string;
	/** Restrict to holidays that fall in this calendar year. */
	year?: number;
}

/**
 * How many leave days an employee has accrued, taken and carried over under one
 * Time Off policy for one year.
 */
export interface ITimeOffBalance extends IBasePerTenantAndOrganizationEntityModel {
	employee?: IEmployee;
	employeeId: ID;
	policy?: ITimeOffPolicy;
	policyId: ID;
	/** Fiscal/calendar year the balance applies to. */
	year: number;
	/** Days accrued so far this year. */
	accrued: number;
	/** Days taken through approved time off requests. */
	taken: number;
	/** Days carried forward from the previous year. */
	carriedForward: number;
	/** Days already rolled out of this year into the next one. */
	carriedOut: number;
	/** `accrued + carriedForward - taken - carriedOut`, maintained by the server. */
	remaining: number;
}

export interface ITimeOffBalanceFindInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: ID;
	policyId?: ID;
	year?: number;
}

/**
 * Input used to set the accrued days of one employee/policy/year balance.
 */
export interface ITimeOffBalanceAllocateInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId: ID;
	policyId: ID;
	year: number;
	/** Days accrued for the period. Replaces the current `accrued` value. */
	accrued: number;
}

/**
 * Input used to roll unused days of one policy from one year into the next.
 */
export interface ITimeOffBalanceCarryForwardInput extends IBasePerTenantAndOrganizationEntityModel {
	policyId: ID;
	fromYear: number;
	toYear: number;
	/**
	 * Cap on the days rolled over. Omitted falls back to the policy's own `maxCarryForwardDays`;
	 * `0` means no cap.
	 */
	maxCarryForwardDays?: number;
}

/**
 * Input used to spend days from, or give days back to, one employee/policy/year balance.
 */
export interface ITimeOffBalanceAdjustInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId: ID;
	policyId: ID;
	year: number;
	/** How many days to move. Always positive; the endpoint decides the direction. */
	days: number;
}
