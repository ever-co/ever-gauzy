import { User } from './user.model';
import { Employee } from './employee.model';
import { TimeSlot } from 'apps/api/src/app/timesheet/time-slot.entity';
import { OrganizationProjects } from 'apps/api/src/app/organization-projects/organization-projects.entity';
import { Task } from './task-entity.model';
import { TimeLog } from 'apps/api/src/app/timesheet/time-log.entity';

export interface GetTimeSlotStatistics {
	employeeId?: string;
	organizationId: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface TimeSlotStatistics extends Employee {
	user_name?: string;
	startedAt?: Date;
	user_image_url?: string;
	timeSlots?: TimeSlot[];
	user: Pick<User, 'name' | 'imageUrl'>;
}

export interface GetActivitiesStatistics {
	employeeId?: string;
	organizationId: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface ActivitiesStatistics {
	durationPercentage?: number;
	duration?: number;
	title?: string;
	sessions?: number;
}

export interface GetProjectsStatistics {
	organizationId: string;
	employeeId?: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface ProjectsStatistics extends OrganizationProjects {
	duration?: number;
	durationPercentage?: number;
}

export interface GetTasksStatistics {
	organizationId: string;
	employeeId?: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface TasksStatistics extends Task {
	duration?: number;
	durationPercentage?: number;
}

export interface GetManualTimesStatistics {
	organizationId: string;
	employeeId?: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface ManualTimesStatistics
	extends Pick<TimeLog, 'id' | 'startedAt' | 'duration'> {
	user?: Pick<User, 'name' | 'imageUrl'>;
	project?: Pick<OrganizationProjects, 'name'>;
}

export interface GetMembersStatistics {
	organizationId: string;
	date?: Date;
}

export interface MembersStatistics {
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
	user?: Pick<User, 'name' | 'imageUrl'>;
}

export interface GetCountsStatistics {
	organizationId: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface CountsStatistics {
	employeesCount: number;
	projectsCount: number;
	weekActivites: number;
	weekDuration: number;
	todayActivites: number;
	todayDuration: number;
}
