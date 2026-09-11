import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IImageAsset as IDocumentAsset } from './image-asset.model';
import { IOrganizationTeam } from './organization-team.model';

// ─── Enums ───────────────────────────────────────────────────────────────────

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

/** Leave accrual frequency options */
export enum LeaveAccrualFrequencyEnum {
		DAILY = 'DAILY',
		WEEKLY = 'WEEKLY',
		BIWEEKLY = 'BIWEEKLY',
		MONTHLY = 'MONTHLY',
		ANNUALLY = 'ANNUALLY'
}

/** Category of leave for reporting purposes */
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

// ─── Time-Off Policy ──────────────────────────────────────────────────────────

export interface ITimeOffPolicy extends IBasePerTenantAndOrganizationEntityModel {
		name: string;
		requiresApproval: boolean;
		paid: boolean;
		employees?: IEmployee[];
		/** Teams covered by this policy (future: team-based policies) */
	teams?: IOrganizationTeam[];
		/** Optional leave type category for analytics */
	leaveType?: LeaveTypeEnum;
		/** Max days allowed per year under this policy */
	maxDaysPerYear?: number;
		/** Whether unused days carry forward to next year */
	allowCarryForward?: boolean;
		/** Max days that can be carried forward */
	maxCarryForwardDays?: number;
		/** Accrual configuration: days accrued per period */
	accrualRate?: number;
		/** Accrual frequency */
	accrualFrequency?: LeaveAccrualFrequencyEnum;
		/** Whether this is the default policy */
	isDefault?: boolean;
}

export interface ITimeOffPolicyCreateInput
		extends IBasePerTenantAndOrganizationEntityModel {
				employees?: IEmployee[];
				teams?: IOrganizationTeam[];
				name?: string;
				requiresApproval?: boolean;
				paid?: boolean;
				leaveType?: LeaveTypeEnum;
				maxDaysPerYear?: number;
				allowCarryForward?: boolean;
				maxCarryForwardDays?: number;
				accrualRate?: number;
				accrualFrequency?: LeaveAccrualFrequencyEnum;
				isDefault?: boolean;
		}

export interface ITimeOffPolicyUpdateInput
		extends IBasePerTenantAndOrganizationEntityModel {
				employees?: IEmployee[];
				teams?: IOrganizationTeam[];
				name?: string;
				requiresApproval?: boolean;
				paid?: boolean;
				leaveType?: LeaveTypeEnum;
				maxDaysPerYear?: number;
				allowCarryForward?: boolean;
				maxCarryForwardDays?: number;
				accrualRate?: number;
				accrualFrequency?: LeaveAccrualFrequencyEnum;
				isDefault?: boolean;
		}

export interface ITimeOffPolicyFindInput
		extends IBasePerTenantAndOrganizationEntityModel {
				employees?: IEmployee[];
				teams?: IOrganizationTeam[];
				name?: string;
				requiresApproval?: boolean;
				paid?: boolean;
				leaveType?: LeaveTypeEnum;
				isDefault?: boolean;
		}

// ─── Time-Off Request ─────────────────────────────────────────────────────────

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
		/** Duration in working days (calculated) */
	durationDays?: number;
		/** Admin/manager review note */
	reviewNote?: string;
		/** Date when the status was last changed by an admin */
	reviewedAt?: Date;
		/** ID of the reviewer (admin/manager) */
	reviewedById?: string;
}

export interface ITimeOffFindInput
		extends IBasePerTenantAndOrganizationEntityModel {
				employeeId?: string;
				isArchived?: boolean;
				startDate?: Date;
				endDate?: Date;
				/** Filter by status (REQUESTED | APPROVED | DENIED | ALL) */
	status?: string;
				/** Filter only holidays or only time-off requests */
	isHoliday?: boolean;
				/** Filter by policy */
	policyId?: string;
		}

export interface ITimeOffUpdateInput {
		status?: string;
		/** Admin/manager review note when approving or denying */
	reviewNote?: string;
		description?: string;
		start?: Date;
		end?: Date;
		requestDate?: Date;
		isHoliday?: boolean;
		documentUrl?: string;
}

export interface ITimeOffCreateInput
		extends IBasePerTenantAndOrganizationEntityModel {
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

// ─── Official Holidays ────────────────────────────────────────────────────────

/**
 * Represents a publicly-known official holiday for a specific country.
 * Used to pre-fill holiday From/To dates when creating holiday records.
 */
export interface IOfficialHoliday extends IBasePerTenantAndOrganizationEntityModel {
		/** Display name of the holiday (e.g. "Christmas Day") */
	name: string;
		/** ISO 3166-1 alpha-2 country code (e.g. "US", "DE") */
	countryCode: string;
		/** Holiday date (or start date if multi-day) */
	date: Date;
		/** End date for multi-day holidays; equals date for single-day */
	endDate?: Date;
		/** Whether this is a recurring annual holiday */
	isRecurring?: boolean;
}

export interface IOfficialHolidayCreateInput
		extends IBasePerTenantAndOrganizationEntityModel {
				name: string;
				countryCode: string;
				date: Date;
				endDate?: Date;
				isRecurring?: boolean;
		}

export interface IOfficialHolidayFindInput
		extends IBasePerTenantAndOrganizationEntityModel {
				countryCode?: string;
				year?: number;
		}

// ─── Leave Balance ────────────────────────────────────────────────────────────

/**
 * Tracks how many leave days an employee has available, used, and carried over
 * under a specific TimeOffPolicy for a given year.
 */
export interface ITimeOffBalance extends IBasePerTenantAndOrganizationEntityModel {
		employee?: IEmployee;
		employeeId: string;
		policy?: ITimeOffPolicy;
		policyId: string;
		/** Fiscal/calendar year this balance applies to */
	year: number;
		/** Days accrued so far this year */
	accrued: number;
		/** Days taken (approved time-off requests) */
	taken: number;
		/** Days carried forward from the previous year */
	carriedForward: number;
		/** Remaining days (accrued + carriedForward - taken) */
	remaining: number;
}

export interface ITimeOffBalanceFindInput
		extends IBasePerTenantAndOrganizationEntityModel {
				employeeId?: string;
				policyId?: string;
				year?: number;
		}

// ─── Statistics ───────────────────────────────────────────────────────────────

/** Summary statistics for the time-off management page */
export interface ITimeOffStatistics {
		/** Total approved days for the queried period */
	totalApprovedDays: number;
		/** Total pending (REQUESTED) days */
	totalPendingDays: number;
		/** Total denied days */
	totalDeniedDays: number;
		/** Number of unique employees who took time off */
	employeeCount: number;
		/** Breakdown by policy name */
	byPolicy: Array<{ policyName: string; days: number }>;
		/** Breakdown by leave type */
	byLeaveType: Array<{ leaveType: LeaveTypeEnum; days: number }>;
}
