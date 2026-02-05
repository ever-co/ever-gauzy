export enum SyncState {
	PENDING = 'pending',
	SYNCING = 'syncing',
	SYNCED = 'synced',
	FAILED = 'failed'
}

export interface TimerTO {
	id?: number;
	day?: Date;
	duration?: number;
	employeeId?: string;
	projectId?: string;
	taskId?: string;
	timelogId?: string;
	timesheetId?: string;
	timeslotId?: string;
	startedAt?: Date;
	stoppedAt?: Date;
	synced?: boolean;
	isStartedOffline?: boolean;
	isStoppedOffline?: boolean;
	version?: string;
	organizationTeamId?: string;
	description?: string;
	startSyncState?: SyncState;
	stopSyncState?: SyncState;
	syncDuration?: number;
}

export const TABLE_NAME_TIMERS: string = 'timers';
