import { BrowserWindow } from 'electron';
import { TrackingSleepStrategy } from '../abstracts/tracking-sleep.strategy';

export class RemoteTrackingSleep extends TrackingSleepStrategy {
	constructor(window: BrowserWindow) {
		super(window);
	}

	/**
	 * @override
	 */
	public override resume(): void {
		this._window.webContents.send('sleep_remote_lock', false);
	}

	/**
	 * @override
	 */
	public override pause(): void {
		this._window.webContents.send('sleep_remote_lock', true);
	}

	/**
	 * @override
	 */
	public override dispose(): void {
		this._window.webContents.removeAllListeners('sleep_remote_lock');
	}
}
