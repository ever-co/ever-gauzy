import { IBasePerTenantAndOrganizationEntityModel, IBaseRelationsEntityModel, ID } from './base-entity.model';
import { IOrganizationContact, OrganizationContactBudgetTypeEnum } from './organization-contact.model';
import {
		IOrganizationProject,
		IRelationalOrganizationProject,
		OrganizationProjectBudgetTypeEnum
} from './organization-projects.model';
import { IEmployee, IEmployeeFindInput, IEmployeeEntityInput } from './employee.model';
import { ITask } from './task.model';
import { ITag, ITaggable } from './tag.model';
import { IPaginationInput } from './core.model';
import { ReportGroupByFilter } from './report.model';
import { IUser } from './user.model';
import { IRelationalOrganizationTeam } from './organization-team.model';
import { IScreenshot } from './screenshot.model';
import { TimeFormatEnum } from './organization.model';
import { ITimeSlotMinute } from './time-slot-minute.model';

export interface ITimesheet extends IBasePerTenantAndOrganizationEntityModel {
		employee: IEmployee;
		employeeId?: ID;
		approvedBy?: IUser;
		approvedById?: ID;
		keyboard?: number;
		mouse?: number;
		duration?: number;
		overall?: number;
		startedAt?: Date;
		stoppedAt?: Date;
		approvedAt?: Date;
		submittedAt?: Date;
		lockedAt?: Date;
		editedAt?: Date;
		isBilled?: boolean;
		status: TimesheetStatus;
		isEdited?: boolean;
		// Project change request fields
	projectChangeRequestId?: ID;
		projectChangeRequest?: ITimesheetProjectChangeRequest;
}

export interface ITimesheetCreateInput extends IBasePerTenantAndOrganizationEntityModel {
		employeeId: ID;
		approvedById?: ID;
		duration: number;
		keyboard: number;
		mouse: number;
		overall?: number;
		startedAt: Date;
		stoppedAt?: Date;
		approvedAt?: Date;
		submittedAt?: Date;
		lockedAt?: Date;
		isBilled?: boolean;
		status?: string;
}

export interface ITimeSheetFindInput extends IBasePerTenantAndOrganizationEntityModel {
		employeeId?: ID;
		startedAt?: Date;
		stoppedAt?: Date;
		approvedAt?: Date;
		submittedAt?: Date;
		lockedAt?: Date;
}

export interface IUpdateTimesheetStatusInput {
		ids: ID | ID[];
		status?: TimesheetStatus;
}

export interface ISubmitTimesheetInput {
		ids: ID | ID[];
		status: 'submit' | 'unsubmit';
}

export enum TimesheetStatus {
		DRAFT = 'DRAFT',
		PENDING = 'PENDING',
		IN_REVIEW = 'IN REVIEW',
		DENIED = 'DENIED',
		APPROVED = 'APPROVED'
}

/**
 * Enum for the status of a timesheet project change request
 */
export enum TimesheetProjectChangeStatus {
		PENDING = 'PENDING',
		APPROVED = 'APPROVED',
		REJECTED = 'REJECTED'
}

/**
 * Interface for a timesheet project change request
 */
export interface ITimesheetProjectChangeRequest extends IBasePerTenantAndOrganizationEntityModel {
		timesheetId: ID;
		timesheet?: ITimesheet;
		requestedProjectId: ID;
		requestedProject?: IOrganizationProject;
		previousProjectId?: ID;
		previousProject?: IOrganizationProject;
		reason: string;
		status: TimesheetProjectChangeStatus;
		reviewedById?: ID;
		reviewedBy?: IUser;
		reviewedAt?: Date;
		reviewNote?: string;
}

/**
 * Input interface to request a timesheet project change
 */
export interface IRequestTimesheetProjectChange {
		timesheetId: ID;
		requestedProjectId: ID;
		reason: string;
		organizationId: ID;
}

/**
 * Input interface to update a timesheet project change request status (approve/reject)
 */
export interface IUpdateTimesheetProjectChangeStatus {
		changeRequestId: ID;
		status: TimesheetProjectChangeStatus;
		reviewNote?: string;
		organizationId: ID;
}

export interface ITimesheetStatistics {
		employeeId?: ID;
		employee?: IEmployee;
		duration?: number;
		overall?: number;
		keyboard?: number;
		mouse?: number;
}

export interface ISelectableTimesheet extends ITimesheet {
		isSelected?: boolean;
}

export interface ITimesheetRange {
		start?: string | Date;
		end?: string | Date;
}

export interface ITimeLog extends IBasePerTenantAndOrganizationEntityModel, ITaggable {
	employee?: IEmployee;
		employeeId?: ID;
		timesheetId?: ID;
		timesheet?: ITimesheet;
		task?: ITask;
		taskId?: ID;
		timeSlots?: ITimeSlot[];
		projectId?: ID;
		project?: IOrganizationProject;
		organizationContactId?: ID;
		organizationContact?: IOrganizationContact;
		organizationTeamId?: ID;
		organizationTeam?: IRelationalOrganizationTeam;
		description?: string;
		reason?: string;
		type?: string;
		source?: string;
		startedAt?: Date;
		stoppedAt?: Date;
		editedAt?: Date;
		duration?: number;
		isBillable?: boolean;
		isRunning?: boolean;
		isEdited?: boolean;
		version?: string;
		payload?: Record<string, any>;
}

