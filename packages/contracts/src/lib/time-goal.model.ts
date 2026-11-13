import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';
import { IOrganizationContact } from './organization-contact.model';
import { IRelationalOrganizationTeam } from './organization-team.model';
import { IOrganizationProject } from './organization-projects.model';

/**
 * Whether a time goal asks for at least or at most its hours.
 */
export enum TimeGoalComparisonEnum {
	AT_LEAST = 'AT_LEAST',
	AT_MOST = 'AT_MOST'
}

/**
 * The period a time goal's hours are counted over.
 */
export enum TimeGoalPeriodEnum {
	DAY = 'DAY',
	WEEK = 'WEEK',
	MONTH = 'MONTH'
}

/**
 * Who a time goal counts: one member, or each member of a team or of the organization.
 */
export enum TimeGoalScopeEnum {
	EMPLOYEE = 'EMPLOYEE',
	TEAM = 'TEAM',
	ORGANIZATION = 'ORGANIZATION'
}

/**
 * Where a member stands against a goal for a period: in progress or achieved for "at least",
 * on track or exceeded for "at most".
 */
export enum TimeGoalStateEnum {
	IN_PROGRESS = 'IN_PROGRESS',
	ACHIEVED = 'ACHIEVED',
	ON_TRACK = 'ON_TRACK',
	EXCEEDED = 'EXCEEDED'
}

/**
 * The fields a time goal is defined by.
 */
export interface ITimeGoalBase extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	comparison: TimeGoalComparisonEnum;
	targetHours: number;
	period: TimeGoalPeriodEnum;
	scope: TimeGoalScopeEnum;
	billableOnly?: boolean;
}

/**
 * A number of hours a member, or each member of a team or of the organization, holds to per day, week or month,
 * optionally counting some projects, some clients or billable time only.
 */
export interface ITimeGoal extends ITimeGoalBase, IEmployeeEntityInput, IRelationalOrganizationTeam {
	projects?: IOrganizationProject[];
	organizationContacts?: IOrganizationContact[];
}

/**
 * Creates a time goal. A member goal without `employeeId` is the caller's own.
 */
export interface ITimeGoalCreateInput extends ITimeGoalBase, IEmployeeEntityInput, IRelationalOrganizationTeam {
	projectIds?: ID[];
	organizationContactIds?: ID[];
}

/**
 * Changes what a time goal asks for. Who it counts is set at creation and does not change.
 */
export interface ITimeGoalUpdateInput
	extends
		Partial<Pick<ITimeGoalBase, 'name' | 'comparison' | 'targetHours' | 'period' | 'billableOnly'>>,
		IBasePerTenantAndOrganizationEntityModel {
	projectIds?: ID[];
	organizationContactIds?: ID[];
}

/**
 * Lists the time goals the caller may read in an organization.
 */
export interface ITimeGoalFindInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: ID;
	organizationTeamId?: ID;
	scope?: TimeGoalScopeEnum;
	includeArchived?: boolean;
}

/**
 * Reads the progress of members against the goals that count them, for the period of each goal that holds `date`.
 */
export interface ITimeGoalProgressFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** A local calendar date (YYYY-MM-DD) in each member's time zone. Today when absent. */
	date?: string;
	/** The members to read. The caller when absent. */
	employeeIds?: ID[];
	/** The team whose members a manager reads. */
	organizationTeamId?: ID;
	/** Only these goals. */
	goalIds?: ID[];
}

/**
 * Where one member stands against one goal for the period of that goal that holds the date read.
 */
export interface ITimeGoalProgress {
	goalId: ID;
	goal: ITimeGoal;
	employeeId: ID;
	period: TimeGoalPeriodEnum;
	/** First local calendar day of the period (YYYY-MM-DD). */
	startDate: string;
	/** Last local calendar day of the period (YYYY-MM-DD), inclusive. */
	endDate: string;
	/** The time zone the period is counted in: the member's, else the organization's, else UTC. */
	timeZone: string;
	trackedSeconds: number;
	targetSeconds: number;
	state: TimeGoalStateEnum;
}
