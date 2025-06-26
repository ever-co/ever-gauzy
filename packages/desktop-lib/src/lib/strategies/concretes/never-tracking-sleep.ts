import { TrackingSleepStrategy } from '../abstracts/tracking-sleep.strategy';

export class NeverTrackingSleep extends TrackingSleepStrategy {
	/**
	 * @override
	 */
	public override resume(): void {
		// Do nothing
	}

	/**
	 * @override
	 */
	public override pause(): void {
		this._window.webContents.send('device_sleep');
	}

	/**
	 * @override
	 */
	public override dispose(): void {
		this._window.webContents.removeAllListeners('device_sleep');
	}
}
