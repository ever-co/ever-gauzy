
/**
 * Service interface for managing screenshot data.
 * @template T The type of screenshot data being managed
*/
export interface IScreenshotService<T> {
	save(activities: T): Promise<void>;
	findUnSyncedScreenshot(activityId: number): Promise<T[]>;
	remove(activity: T): Promise<void>;
	update(activities: Partial<T>): Promise<void>;
}
