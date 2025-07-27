import { TrackingSleepStrategy } from '../abstracts/tracking-sleep.strategy';

export class ControlledTrackingSleep extends TrackingSleepStrategy {
	/**
	 * @override
	 */
	public override resume(): void {
		this._window.webContents.send('start_from_inactivity_handler');
	}

	/**
	 * @override
	 */
	public override pause(): void {
		this._window.webContents.send('stop_from_inactivity_handler');
	}

	/**
	 * @override
	 */
	public override dispose(): void {
		this._window.webContents.removeAllListeners('start_from_inactivity_handler');
		this._window.webContents.removeAllListeners('stop_from_inactivity_handler');
	}
}
