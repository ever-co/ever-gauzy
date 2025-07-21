/**
 * Service interface for managing keyboard and mouse activity data.
 * @template T The type of activity data being managed
*/
export interface IKbMouseActivityService<T> {
	save(activities: T): Promise<void>;
	retrieve(remoteId: string, organizationId: string, tenantId: string): Promise<T>;
	remove(activity: T): Promise<void>;
	update(activities: Partial<T>): Promise<void>;
}

/**
 * Represents a time slot record with keyboard and mouse activity metrics.
 * Used for tracking user activity during specific time periods.
 */
export type TTimeSlot = {
	employeeId: string,
	projectId?: string,
	duration: number,
	keyboard: number,
	mouse: number,
	overall: number,
	startedAt: string,
	activities: Record<string, unknown>[],
	timeLogId?: string,
	organizationId: string,
	tenantId: string,
	organizationContactId?: string,
	recordedAt: string
}
