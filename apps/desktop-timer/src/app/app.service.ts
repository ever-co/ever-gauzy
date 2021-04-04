import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class AppService {
	AW_HOST = environment.AWHost;
	buckets: any = {};
	constructor(private http: HttpClient) {}

	pingServer(values) {
		return this.http.get(values.host).pipe().toPromise();
	}

	startTime(id): Promise<any> {
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

	getAwBuckets(tpURL): Promise<any> {
		return this.http.get(`${tpURL}/api/0/buckets`).pipe().toPromise();
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

	async collectevents(tpURL, tp, start, end): Promise<any> {
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
		return this.http
			.get(
				`${tpURL}/api/0/buckets/${this.buckets.chromeBucket.id}/events?start=${start}&end=${end}&limit=-1`
			)
			.pipe()
			.toPromise();
	}

	collectFirefoxActivityFromAw(tpURL, start, end): Promise<any> {
		if (!this.buckets.firefoxBucket) return Promise.resolve([]);
		return this.http
			.get(
				`${tpURL}/api/0/buckets/${this.buckets.firefoxBucket.id}/events?start=${start}&end=${end}&limit=-1`
			)
			.pipe()
			.toPromise();
	}

	pushActivityCollectionToGauzy() {
		return true;
	}
	collectFromAW(tpURL, start, end) {
		if (!this.buckets.windowBucket) return Promise.resolve([]);
		return this.http
			.get(
				`${tpURL}/api/0/buckets/${this.buckets.windowBucket.id}/events?start=${start}&end=${end}&limit=-1`
			)
			.pipe()
			.toPromise();
	}

	collectAfkFromAW(tpURL, start, end) {
		if (!this.buckets.afkBucket) return Promise.resolve([]);
		return this.http
			.get(
				`${tpURL}/api/0/buckets/${this.buckets.afkBucket.id}/events?limit=1`
			)
			.pipe()
			.toPromise();
	}

	pushToTimeslot(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		const params = {
			employeeId: values.employeeId,
			projectId: values.projectId,
			duration: values.duration,
			keyboard: values.keyboard,
			mouse: values.mouse,
			overall: values.overall,
			startedAt: values.startedAt,
			activities: values.activities,
			timeLogId: values.timeLogId,
			organizationId: values.organizationId,
			tenantId: values.tenantId,
			organizationContactId: values.organizationContactId
		};

		return this.http
			.post(`${values.apiHost}/api/timesheet/time-slot`, params, {
				headers: headers
			})
			.pipe(
				catchError((error) => {
					error.error = {
						...error.error,
						params: JSON.stringify(params)
					};
					return throwError(error);
				})
			)
			.toPromise();
	}

	pushToTimesheet(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return this.http
			.post(
				`${values.apiHost}/api/timesheet`,
				{
					employeeId: values.employeeId,
					duration: values.duration,
					keyboard: 0,
					mouse: 0,
					overall: 0,
					startedAt: values.startedAt,
					isBilled: false,
					status: 'PENDING',
					stoppedAt: values.stoppedAt,
					organizationId: values.organizationId,
					tenantId: values.tenantId,
					organizationContactId: values.organizationContactId
				},
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	updateToTimeSheet(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return this.http
			.put(
				`${values.apiHost}/api/timesheet/${values.timeSheetId}`,
				{
					duration: values.duration,
					keyboard: values.keyboard,
					mouse: values.mouse,
					overall: values.overall,
					stoppedAt: values.stoppedAt
				},
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	updateToTimeSlot(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return this.http
			.put(
				`${values.apiHost}/api/timesheet/time-slot/${values.timeSlotId}`,
				{
					duration: values.duration,
					keyboard: values.keyboard,
					mouse: values.mouse,
					overall: values.overall,
					activities: values.activities
				},
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	pushToActivity(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return this.http
			.post(
				`${values.apiHost}/api/timesheet/activity/bulk`,
				{
					activities: values.activities
				},
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	updateToActivity(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return this.http
			.put(
				`${values.apiHost}/api/timesheet/activity/${values.activityId}`,
				{
					duration: values.duration
				},
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	setTimeLog(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return this.http
			.post(
				`${values.apiHost}/api/timesheet/time-log`,
				{
					employeeId: values.employeeId,
					timesheetId: values.timesheetId,
					projectId: values.projectId,
					taskId: values.taskId,
					startedAt: values.startedAt,
					stoppedAt: values.stoppedAt,
					isBillable: true,
					logType: 'TRACKED',
					source: 'DESKTOP'
				},
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	updateTimeLog(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return this.http
			.put(
				`${values.apiHost}/api/timesheet/time-log/${values.timeLogId}`,
				{
					startedAt: values.startedAt,
					stoppedAt: values.stoppedAt
				},
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	toggleApi(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return this.http
			.post(
				`${values.apiHost}/api/timesheet/timer/toggle`,
				{
					description: values.note,
					isBillable: true,
					logType: 'TRACKED',
					projectId: values.projectId,
					taskId: values.taskId,
					source: 'DESKTOP',
					manualTimeSlot: values.manualTimeSlot,
					organizationId: values.organizationId,
					tenantId: values.tenantId,
					organizationContactId: values.organizationContactId
				},
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	uploadScreenCapture(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});

		const formData = new FormData();
		const fileUpload: File = values.fileStream;

		formData.append('file', fileUpload);
		formData.append('timeSlotId', values.timeSlotId);
		formData.append('organizationContactId', values.organizationContactId);

		return this.http
			.post(`${values.apiHost}/api/timesheet/screenshot`, formData, {
				headers: headers
			})
			.pipe()
			.toPromise();
	}
}
