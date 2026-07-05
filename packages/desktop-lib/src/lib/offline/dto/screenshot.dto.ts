export interface ScreenshotTO {
	id?: number;
	timeslotId?: string;
	activityId?: number;
	imagePath?: string;
	recordedAt?: Date;
	synced?: boolean;
	message?: string;
	retries?: number;
	lastAttemptAt?: Date;
}

export const TABLE_NAME_SCREENSHOT: string = 'desktop_screenshot';
