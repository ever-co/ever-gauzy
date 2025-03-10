import { unitOfTime } from 'moment';
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

export interface ITimesheet extends IBasePerTenantAndOrganizationEntityModel {
	employee: IEmployee;
	employeeId?: ID;
	approvedBy?: IUser;
	approvedById?: ID;
	timeLogs?: ITimeLog[];
	duration?: number;
	keyboard?: number;
	mouse?: number;
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
	employeeId: ID;
	approvedById?: ID;
	employee: IEmployeeFindInput;
	isBilled?: boolean;
	status?: string;
	startedAt: Date;
	stoppedAt?: Date;
	approvedAt?: Date;
	submittedAt?: Date;
}

export enum TimesheetStatus {
	DRAFT = 'DRAFT',
	PENDING = 'PENDING',
	IN_REVIEW = 'IN REVIEW',
	DENIED = 'DENIED',
	APPROVED = 'APPROVED'
}

export interface IUpdateTimesheetStatusInput extends IBasePerTenantAndOrganizationEntityModel {
	ids: ID | ID[];
	status?: TimesheetStatus;
}

export interface ISubmitTimesheetInput extends IBasePerTenantAndOrganizationEntityModel {
	ids: ID | ID[];
	status: 'submit' | 'unsubmit';
}

export interface IGetTimesheetInput extends IBasePerTenantAndOrganizationEntityModel, IBaseRelationsEntityModel {
	onlyMe?: boolean;
	startDate?: Date | string;
	endDate?: Date | string;
	projectIds?: ID[];
	clientId?: ID[];
	employeeIds?: ID[];
	status?: TimesheetStatus[];
	taskIds?: ID[];
}

export interface IDateRange {
	start: Date;
	end: Date;
}
export interface ITimeLog
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationProject,
		IRelationalOrganizationTeam,
		ITaggable {
	employee: IEmployee;
	employeeId: ID;
	timesheet?: ITimesheet;
	timesheetId?: ID;
	task?: ITask;
	taskId?: ID;
	timeSlots?: ITimeSlot[];
	project?: IOrganizationProject;
	projectId?: ID;
	organizationContact?: IOrganizationContact;
	organizationContactId?: ID;
	source?: TimeLogSourceEnum;
	startedAt?: Date;
	stoppedAt?: Date;
	editedAt?: Date;
	logType?: TimeLogType;
	description?: string;
	reason?: string;
	duration: number;
	isBillable?: boolean;
	isRunning?: boolean;
	isEdited?: boolean;
}

export interface ITimeLogCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId: ID;
	timesheetId?: ID;
	taskId?: ID;
	projectId: ID;
	startedAt?: Date;
	stoppedAt?: Date;
	logType: TimeLogType;
	description?: string;
	duration: number;
	isBillable?: boolean;
	isBilled?: boolean;
}

export interface ITimeSlotCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId: ID;
	duration: number;
	keyboard: number;
	mouse: number;
	overall: number;
	startedAt: Date;
	time_slot: Date;
}

export enum TimeLogType {
	TRACKED = 'TRACKED',
	MANUAL = 'MANUAL',
	IDLE = 'IDLE',
	RESUMED = 'RESUMED'
}

export enum ManualTimeLogAction {
	ADDED = 'ADDED',
	EDITED = 'EDITED'
}

export enum TimeLogSourceEnum {
	MOBILE = 'MOBILE',
	WEB_TIMER = 'BROWSER',
	DESKTOP = 'DESKTOP',
	BROWSER_EXTENSION = 'BROWSER_EXTENSION',
	HUBSTAFF = 'HUBSTAFF',
	UPWORK = 'UPWORK',
	TEAMS = 'TEAMS',
	CLOC = 'CLOC'
}

export interface ITimeLogFilters extends IBasePerTenantAndOrganizationEntityModel {
	date?: Date | string;
	startDate?: Date | string;
	endDate?: Date | string;
	isCustomDate?: boolean;
	employeeIds?: ID[];
	projectIds?: ID[];
	teamIds?: ID[];
	taskIds?: ID[];
	logType?: TimeLogType[];
	source?: TimeLogSourceEnum[];
	activityLevel?: {
		start: number;
		end: number;
	};
	defaultRange?: boolean;
	unitOfTime?: unitOfTime.StartOf | string;
	categoryId?: ID;
	timeZone?: string;
	timeFormat?: TimeFormatEnum;
	status?: TimesheetStatus[];
}

