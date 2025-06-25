import {ITrackingSleep, ITrackingSleepStrategy} from "../interfaces";

export class TrackingSleepInactivity implements ITrackingSleep {
	constructor(strategy: ITrackingSleepStrategy) {
		this._strategy = strategy;
	}

	private _strategy: ITrackingSleepStrategy;

	public get strategy(): ITrackingSleepStrategy {
		return this._strategy;
	}

	public set strategy(value: ITrackingSleepStrategy) {
		this._strategy = value;
	}
}
