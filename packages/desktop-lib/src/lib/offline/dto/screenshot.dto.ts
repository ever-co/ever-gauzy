export interface ScreenshotTO {
	id?: number;
	timeslotId?: string;
	activityId?: number;
	imagePath?: string;
	recordedAt?: Date;
	synced?: boolean;
}

export const TABLE_NAME_SCREENSHOT: string = 'desktop_screenshot';
