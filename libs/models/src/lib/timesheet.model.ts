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

export enum TimesheetStatus {
	DRAFT = 'DRAFT',
	PENDING = 'PENDING',
	IN_REVIEW = 'IN_REVIEW',
	DENIED = 'DENIED',
	APPROVED = 'APPROVED'
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

export enum TimeLogType {
	TRACKED = 'TRACKED',
	MANUAL = 'MANUAL'
}

export interface TimeSlot extends IBaseEntityModel {
	timeLog?: TimeLog;
	project?: OrganizationProjects;
	duration?: number;
	keyboard?: number;
	mouse?: number;
	overall?: number;
	startedAt?: Date;
	stoppedAt?: Date;
	tags?: Tag[];
}

export interface Activity extends IBaseEntityModel {
	timeSlot?: TimeSlot;
	title: string;
	data?: string;
	duration?: number;
	type?: string;
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
	projectId?: string;
	taskId?: string;
	clientId?: string;
	description?: string;
	startedAt?: Date;
	stoppedAt?: Date;
	tags?: string[];
	isBillable?: boolean;
}

export interface IGetTimeLogInput {
	startDate?: string;
	endDate?: string;
	projectId?: string[];
	clientId?: string[];
	employeeId?: string;
}
