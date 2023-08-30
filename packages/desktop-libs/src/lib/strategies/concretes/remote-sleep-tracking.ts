import { BrowserWindow } from 'electron';
import { SleepTrackingStrategy } from '../abstracts/sleep-tracking-strategy';

export class RemoteSleepTracking extends SleepTrackingStrategy {
	constructor(window: BrowserWindow) {
		super(window);
	}

	/**
	 * @override
	 */
	public resume(): void {
		this._window.webContents.send('sleep_remote_lock', false);
	}

	/**
	 * @override
	 */
	public pause(): void {
		this._window.webContents.send('sleep_remote_lock', true);
	}
}
