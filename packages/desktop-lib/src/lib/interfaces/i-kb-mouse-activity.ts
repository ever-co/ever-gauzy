export interface IKbMouseActivityService<T> {
	save(activities: T): Promise<void>;
	retrieve(): Promise<T>;
	remove(activity: T): Promise<void>;
	update(activities: Partial<T>): Promise<void>;
}

export type TTimeSlot = {
	employeeId: string,
	projectId?: string,
	duration: number,
	keyboard: number,
	mouse: number,
	overall: number,
	startedAt: string,
	activities: any,
	timeLogId?: string,
	organizationId: string,
	tenantId: string,
	organizationContactId?: string,
	recordedAt: string
}
