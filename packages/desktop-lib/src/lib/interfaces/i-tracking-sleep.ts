import { ITrackingSleepStrategy } from "./i-tracking-sleep-strategy";

export interface ITrackingSleep {
	get strategy(): ITrackingSleepStrategy;

	set strategy(value: ITrackingSleepStrategy);
}
