
/**
 * Service interface for managing keyboard and mouse activity data.
 * @template T The type of activity data being managed
*/
export interface IScreenshotService<T> {
	save(activities: T): Promise<void>;
	findUnsyncScreenshot(activityId: number): Promise<T[]>;
	remove(activity: T): Promise<void>;
	update(activities: Partial<T>): Promise<void>;
}
