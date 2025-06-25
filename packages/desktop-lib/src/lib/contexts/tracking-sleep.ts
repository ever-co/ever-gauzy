import { ITrackingSleep, ITrackingSleepStrategy } from '../interfaces';
import { LocalStore } from '../desktop-store';
import { AlwaysTrackingSleep, NeverTrackingSleep } from '../strategies';
import { BrowserWindow } from 'electron';

export class TrackingSleep implements ITrackingSleep {
	private readonly _alwaysTrackingSleep: ITrackingSleepStrategy;
	private readonly _neverTrackingSleep: ITrackingSleepStrategy;

	constructor(window: BrowserWindow) {
		this._alwaysTrackingSleep = new AlwaysTrackingSleep(window);
		this._neverTrackingSleep = new NeverTrackingSleep(window);
	}

	get strategy(): ITrackingSleepStrategy {
		return this._isTrackingSleep ? this._alwaysTrackingSleep : this._neverTrackingSleep;
	}

	private get _isTrackingSleep(): boolean {
		const setting = LocalStore.getStore('appSetting');
		return setting ? setting.trackOnPcSleep : false;
	}
}
