import { BrowserWindow } from 'electron';
import { TrackingSleepStrategy } from '../abstracts/tracking-sleep.strategy';

export class RemoteTrackingSleep extends TrackingSleepStrategy {
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
