import {
	IActivityWatchAfkEvent,
	IActivityWatchBucket,
	IActivityWatchWebEvent,
	IActivityWatchWindowEvent,
	IDateRange
} from '@gauzy/contracts';

export interface IParseBucketsResult {
	windowBucket: IActivityWatchBucket;
	afkBucket: IActivityWatchBucket;
	chromeBucket: IActivityWatchBucket;
	firefoxBucket: IActivityWatchBucket;
}

export interface IActivityWatchEventService {
	collectChromeEvents(range: IDateRange): Promise<IActivityWatchWebEvent[]>;

	collectFirefoxEvents(range: IDateRange): Promise<IActivityWatchWebEvent[]>;

	collectAfkEvents(range: IDateRange): Promise<IActivityWatchAfkEvent[]>;

	collectWindowsEvents(range: IDateRange): Promise<IActivityWatchWindowEvent[]>;
}
