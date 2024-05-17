import { Injectable } from '@angular/core';
import { IActivityWatchEventService } from './i-activity-watch';
import { firstValueFrom } from 'rxjs';
import { API_ACTIVITY_WATCH_PREFIX } from '../../constants';
import { HttpClient } from '@angular/common/http';
import {
	IActivityWatchAfkEvent,
	IActivityWatchBucketWatcherList,
	IActivityWatchWebEvent,
	IActivityWatchWindowEvent,
	IDateRange
} from '@gauzy/contracts';
import { ActivityWatchUtil } from './activity-watch.util';
import { toParams } from '@gauzy/ui-sdk/common';

type BucketType = keyof ReturnType<(typeof ActivityWatchUtil)['parseBuckets']>;

@Injectable({
	providedIn: 'root'
})
export class ActivityWatchEventService implements IActivityWatchEventService {
	constructor(private http: HttpClient) {}

	private buckets(): Promise<IActivityWatchBucketWatcherList> {
		return firstValueFrom(this.http.get<IActivityWatchBucketWatcherList>(`${API_ACTIVITY_WATCH_PREFIX}/`));
	}

	private async collectEvents<IBucketEvent>(bucket: BucketType, range: IDateRange): Promise<IBucketEvent[]> {
		const params = toParams({
			start: range.start.toISOString(),
			end: range.end.toISOString()
		});
		const bucketId = await this.bucketId(bucket);
		if (!bucketId) return [];
		return firstValueFrom(
			this.http.get<IBucketEvent[]>(`${API_ACTIVITY_WATCH_PREFIX}/${bucketId}/events`, {
				params
			})
		);
	}

	private async bucketId(bucket: BucketType): Promise<string> {
		const buckets = await this.buckets();
		if (!buckets) return null;
		return ActivityWatchUtil.parseBuckets(buckets)[bucket]?.id;
	}

	public async collectAfkEvents(range: IDateRange): Promise<IActivityWatchAfkEvent[]> {
		return this.collectEvents('afkBucket', range);
	}

	public async collectChromeEvents(range: IDateRange): Promise<IActivityWatchWebEvent[]> {
		return this.collectEvents('chromeBucket', range);
	}

	public async collectFirefoxEvents(range: IDateRange): Promise<IActivityWatchWebEvent[]> {
		return this.collectEvents('firefoxBucket', range);
	}

	public async collectWindowsEvents(range: IDateRange): Promise<IActivityWatchWindowEvent[]> {
		return this.collectEvents('windowBucket', range);
	}

	public async ping(): Promise<boolean> {
		try {
			const buckets = await this.buckets();
			return !!buckets;
		} catch (_) {
			return false;
		}
	}

	public collectEdgeEvents(range: IDateRange): Promise<IActivityWatchWebEvent[]> {
		return this.collectEvents('edgeBucket', range);
	}
}
