import {ISleepTracking, ISleepTrackingStrategy} from "../interfaces";
import {LocalStore} from "../desktop-store";
import {AlwaysSleepTracking, NeverSleepTracking} from "../strategies";
import {BrowserWindow} from "electron";

export class SleepTracking implements ISleepTracking {
	private readonly _alwaysSleepTracking: ISleepTrackingStrategy;
	private readonly _neverSleepTracking: ISleepTrackingStrategy;

	constructor(window: BrowserWindow) {
		this._alwaysSleepTracking = new AlwaysSleepTracking(window);
		this._neverSleepTracking = new NeverSleepTracking(window);
	}

	get strategy(): ISleepTrackingStrategy {
		return this._isTrackingOnSleep ? this._alwaysSleepTracking : this._neverSleepTracking;
	}

	private get _isTrackingOnSleep(): boolean {
		const setting = LocalStore.getStore('appSetting');
		return setting ? setting.trackOnPcSleep : false;
	}
}
