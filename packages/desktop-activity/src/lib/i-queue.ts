export interface ITimerCallbackPayload {
	id?: number;
	timerId: number;
	attempts: number;
	queue: 'timer' | 'time_slot' | 'screenshot';
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
	queue: 'timer' | 'time_slot' | 'screenshot';
	data: {
		timeStart: string;
		timeEnd: string;
		afkDuration: number;
	}
}

export interface IScreenshotQueuePayload {
	id?: string;
	screenshotId: string;
	queue: 'timer' | 'time_slot' | 'screenshot';
	attempts: number;
	data: {
		imagePath: string;
		timeSlotId: string;
		recordedAt: string;
	}
}

export interface IQueueUpdatePayload {
	id: string;
	type: 'queued' | 'running' | 'succeeded' | 'progress' | 'failed';
	err?: string;
	data?: any;
	queue: 'timer' | 'time_slot' | 'screenshot';
}
