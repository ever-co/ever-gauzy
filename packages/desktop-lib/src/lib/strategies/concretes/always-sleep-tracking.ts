import { BrowserWindow } from 'electron';
import { SleepTrackingStrategy } from '../abstracts/sleep-tracking-strategy';

export class AlwaysSleepTracking extends SleepTrackingStrategy {
	constructor(window: BrowserWindow) {
		super(window);
	}

	/**
	 * @override
	 */
	resume(): void {
		this._window.webContents.send('device_wake_up');
	}

	/**
	 * @override
	 */
	public pause(): void {
		// Do nothing
	}
}
