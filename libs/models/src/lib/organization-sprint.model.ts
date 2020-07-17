import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { OrganizationProjects, Task } from '@gauzy/models';
import { Organization } from '../../../../apps/api/src/app/organization/organization.entity';
import { ITenant } from './tenant.model';

export interface OrganizationSprint extends IBaseEntityModel {
	name: string;
	projectId: string;
	organizationId: string;
	goal?: string;
	length: number; // Duration of Sprint. Default value - 7 (days)
	startDate?: Date;
	endDate?: Date;
	dayStart?: number; // Enum ((Sunday-Saturday) => (0-7))
	project?: OrganizationProjects;
	isActive?: boolean;
	tasks?: Task[];
	tenant: ITenant;
	organization?: Organization;
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

export interface OrganizationSprintUpdateInput {
	name: string;
	goal?: string;
	length: number;
	startDate?: Date;
	endDate?: Date;
	dayStart?: number;
	project?: OrganizationProjects;
	isActive?: boolean;
	tasks?: Task[];
}
