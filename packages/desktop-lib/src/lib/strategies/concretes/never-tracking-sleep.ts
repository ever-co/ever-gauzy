import { BrowserWindow } from 'electron';
import { TrackingSleepStrategy } from '../abstracts/tracking-sleep.strategy';

export class NeverTrackingSleep extends TrackingSleepStrategy {
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

	/**
	 * @override
	 */
	public override dispose(): void {
		this._window.webContents.removeAllListeners('device_sleep');
	}
}
