import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Tag, Task, Employee, EmployeeFindInput } from '..';
import { OrganizationContact } from './organization-contact.model';
import { OrganizationProjects } from './organization-projects.model';

export interface Pagination {
	limit?: number;
	page?: number;
}

export interface Timesheet extends IBaseEntityModel {
	employee: Employee;
	approvedBy?: OrganizationContact;
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

export interface TimeSheetFindInput {
	employeeId: string;
	approvedById?: string;
	employee: EmployeeFindInput;
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

export interface IGetTimesheetInput {
	startDate?: string;
	endDate?: string;
	projectId?: string[];
	clientId?: string[];
	employeeIds?: string[];
	organizationId?: string;
}

export interface IDateRange {
	start: Date;
	end: Date;
}
export interface TimeLog extends IBaseEntityModel {
	[x: string]: any;
	employee: Employee;
	timesheet?: Timesheet;
	task?: Task;
	timeSlots?: TimeSlot[];
	project?: OrganizationProjects;
	organizationContact?: OrganizationContact;
	source?: string;
	startedAt?: Date;
	stoppedAt?: Date;
	logType: string;
	description?: string;
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
	MOBILE = 'Mobile',
	WEB_TIMER = 'WebTimer',
	DESKTOP = 'Desktop',
	BROWSER = 'Browser',
	HUBSTAFF = 'Hubstaff',
	UPWORK = 'Upwork'
}

export interface TimeLogFilters {
	organizationId?: string;
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

export interface TimeSlot extends IBaseEntityModel {
	[x: string]: any;
	employeeId: string;
	employee?: Employee;
	activities?: Activity[];
	screenshots?: Screenshot[];
	timeLogs?: TimeLog[];
	timeSlotMinutes?: TimeSlotMinute[];
	project?: OrganizationProjects;
	projectId?: string;
	duration?: number;
	keyboard?: number;
	mouse?: number;
	overall?: number;
	startedAt: Date;
	stoppedAt?: Date;
	tags?: Tag[];
	activites?: Activity[];
}

export interface ITimeSlotTimeLogs extends IBaseEntityModel {
	timeLogs: TimeLog[];
	timeSlots: TimeSlot[];
	timeLogId: string;
	timeSlotId: string;
}

export interface ITimeSlotMinute extends IBaseEntityModel {
	timeSlot?: TimeSlot;
	keyboard?: number;
	mouse?: number;
	datetime: Date;
}

export interface Activity extends IBaseEntityModel {
	title: string;
	description?: string;
	employee?: Employee;
	employeeId?: string;
	timeSlot?: TimeSlot;
	timeSlotId?: string;
	project?: OrganizationProjects;
	projectId?: string;
	task?: Task;
	taskId?: string;
	metaData?: string | URLMetaData;
	date: string;
	time: string;
	duration?: number;
	type?: string;
	source?: string;
}

export interface DailyActivity {
	[x: string]: any;
	sessions?: number;
	duration?: number;
	employeeId?: string;
	date?: string;
	title?: string;
}

export interface TimeSlotMinute extends IBaseEntityModel {
	timeSlot: TimeSlot;
	timeSlotId: string;
	keyboard: number;
	mouse: number;
	datetime: Date;
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

export interface URLMetaData {
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

export interface Screenshot extends IBaseEntityModel {
	[x: string]: any;
	timeSlot?: TimeSlot;
	timeSlotId?: string;
	file: string;
	thumb?: string;
	fileUrl?: string;
	thumbUrl?: string;
	recordedAt?: Date;
}

export interface TimerStatus {
	duration: number;
	running: boolean;
	lastLog?: TimeLog;
}

export interface ITimerToggleInput {
	//timesheetId?: string;
	projectId?: string;
	taskId?: string;
	organizationContactId?: string;
	description?: string;
	logType?: TimeLogType;
	tags?: string[];
	isBillable?: boolean;
}

export interface IManualTimeInput {
	id?: string;
	employeeId?: string;
	projectId?: string;
	taskId?: string;
	organizationContactId?: string;
	description?: string;
	startedAt?: Date;
	stoppedAt?: Date;
	tags?: string[];
	isBillable?: boolean;
}

export interface IGetTimeLogInput extends TimeLogFilters {
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

export interface IGetTimeSlotInput extends TimeLogFilters {
	relations?: string[];
}

export interface IGetActivitiesInput extends TimeLogFilters, Pagination {
	relations?: string[];
	type?: string[];
}

export interface IBulkActivitiesInput {
	activities: Activity[];
}
