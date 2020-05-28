import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Tag, Task, Employee } from '..';
import { OrganizationClients } from './organization-clients.model';
import { OrganizationProjects } from './organization-projects.model';

export interface Timesheet extends IBaseEntityModel {
	employee: Employee;
	approvedBy?: OrganizationClients;
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
	stoppedAt: Date;
	approvedAt?: Date;
	submittedAt?: Date;
	lockedAt?: Date;
	isBilled?: boolean;
	status?: string;
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

export interface IGetTimeSheetInput {
	startDate?: string;
	endDate?: string;
	projectId?: string[];
	clientId?: string[];
	employeeId?: string;
	organizationId?: string;
}

export interface IDateRange {
	start: Date;
	end: Date;
}
export interface TimeLog extends IBaseEntityModel {
	employee: Employee;
	timesheet?: Timesheet;
	task?: Task;
	project?: OrganizationProjects;
	startedAt?: Date;
	stoppedAt?: Date;
	logType: string;
	description?: string;
	duration: number;
	isBillable: boolean;
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
	MANUAL = 'MANUAL'
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
	startDate?: Date;
	endDate?: Date;
	employeeId?: string[];
	logType?: TimeLogType[];
	source?: TimeLogSourceEnum[];
	activityLevel?: {
		start: number;
		end: number;
	};
}

export interface TimeSlot extends IBaseEntityModel {
	employee: Employee;
	project?: OrganizationProjects;
	duration?: number;
	keyboard?: number;
	mouse?: number;
	overall?: number;
	startedAt: Date;
	stoppedAt: Date;
	tags?: Tag[];
}

export interface ITimeSlotMinute extends IBaseEntityModel {
	timeSlot?: TimeSlot;
	keyboard?: number;
	mouse?: number;
	datetime: Date;
}

export interface Activity extends IBaseEntityModel {
	timeSlot?: TimeSlot;
	title: string;
	data?: string;
	duration?: number;
	type?: string;
}

export interface ICreateActivityInput {
	employeeId: string;
	projectId: string;
	duration?: number;
	keyboard?: number;
	mouse?: number;
	overall?: number;
	startedAt: Date;
	stoppedAt: Date;
	title: string;
}

export enum ActivityType {
	URL = 'URL',
	APP = 'APP'
}

export interface Screenshot extends IBaseEntityModel {
	timeSlot: TimeSlot;
	fullUrl: string;
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
	clientId?: string;
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
	clientId?: string;
	description?: string;
	startedAt?: Date;
	stoppedAt?: Date;
	tags?: string[];
	isBillable?: boolean;
}

export interface IGetTimesheetInput {
	startDate?: string;
	endDate?: string;
	projectId?: string[];
	clientId?: string[];
	employeeId?: string | string[];
}

export interface IGetTimeLogInput {
	timesheetId?: string;
	startDate?: string;
	endDate?: string;
	projectId?: string[];
	clientId?: string[];
	employeeId?: string | string[];
	source?: TimeLogSourceEnum | TimeLogSourceEnum[];
	logType?: TimeLogType | TimeLogType[];
	activityLevel?: { start: number; end: number };
	organizationId?: string;
}
