export interface ITimerCallbackPayload {
	id?: number;
	timerId: number;
	queue: 'timer' | 'time_slot' | 'screenshot';
	data: {
		startedAt: string;
		stoppedAt: string;
	}
}

export interface ITimeslotQueuePayload {
	id?: number;
	activityId: number;
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
	data: {
		imagePath: string;
		timeSlotId: string;
		recordedAt: string;
	}
}

export interface IQueueUpadtePayload {
	id: string;
	type: 'queued' | 'running' | 'succeeded' | 'progress' | 'failed';
	err?: string;
	data?: any;
	queue: 'timer' | 'time_slot' | 'screenshot';
}