export interface ITimeLogTodayFilters extends IBasePerTenantAndOrganizationEntityModel {
	todayStart?: Date | string;
	todayEnd?: Date | string;
}

export interface ITimeSlot extends IBasePerTenantAndOrganizationEntityModel {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[x: string]: any;
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
	percentage?: number;
	keyboardPercentage?: number;
	mousePercentage?: number;
	tags?: ITag[];
	isAllowDelete?: boolean;
}

export interface ITimeSlotTimeLogs extends IBasePerTenantAndOrganizationEntityModel {
	timeLogs: ITimeLog[];
	timeSlots: ITimeSlot[];
	timeLogId: ID;
	timeSlotId: ID;
}

export interface ITimeSlotMinute extends IBasePerTenantAndOrganizationEntityModel {
	timeSlot?: ITimeSlot;
	timeSlotId?: ID;
	keyboard?: number;
	mouse?: number;
	datetime?: Date;
}

export interface IActivity extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	description?: string;
	employee?: IEmployee;
	employeeId?: ID;
	timeSlot?: ITimeSlot;
	timeSlotId?: ID;
	project?: IOrganizationProject;
	projectId?: ID;
	task?: ITask;
	taskId?: ID;
	metaData?: string | IURLMetaData;
	date: string;
	time: string;
	duration?: number;
	type?: string;
	source?: string;
	activityTimestamp?: string;
	recordedAt?: Date;
}

export interface IDailyActivity {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[x: string]: any;
	sessions?: number;
	duration?: number;
	employeeId?: ID;
	date?: string;
	title?: string;
	description?: string;
	durationPercentage?: number;
	childItems?: IDailyActivity[];
}

export interface ICreateActivityInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: ID;
	projectId?: ID;
	timeSlotId?: ID;
	duration?: number;
	keyboard?: number;
	mouse?: number;
	overall?: number;
	startedAt?: Date;
	stoppedAt?: Date;
	type: string;
	title: string;
	data?: string;
}

export enum ActivityType {
	URL = 'URL',
	APP = 'APP'
}

export interface IURLMetaData {
	title?: string;
	description?: string;
	image?: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[x: string]: any;
}

export interface ITimerStatusInput
	extends ITimeLogTodayFilters,
		IBaseRelationsEntityModel,
		IEmployeeEntityInput,
		IRelationalOrganizationTeam {
	source?: TimeLogSourceEnum;
	employeeIds?: ID[];
}

export interface ITimerStatus {
	duration?: number;
	running?: boolean;
	lastLog?: ITimeLog;
	lastWorkedTask?: ITask;
	timerStatus?: 'running' | 'pause' | 'idle';
}
export interface TimerState {
	showTimerWindow: boolean;
	duration: number;
	currentSessionDuration: number;
	running: boolean;
	position: ITimerPosition;
	timerConfig: ITimerToggleInput;
}

export interface ITimerPosition {
	x: number;
	y: number;
}

export interface ITimerToggleInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Pick<IRelationalOrganizationTeam, 'organizationTeamId'> {
	projectId?: ID;
	taskId?: ID;
	organizationContactId?: ID;
	description?: string;
	logType?: TimeLogType;
	source?: TimeLogSourceEnum;
	tags?: string[];
	isBillable?: boolean;
	manualTimeSlot?: boolean;
	version?: string;
	startedAt?: Date;
	stoppedAt?: Date;
}

export interface IManualTimeInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: ID;
	projectId?: ID;
	taskId?: ID;
	organizationContactId?: ID;
	logType?: TimeLogType;
	description?: string;
	reason?: string;
	startedAt?: Date;
	stoppedAt?: Date;
	editedAt?: Date;
	tags?: string[];
	isBillable?: boolean;
}

export interface IGetTimeLogInput extends ITimeLogFilters, IBaseRelationsEntityModel {
	onlyMe?: boolean;
	timesheetId?: ID;
}

export interface IGetTimeLogReportInput extends IGetTimeLogInput {
	groupBy?: ReportGroupByFilter;
	isEdited?: boolean;
}

export interface IGetTimeLogConflictInput extends IBasePerTenantAndOrganizationEntityModel, IBaseRelationsEntityModel {
	ignoreId?: ID | ID[];
	startDate: string | Date;
	endDate: string | Date;
	employeeId: ID;
}

