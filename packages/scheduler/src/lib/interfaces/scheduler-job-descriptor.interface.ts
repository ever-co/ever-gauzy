export type SchedulerJobScheduleType = 'cron' | 'interval' | 'manual';
export type SchedulerJobExecutionTarget = 'inline' | 'queue';

export interface SchedulerJobDescriptor {
	id: string;
	providerName: string;
	methodName: string;
	description?: string;
	enabled: boolean;
	runOnStart: boolean;
	scheduleType: SchedulerJobScheduleType;
	executionTarget: SchedulerJobExecutionTarget;
	cron?: string;
	intervalMs?: number;
	queueName?: string;
	queueJobName?: string;
	running: boolean;
}
