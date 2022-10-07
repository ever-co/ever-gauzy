import {ISleepTracking, ISleepTrackingStrategy} from "../interfaces";

export class SleepInactivityTracking implements ISleepTracking {
	constructor(strategy: ISleepTrackingStrategy) {
		this._strategy = strategy;
	}

	private _strategy: ISleepTrackingStrategy;

	public get strategy(): ISleepTrackingStrategy {
		return this._strategy;
	}

	public set strategy(value: ISleepTrackingStrategy) {
		this._strategy = value;
	}
}
