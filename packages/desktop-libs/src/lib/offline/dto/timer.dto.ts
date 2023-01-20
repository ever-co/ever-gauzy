export interface TimerTO {
	id?: number;
	day: Date;
	duration: number;
	employeeId: number;
	projectId: string;
	taskId: string;
	timelogId: string;
	timesheetId: string;
	timeslotId: string;
}

export const TABLE_NAME_TIMERS: string = 'timers';
