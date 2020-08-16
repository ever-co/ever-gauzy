export interface GetTimeSlotStatistics {
	employeeId?: string;
	organizationId: string;
	date?: Date;
}

export interface GetActivitiesStatistics {
	employeeId?: string;
	organizationId: string;
	date?: Date;
}

export interface GetProjectsStatistics {
	organizationId: string;
	employeeId?: string;
	date?: Date;
}

export interface GetTasksStatistics {
	organizationId: string;
	employeeId?: string;
	date?: Date;
}

export interface GetMembersStatistics {
	organizationId: string;
	date?: Date;
}
