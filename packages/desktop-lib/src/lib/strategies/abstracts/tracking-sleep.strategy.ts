import { BrowserWindow } from 'electron';
import { ITrackingSleepStrategy } from '../../interfaces';

export abstract class TrackingSleepStrategy implements ITrackingSleepStrategy {
	constructor(protected readonly _window: BrowserWindow) {}

	public abstract resume(): void;

	public abstract pause(): void;

	public abstract dispose(): void;
}
