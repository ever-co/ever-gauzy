export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'PROCESS';

export interface LogEntry {
	id: string;
	ts: string;
	level: LogLevel;
	msg: string;
}

export interface QueueItem {
	id?: string;
	queue_id: string;
	queue?: string;
	status?: string;
	attempts?: number;
	priority?: number;
	data?: Record<string, unknown> | string;
	created_at?: Date;
	action: 'update' | 'add';
	last_error: string;
}

export interface SyncHealth {
	queueLength: number;
	lastSuccessAt?: string;
	apiReachable: boolean;
}
