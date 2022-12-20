export class IntervalTO {
	id?: number;
	activities: any;
	b64Imgs: any;
	duration: number;
	employeeId: string;
	keyboard: number;
	mouse: number;
	organizationContactId: string;
	organizationId: string;
	overall: number;
	projectId: string;
	startAt: Date;
	startedAt: Date;
	synced: boolean;
	tenantId: string;
	timeLogId: string;
	token: any;
	apiHost: string;
}

export const TABLE_NAME_INTERVAL: string = 'intervals';
