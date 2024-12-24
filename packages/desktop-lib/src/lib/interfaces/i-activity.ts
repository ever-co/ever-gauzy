import { TimeLogSourceEnum } from '@gauzy/contracts';

export interface IActivity {
	title: string;
	date: string;
	time: string;
	duration: number;
	type: string;
	taskId: string;
	projectId: string;
	organizationContactId: string;
	organizationId: string;
	employeeId: string;
	source: TimeLogSourceEnum;
	recordedAt: Date;
	metaData: any;
}

export interface IActivityPercentage {
	systemPercentage: number;
	mousePercentage: number;
	keyboardPercentage: number;
}
