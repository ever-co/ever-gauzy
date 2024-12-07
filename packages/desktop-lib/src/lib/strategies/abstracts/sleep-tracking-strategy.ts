import {ISleepTrackingStrategy} from "../../interfaces";
import {BrowserWindow} from "electron";

export abstract class SleepTrackingStrategy implements ISleepTrackingStrategy {
	protected _window: BrowserWindow;

	protected constructor(window: BrowserWindow) {
		this._window = window;
	}

	public abstract resume(): void;

	public abstract pause(): void;
}
