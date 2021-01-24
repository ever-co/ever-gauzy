import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationProject } from './organization-projects.model';
import { ITask } from './task-entity.model';

export interface IOrganizationSprint
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	projectId: string;
	goal?: string;
	length: number; // Duration of Sprint. Default value - 7 (days)
	startDate?: Date;
	endDate?: Date;
	dayStart?: number; // Enum ((Sunday-Saturday) => (0-7))
	project?: IOrganizationProject;
	isActive?: boolean;
	tasks?: ITask[];
}

export enum SprintStartDayEnum {
	SUNDAY = 1,
	MONDAY = 2,
	TUESDAY = 3,
	WEDNESDAY = 4,
	THURSDAY = 5,
	FRIDAY = 6,
	SATURDAY = 7
}

export interface IOrganizationSprintUpdateInput {
	name: string;
	goal?: string;
	length: number;
	startDate?: Date;
	endDate?: Date;
	dayStart?: number;
	project?: IOrganizationProject;
	isActive?: boolean;
	tasks?: ITask[];
}
