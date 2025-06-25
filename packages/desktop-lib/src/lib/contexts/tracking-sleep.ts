import {ITrackingSleep, ITrackingSleepStrategy} from "../interfaces";
import {LocalStore} from "../desktop-store";
import {AlwaysTrackingSleep, NeverTrackingSleep} from "../strategies";
import {BrowserWindow} from "electron";

export class TrackingSleep implements ITrackingSleep {
	private readonly _alwaysSleepTracking: ITrackingSleepStrategy;
	private readonly _neverSleepTracking: ITrackingSleepStrategy;

	constructor(window: BrowserWindow) {
		this._alwaysSleepTracking = new AlwaysTrackingSleep(window);
		this._neverSleepTracking = new NeverTrackingSleep(window);
	}

	get strategy(): ITrackingSleepStrategy {
		return this._isTrackingOnSleep ? this._alwaysSleepTracking : this._neverSleepTracking;
	}

	private get _isTrackingOnSleep(): boolean {
		const setting = LocalStore.getStore('appSetting');
		return setting ? setting.trackOnPcSleep : false;
	}
}
