import { IUser } from './user.model';
import { IEmployee } from './employee.model';
import { ITask } from './task-entity.model';
import { ITimeSlot, ITimeLog, ITimeLogFilters } from './timesheet.model';
import { IOrganizationProject } from './organization-projects.model';
import { IOrganization } from './organization.model';
import { ITenant } from './tenant.model';

export interface IGetTimeSlotStatistics 
	extends ITimeLogFilters {
	employeeId?: string;
	projectId?: string | string[];
	onlyMe?: boolean;
}

export interface ITimeSlotStatistics extends IEmployee {
	user_name?: string;
	startedAt?: Date;
	user_image_url?: string;
	timeSlots?: ITimeSlot[];
	user: Pick<IUser, 'name' | 'imageUrl'>;
}

export interface IGetActivitiesStatistics 
	extends ITimeLogFilters {
	employeeId?: string;
	projectId?: string | string[];
	onlyMe?: boolean;
}

export interface IActivitiesStatistics {
	durationPercentage?: number;
	duration?: number;
	title?: string;
	sessions?: number;
}

export interface IGetProjectsStatistics 
	extends ITimeLogFilters {
	employeeId?: string;
	projectId?: string | string[];
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
	extends ITimeLogFilters {
	employeeId?: string;
	projectId?: string | string[];
	onlyMe?: boolean;
}

export interface ITasksStatistics extends ITask {
	duration?: number;
	durationPercentage?: number;
}

export interface IGetManualTimesStatistics
	extends ITimeLogFilters {
	employeeId?: string;
	projectId?: string | string[];
	onlyMe?: boolean;
}

export interface IManualTimesStatistics
	extends Pick<ITimeLog, 'id' | 'startedAt' | 'duration'> {
	user?: Pick<IUser, 'name' | 'imageUrl'>;
	project?: Pick<IOrganizationProject, 'name'>;
}

export interface IGetMembersStatistics
	extends ITimeLogFilters {
	employeeId?: string;
	projectId?: string | string[];
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

export interface IGetCountsStatistics extends ITimeLogFilters {
	onlyMe?: boolean;
	employeeId?: string;
	projectId?: string | string[];
}

export interface ICountsStatistics {
	employeesCount: number;
	projectsCount: number;
	weekActivities: number;
	weekDuration: number;
	todayActivities: number;
	todayDuration: number;
}

export interface ISelectedDateRange {
	start: Date;
	end: Date;
	isCustomDate?: boolean;
}