export interface GetTimeSlotStatistics {
	employeeId?: string;
	organizationId: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface GetActivitiesStatistics {
	employeeId?: string;
	organizationId: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface GetProjectsStatistics {
	organizationId: string;
	employeeId?: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface GetTasksStatistics {
	organizationId: string;
	employeeId?: string;
	date?: Date;
	onlyMe?: boolean;
}

export interface GetMembersStatistics {
	organizationId: string;
	date?: Date;
}
