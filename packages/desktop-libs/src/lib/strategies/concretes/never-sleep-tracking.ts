import {BrowserWindow} from "electron";
import {SleepTrackingStrategy} from "../abstracts/sleep-tracking-strategy";

export class NeverSleepTracking extends SleepTrackingStrategy {

	constructor(window: BrowserWindow) {
		super(window);
	}
}
