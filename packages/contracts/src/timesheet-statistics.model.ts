import { IUser } from './user.model';
import { IEmployee, IEmployeeEntityInput } from './employee.model';
import { ITask } from './task.model';
import { ITimeSlot, ITimeLog, ITimeLogFilters, ITimeLogTodayFilters } from './timesheet.model';
import { IOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationTeam } from './organization-team.model';

export interface IGetTimeSlotStatistics extends ITimeLogFilters {
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

export interface IGetActivitiesStatistics extends ITimeLogFilters {
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

export interface IGetProjectsStatistics extends ITimeLogFilters {
	employeeId?: string;
	projectId?: string | string[];
	onlyMe?: boolean;
}

export interface IProjectsStatistics extends IOrganizationProject {
	duration?: number;
	durationPercentage?: number;
}

export interface IGetTasksStatistics
	extends ITimeLogFilters,
		ITimeLogTodayFilters,
		Pick<IRelationalOrganizationTeam, 'organizationTeamId'>,
		Pick<IEmployeeEntityInput, 'employeeId'> {
	projectId?: string | string[];
	onlyMe?: boolean;
	take?: number;
}

export interface ITasksStatistics extends ITask {
	duration?: number;
	durationPercentage?: number;
}

export interface IGetManualTimesStatistics extends ITimeLogFilters {
	employeeId?: string;
	projectId?: string | string[];
	onlyMe?: boolean;
}

export interface IManualTimesStatistics
	extends Pick<ITimeLog, 'id' | 'startedAt' | 'duration' | 'employeeId' | 'employee'> {
	user?: Pick<IUser, 'name' | 'imageUrl'>;
	project?: Pick<IOrganizationProject, 'name' | 'imageUrl'>;
}

export interface IGetMembersStatistics extends ITimeLogFilters, ITimeLogTodayFilters {
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

export interface IGetCountsStatistics extends ITimeLogFilters, ITimeLogTodayFilters {
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
	startDate: Date;
	endDate: Date;
	isCustomDate?: boolean;
}