export interface IGetTimeSlotInput extends ITimeLogFilters, IBaseRelationsEntityModel {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[x: string]: any;
}

export interface IGetActivitiesInput extends ITimeLogFilters, IPaginationInput, IBaseRelationsEntityModel {
	types?: string[];
	titles?: string[];
	groupBy?: string;
}

export interface IBulkActivitiesInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId: ID;
	projectId?: ID;
	activities: IActivity[];
}

export interface IAmountOwedReport {
	date: string;
	employees: {
		employee: IEmployee;
		duration: number;
		amount: number;
	}[];
}

export interface IAmountOwedReportChart {
	date: string;
	value: number;
}

export interface IReportTask {
	task: ITask;
	description: string;
	duration: number;
	client?: IOrganizationContact;
}

export interface IReportEmployeeLogs {
	tasks: IReportTask[];
	employee: IEmployee;
	sum: number;
	activity: number;
}

export interface IReportProjectLogs {
	tasks: IReportTask[];
	project: IOrganizationProject;
	sum: number;
	activity: number;
}

export interface IReportDayGroupByDate {
	date: string;
	logs: {
		project: IOrganizationProject;
		employeeLogs: IReportEmployeeLogs[];
	}[];
	sum: number;
	activity: number;
}

export interface IReportDayGroupByEmployee {
	employee: IEmployee;
	logs: {
		date: string;
		projectLogs: IReportProjectLogs[];
	}[];
	sum: number;
	activity: number;
}

export interface IReportDayGroupByProject {
	project: IOrganizationProject;
	logs: {
		date: string;
		employeeLogs: IReportEmployeeLogs[];
	}[];
	sum: number;
	activity: number;
}

export interface IReportDayGroupByClient {
	client: IOrganizationContact;
	logs: {
		project: IOrganizationProject;
		logs: {
			date: string;
			projectLogs: IReportEmployeeLogs[];
		}[];
	}[];
	sum: number;
	activity: number;
}

export type IReportDayData =
	| IReportDayGroupByDate
	| IReportDayGroupByEmployee
	| IReportDayGroupByProject
	| IReportDayGroupByClient;

export interface IDailyReportChart {
	date: string;
	value: {
		TRACKED: number;
		MANUAL: number;
		IDLE: number;
		RESUMED: number;
	};
}

export interface IReportWeeklyDate {
	sum: number;
	logs: ITimeLog[];
}

export interface IReportWeeklyData {
	employee: IEmployee;
	dates: Record<string, IReportWeeklyDate | number>;
	sum: number;
	activity: number;
}

export interface IGetTimeLimitReportInput extends IGetTimeLogReportInput {
	duration?: 'day' | 'week' | 'month';
}

export interface ITimeLimitReport {
	date: string;
	employees: {
		employee: IEmployee;
		duration: number;
		durationPercentage: number;
		limit: number;
	}[];
}

export interface IProjectBudgetLimitReport {
	project?: IOrganizationProject;
	budgetType?: OrganizationProjectBudgetTypeEnum;
	budget?: number;
	spent?: number;
	spentPercentage?: number;
	remainingBudget?: number;
}

export interface IClientBudgetLimitReport {
	organizationContact?: IOrganizationContact;
	budgetType?: OrganizationContactBudgetTypeEnum;
	budget?: number;
	spent?: number;
	spentPercentage?: number;
	remainingBudget?: number;
}

/**
 * Base interface for delete operations that include forceDelete flag
 * and extend the tenant and organization properties.
 */
export interface IDeleteEntity extends IBasePerTenantAndOrganizationEntityModel {
	forceDelete?: boolean;
}

/**
 * Interface for deleting time slots.
 * Includes an array of time slot IDs to be deleted.
 */
export interface IDeleteTimeSlot extends IDeleteEntity {
	ids: ID[];
}

/**
 * Interface for deleting time logs.
 * Includes an array of log IDs to be deleted.
 */
export interface IDeleteTimeLog extends IDeleteEntity {
	logIds: ID[];
}

/**
 * Interface for time log activity.
 * Contains the sum of overall activity and sum of duration
 * extracted from inner join of time log and time slot.
 */
export interface ITimeLogActivity {
	id: string;
	overall: number;
	duration: number;
}
