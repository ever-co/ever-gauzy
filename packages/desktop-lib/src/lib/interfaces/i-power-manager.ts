import { BrowserWindow } from 'electron';
import { ITrackingSleep } from './i-tracking-sleep';

export interface IPowerManager {
	pauseTracking(): void;

	resumeTracking(): void;

	get isOnBattery(): boolean;

	get trackerStatusActive(): boolean;

	get trackingSleep(): ITrackingSleep;

	set trackingSleep(value: ITrackingSleep);

	get window(): BrowserWindow;

	get suspendDetected(): boolean;

	/**
	 * Dispose and cleanup resources/event handlers
	 */
	dispose(): void;
}
