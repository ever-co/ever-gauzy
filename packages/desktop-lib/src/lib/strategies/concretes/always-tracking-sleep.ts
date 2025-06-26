import { BrowserWindow } from 'electron';
import { TrackingSleepStrategy } from '../abstracts/tracking-sleep.strategy';

export class AlwaysTrackingSleep extends TrackingSleepStrategy {
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

	/**
	 * @override
	 */
	public override dispose(): void {
		this._window.webContents.removeAllListeners('device_wake_up');
	}
}
