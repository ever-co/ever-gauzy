import { TrackingSleepStrategy } from '../abstracts/tracking-sleep.strategy';

export class AlwaysTrackingSleep extends TrackingSleepStrategy {
	/**
	 * @override
	 */
	public override resume(): void {
		this._window.webContents.send('device_wake_up');
	}

	/**
	 * @override
	 */
	public override pause(): void {
		// Do nothing
	}

	/**
	 * @override
	 */
	public override dispose(): void {
		this._window.webContents.removeAllListeners('device_wake_up');
	}
}
