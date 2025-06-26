import { ITrackingSleepStrategy } from '../../interfaces';
import { BrowserWindow } from 'electron';

export abstract class TrackingSleepStrategy implements ITrackingSleepStrategy {
	protected _window: BrowserWindow;

	protected constructor(window: BrowserWindow) {
		this._window = window;
	}

	public abstract resume(): void;

	public abstract pause(): void;

	public abstract dispose(): void;
}
