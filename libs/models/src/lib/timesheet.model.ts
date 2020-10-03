import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationContact } from './organization-contact.model';
import { IOrganizationProject } from './organization-projects.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';
import { ITask } from './task-entity.model';
import { ITag } from './tag-entity.model';

export interface IPagination {
	limit?: number;
	page?: number;
}

export interface ITimesheet extends IBasePerTenantAndOrganizationEntityModel {
	employee: IEmployee;
	approvedBy?: IEmployee;
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
	isBilled?: boolean;
	status: string;
}

export interface ITimesheetCreateInput {
	employeeId: string;
	approvedById?: string;
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

export interface ITimeSheetFindInput {
	employeeId: string;
	approvedById?: string;
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
	IN_REVIEW = 'IN_REVIEW',
	DENIED = 'DENIED',
	APPROVED = 'APPROVED'
}

export interface IUpdateTimesheetStatusInput {
	ids: string | string[];
	status?: TimesheetStatus;
}

export interface ISubmitTimesheetInput {
	ids: string | string[];
	status: 'submit' | 'unsubmit';
}

export interface IGetTimesheetInput
	extends IBasePerTenantAndOrganizationEntityModel {
	startDate?: string;
	endDate?: string;
	projectIds?: string[];
	clientId?: string[];
	employeeIds?: string[];
}

export interface IDateRange {
	start: Date;
	end: Date;
}
export interface ITimeLog extends IBasePerTenantAndOrganizationEntityModel {
	[x: string]: any;
	employee: IEmployee;
	timesheet?: ITimesheet;
	task?: ITask;
	timeSlots?: ITimeSlot[];
	project?: IOrganizationProject;
	organizationContact?: IOrganizationContact;
	source?: string;
	startedAt?: Date;
	stoppedAt?: Date;
	logType: string;
	description?: string;
	reason?: string;
	duration: number;
	isBillable: boolean;
	employeeId: string;
	projectId?: string;
	organizationContactId?: string;
	taskId?: string;
	tags?: string[];
}

export interface ITimeLogCreateInput {
	employeeId: string;
	timesheetId?: string;
	taskId?: string;
	projectId: string;
	startedAt?: Date;
	stoppedAt?: Date;
	logType: TimeLogType;
	description?: string;
	duration: number;
	isBillable?: boolean;
	isBilled?: boolean;
}

export interface ITimeSlotCreateInput {
	employeeId: string;
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
	IDEAL = 'IDEAL',
	RESUMED = 'RESUMED'
}

export enum TimeLogSourceEnum {
	MOBILE = 'MOBILE',
	WEB_TIMER = 'WEB_TIMER',
	DESKTOP = 'DESKTOP',
	BROWSER = 'BROWSER',
	HUBSTAFF = 'HUBSTAFF',
	UPWORK = 'UPWORK'
}

export interface ITimeLogFilters
	extends IBasePerTenantAndOrganizationEntityModel {
	date?: Date | string;
	startDate?: Date | string;
	endDate?: Date | string;
	projectIds?: string[];
	employeeIds?: string[];
	logType?: TimeLogType[];
	source?: TimeLogSourceEnum[];
	activityLevel?: {
		start: number;
		end: number;
	};
}

export interface ITimeSlot extends IBasePerTenantAndOrganizationEntityModel {
	[x: string]: any;
	employeeId: string;
	employee?: IEmployee;
	activities?: IActivity[];
	screenshots?: IScreenshot[];
	timeLogs?: ITimeLog[];
	timeSlotMinutes?: ITimeSlotMinute[];
	project?: IOrganizationProject;
	projectId?: string;
	duration?: number;
	keyboard?: number;
	mouse?: number;
	overall?: number;
	startedAt: Date;
	stoppedAt?: Date;
	tags?: ITag[];
}

export interface ITimeSlotTimeLogs
	extends IBasePerTenantAndOrganizationEntityModel {
	timeLogs: ITimeLog[];
	timeSlots: ITimeSlot[];
	timeLogId: string;
	timeSlotId: string;
}

export interface ITimeSlotMinute
	extends IBasePerTenantAndOrganizationEntityModel {
	timeSlot?: ITimeSlot;
	timeSlotId?: string;
	keyboard?: number;
	mouse?: number;
	datetime?: Date;
}

export interface IActivity extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	description?: string;
	employee?: IEmployee;
	employeeId?: string;
	timeSlot?: ITimeSlot;
	timeSlotId?: string;
	project?: IOrganizationProject;
	projectId?: string;
	task?: ITask;
	taskId?: string;
	metaData?: string | IURLMetaData;
	date: string;
	time: string;
	duration?: number;
	type?: string;
	source?: string;
	id?: string;
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
	employeeId?: string;
	projectId?: string;
	duration?: number;
	keyboard?: number;
	mouse?: number;
	overall?: number;
	startedAt?: Date;
	stoppedAt?: Date;
	timeSlotId?: string;
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
}

export interface ICreateScreenshotInput {
	activityTimestamp: string;
	employeeId?: string;
	file: string;
	thumb?: string;
	recordedAt: Date | string;
}

export interface IScreenshot extends IBasePerTenantAndOrganizationEntityModel {
	[x: string]: any;
	timeSlot?: ITimeSlot;
	timeSlotId?: string;
	file: string;
	thumb?: string;
	fileUrl?: string;
	thumbUrl?: string;
	recordedAt?: Date;
}

export interface IScreenshotMap {
	startTime: string;
	endTime: string;
	timeSlots: ITimeSlot[];
}

export interface ITimerStatus {
	duration: number;
	running: boolean;
	lastLog?: ITimeLog;
}
export interface TimerState {
	showTimerWindow: boolean;
	duration: number;
	current_session_duration: number;
	running: boolean;
	timerConfig: ITimerToggleInput;
}

export interface ITimerToggleInput {
	organizationId?: string;
	projectId?: string;
	taskId?: string;
	organizationContactId?: string;
	description?: string;
	logType?: TimeLogType;
	tags?: string[];
	isBillable?: boolean;
	manualTimeSlot?: boolean;
}

export interface IManualTimeInput {
	id?: string;
	employeeId?: string;
	projectId?: string;
	taskId?: string;
	organizationContactId?: string;
	logType?: TimeLogType;
	description?: string;
	reason?: string;
	startedAt?: Date;
	stoppedAt?: Date;
	tags?: string[];
	isBillable?: boolean;
}

export interface IGetTimeLogInput extends ITimeLogFilters {
	timesheetId?: string;
}

export interface IGetTimeLogConflictInput {
	ignoreId?: string | string[];
	startDate: string | Date;
	endDate: string | Date;
	employeeId: string;
	organizationId?: string;
	relations?: string[];
}

export interface IGetTimeSlotInput extends ITimeLogFilters {
	relations?: string[];
}

export interface IGetActivitiesInput extends ITimeLogFilters, IPagination {
	relations?: string[];
	types?: string[];
	titles?: string[];
}

export interface IBulkActivitiesInput {
	employeeId: string;
	projectId?: string;
	activities: IActivity[];
}