export interface ITimeLogTodayAlreadyOn {
		isAllowed: boolean;
}

export enum TimeLogSourceEnum {
		MOBILE = 'MOBILE',
		WEB_TIMER = 'WEB_TIMER',
		DESKTOP = 'DESKTOP',
		BROWSER = 'BROWSER',
		BROWSER_EXTENSION = 'BROWSER_EXTENSION',
		HUBSTAFF = 'HUBSTAFF',
		UPWORK = 'UPWORK',
		TEAMS = 'TEAMS',
		CLOKR = 'CLOKR'
}

export enum TimeLogType {
		TRACKED = 'TRACKED',
		MANUAL = 'MANUAL',
		IDEAL = 'IDEAL',
		RESUMED = 'RESUMED'
}

export interface ITimeLogFilters extends IRelationalOrganizationProject {
		organizationId?: ID;
		tenantId?: ID;
		startDate?: string | Date;
		endDate?: string | Date;
		date?: string | Date;
		employeeIds?: string[];
		projectIds?: string[];
		teamIds?: string[];
		source?: TimeLogSourceEnum[];
		activityLevel?: {
			start: number;
			end: number;
		};
		logType?: TimeLogType[];
}

export interface ITimeLogTodayFilters {
		organizationId?: ID;
		tenantId?: ID;
}

export interface ITimeSlot extends IBasePerTenantAndOrganizationEntityModel {
		employeeId: ID;
		employee?: IEmployee;
		activities?: IActivity[];
		screenshots?: IScreenshot[];
		timeLogs?: ITimeLog[];
		timeSlotMinutes?: ITimeSlotMinute[];
		project?: IOrganizationProject;
		projectId?: ID;
		duration?: number;
		keyboard?: number;
		mouse?: number;
		overall?: number;
		startedAt: Date;
		stoppedAt?: Date;
		isActive?: boolean;
		version?: string;
}

export interface ITimeSlotTimeLogs {
		timeLogs: ITimeLog[];
}

export interface IActivity extends IBasePerTenantAndOrganizationEntityModel {
		employee?: IEmployee;
		employeeId?: ID;
		project?: IOrganizationProject;
		projectId?: ID;
		timeSlot?: ITimeSlot;
		timeSlotId?: ID;
		task?: ITask;
		taskId?: ID;
		title: string;
		metaData?: string | IURLMetaData;
		date: string;
		time: string;
		duration?: number;
		type?: string;
		source?: string;
		id?: string;
		activityTimestamp?: string;
		recordedAt?: Date;
}

export interface IDailyActivity {
		[x: string]: any;
		sessions?: number;
		duration?: number;
		employeeId?: string;
		date?: string;
		title?: string;
		description?: string;
		durationPercentage?: number;
		childItems?: IDailyActivity[];
}

export interface ICreateActivityInput {
		employeeId?: ID;
		projectId?: ID;
		duration?: number;
		keyboard?: number;
		mouse?: number;
		overall?: number;
		startedAt?: Date;
		stoppedAt?: Date;
		timeSlotId?: ID;
		type?: string;
		title?: string;
		data?: string;
}

export interface IURLMetaData {
		title?: string;
		description?: string;
		imageUrl?: string;
}

export interface ICreateDefaultActivityInput {
		organizationId: ID;
		userId: ID;
		employee: IEmployee;
}

export interface ITimerToggleInput {
		organizationId?: ID;
		projectId?: ID;
		taskId?: ID;
		organizationContactId?: ID;
		organizationTeamId?: ID;
		description?: string;
		reason?: string;
		isBillable?: boolean;
		type?: TimeLogType;
		tags?: string[];
		source?: TimeLogSourceEnum;
		startedAt?: Date;
		stoppedAt?: Date;
		isRunning?: boolean;
		version?: string;
}

export interface ITimerStatus {
		duration?: number;
		running?: boolean;
		lastLog?: ITimeLog;
		timerStatus?: 'running' | 'paused' | 'idle';
}

export interface ITimerStatusInput {
		organizationId: ID;
		tenantId?: ID;
		todayStart?: Date | string;
		todayEnd?: Date | string;
		source?: TimeLogSourceEnum;
}

export enum ManualTimeInput {
		ALLOW = 'ALLOW',
		DISALLOW = 'DISALLOW'
}

export interface IGetTimeLogInput extends ITimeLogFilters {
		timesheetId?: ID;
		startDate?: string | Date;
		endDate?: string | Date;
}

