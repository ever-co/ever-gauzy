import {BrowserWindow} from "electron";
import {SleepTrackingStrategy} from "../abstracts/sleep-tracking-strategy";

export class NeverSleepTracking extends SleepTrackingStrategy {
	constructor(window: BrowserWindow) {
		super(window);
	}

	/**
	 * @override
	 */
	public resume(): void {
		// Do nothing
	}

	/**
	 * @override
	 */
	pause(): void {
		this._window.webContents.send('device_sleep');
	}
}
