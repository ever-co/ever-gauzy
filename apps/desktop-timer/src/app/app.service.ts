import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { firstValueFrom } from 'rxjs';
import { UserOrganizationService } from '@gauzy/desktop-ui-lib';

@Injectable({
	providedIn: 'root',
})
export class AppService {
	AW_HOST = environment.AWHost;
	buckets: any = {};
	constructor(
		private http: HttpClient,
		private readonly _userOrganizationService: UserOrganizationService
	) {}

	pingServer(values) {
		return firstValueFrom(this.http.get(values.host + '/api'));
	}

	startTime(id): Promise<any> {
		const defaultValue: any = [
			{
				timestamp: new Date(),
				data: {
					running: true,
					label: '',
				},
			},
		];

		if (id) defaultValue[0].id = id;
		return firstValueFrom(
			this.http.post(
				`${this.AW_HOST}/api/0/buckets/aw-stopwatch/events`,
				defaultValue
			)
		);
	}

	stopTime(historyTime): Promise<any> {
		const defaultStopParams = [
			{
				timestamp: new Date(),
				data: {
					running: false,
					label: '',
				},
				id: historyTime.id,
			},
		];
		return firstValueFrom(
			this.http.post(
				`${this.AW_HOST}/api/0/buckets/aw-stopwatch/events`,
				defaultStopParams
			)
		);
	}

	getAwBuckets(tpURL): Promise<any> {
		return firstValueFrom(this.http.get(`${tpURL}/api/0/buckets`));
	}

	parseBuckets(buckets) {
		Object.keys(buckets).forEach((key) => {
			const keyParse = key.split('_')[0];
			switch (keyParse) {
				case 'aw-watcher-window':
					this.buckets.windowBucket = buckets[key];
					break;
				case 'aw-watcher-afk':
					this.buckets.afkBucket = buckets[key];
					break;
				case 'aw-watcher-web-chrome':
					this.buckets.chromeBucket = buckets[key];
					break;
				case 'aw-watcher-web-firefox':
					this.buckets.firefoxBucket = buckets[key];
					break;
				default:
					break;
			}
		});
	}

	async collectEvents(tpURL, tp, start, end): Promise<any> {
		if (!this.buckets.windowBucket) {
			const allBuckets = await this.getAwBuckets(tpURL);
			this.parseBuckets(allBuckets);
		}
		return this.collectFromAW(tpURL, start, end);
	}

	collectAfk(tpURL, tp, start, end): Promise<any> {
		return this.collectAfkFromAW(tpURL, start, end);
	}

	collectChromeActivityFromAW(tpURL, start, end): Promise<any> {
		if (!this.buckets.chromeBucket) return Promise.resolve([]);
		return firstValueFrom(
			this.http.get(
				`${tpURL}/api/0/buckets/${this.buckets.chromeBucket.id}/events?start=${start}&end=${end}&limit=-1`
			)
		);
	}

	collectFirefoxActivityFromAw(tpURL, start, end): Promise<any> {
		if (!this.buckets.firefoxBucket) return Promise.resolve([]);
		return firstValueFrom(
			this.http.get(
				`${tpURL}/api/0/buckets/${this.buckets.firefoxBucket.id}/events?start=${start}&end=${end}&limit=-1`
			)
		);
	}

	pushActivityCollectionToGauzy() {
		return true;
	}
	collectFromAW(tpURL, start, end) {
		if (!this.buckets.windowBucket) return Promise.resolve([]);
		return firstValueFrom(
			this.http.get(
				`${tpURL}/api/0/buckets/${this.buckets.windowBucket.id}/events?start=${start}&end=${end}&limit=-1`
			)
		);
	}

	collectAfkFromAW(tpURL, start, end) {
		if (!this.buckets.afkBucket) return Promise.resolve([]);
		return firstValueFrom(
			this.http.get(
				`${tpURL}/api/0/buckets/${this.buckets.afkBucket.id}/events?limit=1`
			)
		);
	}

	async getUserDetail(values) {
		return this._userOrganizationService.detail(values);
	}
}