export interface IGetTimeLogConflictInput {
		ignoreId?: ID | ID[];
		startDate: string | Date;
		endDate: string | Date;
		employeeId: ID;
		organizationId?: ID;
		relations?: string[];
}

export interface IGetTimeSlotInput extends ITimeLogFilters {
		ids?: ID[];
		duration?: number;
		isActive?: boolean;
}

export interface IGetActivitiesInput extends ITimeLogFilters {
		searchTerm?: string;
		types?: string[];
		titles?: string[];
}

export interface IBulkActivitiesInput {
		employeeId: ID;
		projectId?: ID;
		activities: IActivity[];
}

export interface IReportDayData {
		date?: string;
		logs?: ITimeLog[];
}

export interface IAmountOwedReport {
		date?: string;
		employees?: {
			employee: IEmployee;
			owed: number;
			duration: number;
			perHour: number;
			weekHours: number;
		}[];
}

export interface IGetTimeLimitReportInput {
		organizationId?: ID;
		tenantId?: ID;
		startDate?: string | Date;
		endDate?: string | Date;
		employeeIds?: string[];
		projectIds?: string[];
		duration?: 'day' | 'week' | 'month';
}

export interface ITimeLimitReport {
		date?: string;
		employees?: {
			employee: IEmployee;
			duration: number;
			durationExpected: number;
		}[];
}

export interface IProjectBudgetLimitReport {
		budget?: number;
		budgetType?: OrganizationProjectBudgetTypeEnum;
		remainingBudget?: number;
		spent?: number;
		spentPercentage?: number;
		project?: IOrganizationProject;
}

export interface IClientBudgetLimitReport {
		budget?: number;
		budgetType?: OrganizationContactBudgetTypeEnum;
		remainingBudget?: number;
		spent?: number;
		spentPercentage?: number;
		client?: IOrganizationContact;
}

export interface IGetProjectBudgetLimitInput {
		organizationId?: ID;
		tenantId?: ID;
		startDate?: string | Date;
		endDate?: string | Date;
		employeeIds?: string[];
		projectIds?: string[];
		teamIds?: string[];
}

export interface IGetClientBudgetLimitInput {
		organizationId?: ID;
		tenantId?: ID;
		startDate?: string | Date;
		endDate?: string | Date;
		employeeIds?: string[];
		organizationContactId?: string;
}

export interface ITimesheetQuery extends IPaginationInput, IBaseRelationsEntityModel {
	status?: TimesheetStatus | TimesheetStatus[];
		startDate?: string | Date;
		endDate?: string | Date;
		employeeIds?: string[];
		projectIds?: string[];
		onlyMe?: boolean;
}

export interface IGetTimesheetInput extends ITimesheetQuery {
		organizationId?: ID;
		tenantId?: ID;
}

export interface ITimesheet2 {
		date: string;
		value: number | string;
}

export interface ITimesheetStatisticData {
		count?: number;
		sum?: number;
		[key: string]: any;
}

export interface ITimesheetFilter {
		startDate?: string | Date;
		endDate?: string | Date;
}

export type WeeklyLimit = {
		startDate: Date;
		endDate: Date;
};

export enum ReportDayData {
		BILLING = 'BILLING',
		WORKED_HOURS = 'WORKED_HOURS'
}

export interface IReportPosition {
		[reportGroupByFilter: string]: {
					[date: string]: IReportDayData[];
		};
}

export type IReportMap<T> = {
		[employeeId: string]: T[];
};

export enum ActivityType {
		URL = 'URL',
		APP = 'APP',
		ALL = 'ALL'
}

export interface ITimeLogs {
		startedAt: Date;
		stoppedAt: Date;
		type: TimeLogType;
		source: TimeLogSourceEnum;
}

export interface IReportDailyChartData {
		dates: string[];
		employees: {
			employee: IEmployee;
			sum: number;
			data: { duration: number; keyboard: number; mouse: number }[];
		}[];
}

export type ExpectedWorkHoursPerDay = {
		[date: string]: number;
};

export interface ITimesheetRecalculateInput {
		startDate: Date;
		endDate: Date;
		employeeId: ID;
		organizationId: ID;
		tenantId?: ID;
}

export interface ITrackingSession {
		lastActivity: Date;
		timeSlotId: ID;
}

export interface TimeSlotSummary {
		id: ID;
		startedAt: Date;
		stoppedAt: Date;
		duration: number;
}

/**
 * Interface for TimeSlotSession entity
 */
export interface ITimeSlotSession extends IBasePerTenantAndOrganizationEntityModel {
		sessionId: string;
		startTime?: Date;
		lastActivity?: Date;
		timeSlotId: ID;
		employeeId: ID;
}

/**
 * Interface for tracking session response
 */
export interface ITrackingSessionResponse {
		sessionId: string;
		timeSlotId?: ID;
		timeSlot?: TimeSlotSummary;
		timeLogs: ITimeLog[];
		session: ITrackingSession;
		timeSlots?: Array<{
			timeSlotId: ID;
			timeSlot?: TimeSlotSummary;
		}>;
}
