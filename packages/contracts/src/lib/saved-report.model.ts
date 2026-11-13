/**
 * Contract for saved reports: a report a signed-in member set up once (which report, its period, its filters and its
 * grouping) and reopens in one click. When its author turns a link on, anyone with the link reads the report without
 * signing in (`GET /api/public/saved-reports/:token`), computed when the link is opened.
 */

import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';

/** The reports a saved report can describe. */
export enum SavedReportKindEnum {
	TIME_AND_ACTIVITY = 'TIME_AND_ACTIVITY'
}

/**
 * A period stated as a rule, evaluated on the day the report is read in the report's time zone, so that "last month"
 * moves with the calendar. The values are the period presets of the Ever Teams report pages.
 */
export enum SavedReportPeriodRuleEnum {
	TODAY = 'today',
	YESTERDAY = 'yesterday',
	THIS_WEEK = 'thisWeek',
	LAST_WEEK = 'lastWeek',
	LAST_7_DAYS = 'last7Days',
	LAST_14_DAYS = 'last14Days',
	THIS_MONTH = 'thisMonth',
	LAST_MONTH = 'lastMonth'
}

/** How the report's table groups its rows. The rows themselves are always read per day, as the report page reads them. */
export enum SavedReportGroupingEnum {
	DATE = 'date',
	MEMBER = 'member',
	PROJECT = 'project',
	CLIENT = 'client',
	TASK = 'task',
	WEEK = 'week'
}

/** The value of the clients filter that keeps the time without a client. */
export const SAVED_REPORT_NO_CLIENT = 'none';

/** The filters of a saved report. An empty or missing list filters nothing. */
export interface ISavedReportFilters {
	teamIds?: ID[];
	/** Members, by employee id. None means everyone the author may see. */
	employeeIds?: ID[];
	projectIds?: ID[];
	/** Clients, by id; {@link SAVED_REPORT_NO_CLIENT} keeps the time without a client. */
	clientIds?: string[];
	taskIds?: ID[];
	/** Count billable time only. */
	billableOnly?: boolean;
}

/** A saved report as its author reads it. The link's token, and its hash, never leave the server. */
export interface ISavedReport extends IBasePerTenantAndOrganizationEntityModel {
	/** The user who saved it, the only one who reads, changes or shares it. */
	authorId: ID;
	author?: IUser;
	name: string;
	kind: SavedReportKindEnum;
	/** The period as a rule; null when the report keeps fixed dates. */
	periodRule?: SavedReportPeriodRuleEnum | null;
	/** The first day of fixed dates (`YYYY-MM-DD`); null when the report keeps a rule. */
	startDate?: string | null;
	/** The last day of fixed dates (`YYYY-MM-DD`), included; null when the report keeps a rule. */
	endDate?: string | null;
	/** The IANA time zone the days are counted in. */
	timeZone?: string | null;
	filters?: ISavedReportFilters | null;
	grouping?: SavedReportGroupingEnum | null;
	/** Whether the link shows amounts (members' rates and what their time is worth). Off by default. */
	includeAmounts?: boolean;
	/** When the current link was turned on; null while no link is on. */
	sharedAt?: Date | null;
	/** When the current link stops working; null when it does not expire. */
	shareExpiresAt?: Date | null;
	/** Whether a link is on and not expired. Computed when read. */
	isShared?: boolean;
}

/** `POST /api/saved-reports` */
export interface ISavedReportCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	kind?: SavedReportKindEnum;
	periodRule?: SavedReportPeriodRuleEnum | null;
	startDate?: string | null;
	endDate?: string | null;
	timeZone?: string | null;
	filters?: ISavedReportFilters | null;
	grouping?: SavedReportGroupingEnum | null;
	includeAmounts?: boolean;
}

/** `PUT /api/saved-reports/:id`: the fields sent replace the stored ones, the others are kept. */
export type ISavedReportUpdateInput = Partial<Omit<ISavedReportCreateInput, 'tenantId' | 'organizationId'>>;

/** `POST /api/saved-reports/:id/share`: turns the link on, or replaces it with a new one. */
export interface ISavedReportShareInput {
	/** When the link stops working; none for a link that does not expire. */
	expiresAt?: Date | string | null;
}

/** What turning a link on answers, once: the token the link carries. Only its hash is stored. */
export interface ISavedReportShareResponse {
	token: string;
	sharedAt: Date;
	shareExpiresAt: Date | null;
}

/** A name, as the public answer names a project, a client or a team. */
export interface IPublicSavedReportNamed {
	id: ID;
	name: string;
}

/** A member as the public answer names them; the rate only when the author included amounts. */
export interface IPublicSavedReportMember {
	id: ID;
	fullName: string;
	user: { firstName: string | null; lastName: string | null; name: string | null };
	billRateValue?: number | null;
	billRateCurrency?: string | null;
}

/** One time entry of a member, as the public answer states it. */
export interface IPublicSavedReportTask {
	task: { id: ID; title: string; number?: number | null; prefix?: string | null } | null;
	duration: number;
	client: IPublicSavedReportNamed | null;
	/** The entry's team; stated (null for the time without a team) when the report counts the time without a team. */
	organizationTeamId?: ID | null;
}

/** One member's time on one project on one day. */
export interface IPublicSavedReportMemberLog {
	employee: IPublicSavedReportMember;
	/** Seconds. */
	sum: number;
	tasks: IPublicSavedReportTask[];
	/** What the time is worth at the member's rate; only when the author included amounts and the member has a rate. */
	amount?: number | null;
}

/** One day of the report, per project. */
export interface IPublicSavedReportDay {
	date: string;
	/** Seconds. */
	sum: number;
	logs: {
		project:
			| (IPublicSavedReportNamed & {
					color?: string | null;
					organizationContact?: IPublicSavedReportNamed | null;
			  })
			| null;
		employeeLogs: IPublicSavedReportMemberLog[];
	}[];
}

/** An amount in one currency: amounts in different currencies are never added. */
export interface IPublicSavedReportAmount {
	currency: string;
	amount: number;
}

/** `GET /api/public/saved-reports/:token`: report fields only. */
export interface IPublicSavedReport {
	name: string;
	kind: SavedReportKindEnum;
	grouping: SavedReportGroupingEnum | null;
	includeAmounts: boolean;
	period: {
		rule: SavedReportPeriodRuleEnum | null;
		/** First day (`YYYY-MM-DD`) in `timeZone`. */
		startDate: string;
		/** Last day (`YYYY-MM-DD`) in `timeZone`, included. */
		endDate: string;
		timeZone: string;
	};
	/** When the figures were computed. */
	generatedAt: Date;
	days: IPublicSavedReportDay[];
	totals: {
		/** Seconds. */
		duration: number;
		/** Per currency; only when the author included amounts. */
		amounts?: IPublicSavedReportAmount[];
	};
}
