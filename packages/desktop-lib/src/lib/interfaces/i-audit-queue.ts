/**
 * Service interface for managing keyboard and mouse activity data.
 * @template T The type of activity data being managed
*/
export interface IAuditQueueService<T> {
	save(queue: T): Promise<void>;
	retrieve(id: string): Promise<T>;
	remove(queue: T): Promise<void>;
	update(queue: Partial<T>): Promise<void>;
}

/**
 * Represents a time slot record with keyboard and mouse activity metrics.
 * Used for tracking user activity during specific time periods.
 */
export type TAuditQueue = {
	queue: string,
	id?: string,
	status: string,
	attempts: number,
	priority: number,
	data: Record<string, unknown>,
	created_at: Date,
	started_at?: Date,
	finished_at?: Date,
	last_error?: string
}
