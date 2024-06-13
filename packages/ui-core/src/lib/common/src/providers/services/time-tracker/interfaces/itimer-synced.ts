import { ITimeLog, TimeLogSourceEnum } from '@gauzy/contracts';

export interface ITimerSynced {
	source: TimeLogSourceEnum;
	running: boolean;
	startedAt: Date;
	stoppedAt: Date;
	lastLog: ITimeLog;
	isExternalSource: boolean;
}
