import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Observable, pipe } from 'rxjs';
import { environment } from '../environments/environment';
@Injectable({
	providedIn: 'root'
})
export class AppService {
	AW_HOST = environment.AWHost;
	constructor(private http: HttpClient) {}

	startTime(id): Promise<any> {
		console.log('http service hit by start');
		const defaultValue: any = [
			{
				timestamp: new Date(),
				data: {
					running: true,
					label: ''
				}
			}
		];

		if (id) defaultValue[0].id = id;
		return this.http
			.post(
				`${this.AW_HOST}/api/0/buckets/aw-stopwatch/events`,
				defaultValue
			)
			.pipe()
			.toPromise();
	}

	stopTime(historyTime): Promise<any> {
		console.log('stoped id', historyTime);
		const defaultStopParams = [
			{
				timestamp: new Date(),
				data: {
					running: false,
					label: ''
				},
				id: historyTime.id
			}
		];
		return this.http
			.post(
				`${this.AW_HOST}/api/0/buckets/aw-stopwatch/events`,
				defaultStopParams
			)
			.pipe()
			.toPromise();
	}

	collectevents(start, end): Promise<any> {
		return this.http
			.get(
				`${this.AW_HOST}/api/0/buckets/aw-watcher-window_btr.local/events?start=${start}&end=${end}&limit=-1`
			)
			.pipe()
			.toPromise();
	}
}
