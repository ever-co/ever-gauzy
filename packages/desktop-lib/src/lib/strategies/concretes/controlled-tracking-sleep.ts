import {TrackingSleepStrategy} from "../abstracts/tracking-sleep.strategy";
import {BrowserWindow} from "electron";

export class ControlledTrackingSleep extends TrackingSleepStrategy {

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
