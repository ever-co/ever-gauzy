import { IUser } from './user.model';
import { IEmployee } from './employee.model';
import { ITask } from './task-entity.model';
import { ITimeSlot, ITimeLog } from './timesheet.model';
import { IOrganizationProject } from './organization-projects.model';
import { IOrganization } from './organization.model';
import { ITenant } from './tenant.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IGetTimeSlotStatistics {
	employeeId?: string;
	projectId?: string;
	organizationId: string;
	tenantId: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface ITimeSlotStatistics extends IEmployee {
	user_name?: string;
	startedAt?: Date;
	user_image_url?: string;
	timeSlots?: ITimeSlot[];
	user: Pick<IUser, 'name' | 'imageUrl'>;
}

export interface IGetActivitiesStatistics {
	employeeId?: string;
	projectId?: string;
	organizationId: string;
	tenantId: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface IActivitiesStatistics {
	durationPercentage?: number;
	duration?: number;
	title?: string;
	sessions?: number;
}

export interface IGetProjectsStatistics {
	organizationId: string;
	tenantId: string;
	employeeId?: string;
	projectId?: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface IProjectsStatistics extends IOrganizationProject {
	//base per tenant organization
	organizationId?: string;
	organization?: IOrganization;
	tenantId?: string;
	tenant?: ITenant;
	duration?: number;
	durationPercentage?: number;
}

export interface IGetTasksStatistics
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	projectId?: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface ITasksStatistics extends ITask {
	duration?: number;
	durationPercentage?: number;
}

export interface IGetManualTimesStatistics
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	projectId?: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface IManualTimesStatistics
	extends Pick<ITimeLog, 'id' | 'startedAt' | 'duration'> {
	user?: Pick<IUser, 'name' | 'imageUrl'>;
	project?: Pick<IOrganizationProject, 'name'>;
}

export interface IGetMembersStatistics
	extends IBasePerTenantAndOrganizationEntityModel {
	date?: Date;
	employeeId?: string;
	projectId?: string;
}

export interface IMembersStatistics {
	id?: string;
	user_name?: string;
	user_image_url?: string;
	weekHours?: Array<{ duration: number; day: number }>;
	weekTime?: {
		duration: number;
		overall: number;
		employeeId: string;
	};
	todayTime?: {
		duration: number;
		overall: number;
		employeeId: string;
	};
	user?: Pick<IUser, 'name' | 'imageUrl'>;
}

export interface IGetCountsStatistics
	extends IBasePerTenantAndOrganizationEntityModel {
	date?: Date;
	onlyMe?: boolean;
	startDate?: Date | string;
	endDate?: Date | string;
	employeeId?: string;
	projectId?: string;
}

export interface ICountsStatistics {
	employeesCount: number;
	projectsCount: number;
	weekActivities: number;
	weekDuration: number;
	todayActivities: number;
	todayDuration: number;
}
