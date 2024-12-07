import {ISleepTrackingStrategy} from "./i-sleep-tracking-strategy";

export interface ISleepTracking {
	get strategy(): ISleepTrackingStrategy;

	set strategy(value: ISleepTrackingStrategy);
}
