export interface ITimerCallbackPayload {
	id?: number;
	timerId: number;
	attempts: number;
	isRetry?: boolean;
	queue: TQueueName;
	data: {
		startedAt: string;
		stoppedAt: string;
		isStopped?: boolean;
	}
}

export interface ITimeslotQueuePayload {
	id?: number;
	activityId: number;
	attempts: number;
	isRetry?: boolean;
	queue: TQueueName;
	data: {
		timeStart: string;
		timeEnd: string;
		afkDuration: number;
	}
}

export interface IScreenshotQueuePayload {
	id?: string;
	screenshotId: string;
	queue: TQueueName;
	isRetry?: boolean;
	attempts: number;
	data: {
		imagePath: string;
		timeSlotId: string;
		activityId: number;
		recordedAt: string;
		id?: number
	}
}

export type TQueueName = 'timer' | 'time_slot' | 'screenshot' | 'timer_retry' | 'time_slot_retry' | 'screenshot_retry'

export interface IQueueUpdatePayload {
	id: string;
	type: 'queued' | 'running' | 'succeeded' | 'progress' | 'failed';
	err?: string;
	data?: any;
	queue: TQueueName;
}
