import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Tag, Task, Employee } from '..';
import { OrganizationClients } from './organization-clients.model';
import { OrganizationProjects } from './organization-projects.model';

export interface Timesheet extends IBaseEntityModel {
	name: string;
	employee?: Employee;
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

export interface TimeLog extends IBaseEntityModel {
	name: string;
	employee: Employee;
	timesheet: Timesheet;
	task?: Task;
	project?: OrganizationProjects;
	startedAt?: Date;
	stoppedAt?: Date;
	logType: string;
	description?: string;
	duration: number;
	isBilled: boolean;
	isBillable: boolean;
}

export enum TimeLogType {
	TRAKED = 'TRAKED',
	MANUAL = 'MANUAL'
}

export interface TimeSlot extends IBaseEntityModel {
	name: string;
	timesheet?: Timesheet;
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

export interface ITimerToggleInput {
	timesheetId?: string;
	projectId?: string;
	taskId?: string;
	clientId?: string;
	description?: string;
	logType?: TimeLogType;
	tags?: string[];
	isBillable?: boolean;
}
