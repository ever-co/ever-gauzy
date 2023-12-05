import { IActivityWatchBucketWatcherList } from '@gauzy/contracts';
import { IParseBucketsResult } from './i-activity-watch';

export class ActivityWatchUtil {
	public static parseBuckets(buckets: IActivityWatchBucketWatcherList): IParseBucketsResult {
		const parsedBuckets: IParseBucketsResult = {
			windowBucket: null,
			afkBucket: null,
			chromeBucket: null,
			firefoxBucket: null
		};
		Object.keys(buckets).forEach((key) => {
			const keyParse = key.split('_')[0];
			switch (keyParse) {
				case 'aw-watcher-window':
					parsedBuckets.windowBucket = buckets[key];
					break;
				case 'aw-watcher-afk':
					parsedBuckets.afkBucket = buckets[key];
					break;
				case 'aw-watcher-web-chrome':
					parsedBuckets.chromeBucket = buckets[key];
					break;
				case 'aw-watcher-web-firefox':
					parsedBuckets.firefoxBucket = buckets[key];
					break;
				default:
					break;
			}
		});
		return parsedBuckets;
	}
}
