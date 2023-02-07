export interface TimerTO {
	id?: number;
	day?: Date;
	duration?: number;
	employeeId?: number;
	projectId?: string;
	taskId?: string;
	timelogId?: string;
	timesheetId?: string;
	timeslotId?: string;
	startedAt?: Date;
	stoppedAt?: Date;
	synced?: boolean;
}

export const TABLE_NAME_TIMERS: string = 'timers';
