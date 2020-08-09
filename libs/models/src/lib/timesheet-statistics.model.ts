export interface GetTimeSlotStatistics {
	employeeId?: string;
	organizationId: string;
}

export interface GetActivitiesStatistics {
	employeeId?: string;
	organizationId: string;
	date?: Date;
}

export interface GetProjectsStatistics {
	organizationId: string;
	employeeId?: string;
}

export interface GetTasksStatistics {
	organizationId: string;
	employeeId?: string;
}

export interface GetMembersStatistics {
	organizationId: string;
}
