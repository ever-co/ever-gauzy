export interface AuditQueueTO {
	id?: number;
	queue_id: string;
	queue: string;
	status: string;
	attempts: number;
	priority: number;
	data: Record<string, unknown> | string;
	created_at: Date;
	started_at?: Date;
	finished_at?: Date;
	last_error?: string;
}

export const TABLE_NAME_AUDIT_QUEUE: string = 'audit_queue';
