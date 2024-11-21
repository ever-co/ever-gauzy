import { BrowserWindow } from 'electron';
import { ISleepTracking } from './i-sleep-tracking';

export interface IPowerManager {
	pauseTracking(): void;

	resumeTracking(): void;

	get isOnBattery(): boolean;

	get trackerStatusActive(): boolean;

	get sleepTracking(): ISleepTracking;

	set sleepTracking(value: ISleepTracking);

	get window(): BrowserWindow;

	get suspendDetected(): boolean;
}
