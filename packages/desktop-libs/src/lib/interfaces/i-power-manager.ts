import {ISleepTracking} from "./i-sleep-tracking";
import {BrowserWindow} from "electron";

export interface IPowerManager {
	pauseTracking(): void;

	resumeTracking(): void;

	get trackerStatusActive(): boolean;

	get sleepTracking(): ISleepTracking;

	set sleepTracking(value: ISleepTracking);

	get window(): BrowserWindow;
}
