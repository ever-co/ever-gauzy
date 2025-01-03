import { BaseTO } from './base.dto';

export interface IntervalTO extends BaseTO {
	activities: any;
	duration: number;
	employeeId: string;
	keyboard: number;
	mouse: number;
	organizationContactId: string;
	overall: number;
	projectId: string;
	screenshots: Blob[];
	startedAt: Date;
	stoppedAt: Date;
	synced: boolean;
	timerId: number;
	isDeleted: boolean;
}

export const TABLE_NAME_INTERVALS = 'intervals';
