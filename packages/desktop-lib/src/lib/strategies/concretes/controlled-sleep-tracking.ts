import {SleepTrackingStrategy} from "../abstracts/sleep-tracking-strategy";
import {BrowserWindow} from "electron";

export class ControlledSleepTracking extends SleepTrackingStrategy {

	constructor(window: BrowserWindow) {
		super(window);
	}

	/**
	 * @override
	 */
	resume(): void {
		this._window.webContents.send('start_from_inactivity_handler');
	}

	/**
	 * @override
	 */
	pause(): void {
		this._window.webContents.send('stop_from_inactivity_handler');
	}
}
