import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../environments/environment';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';

@Injectable({
	providedIn: 'root',
})
export class AppService {
	AW_HOST = environment.AWHost;
	buckets: any = {};
	constructor(private http: HttpClient) {}

	pingServer(values) {
		return firstValueFrom(this.http.get(values.host));
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

	pushToTimeSlot(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
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
			organizationContactId: values.organizationContactId,
		};
		return firstValueFrom(
			this.http
				.post(`${values.apiHost}/api/timesheet/time-slot`, params, {
					headers: headers,
				})
				.pipe(
					catchError((error) => {
						error.error = {
							...error.error,
							params: JSON.stringify(params),
						};
						return throwError(error);
					})
				)
		);
	}

	pushToTimesheet(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		return firstValueFrom(
			this.http.post(
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
					organizationContactId: values.organizationContactId,
				},
				{
					headers: headers,
				}
			)
		);
	}

	updateToTimeSheet(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		return firstValueFrom(
			this.http.put(
				`${values.apiHost}/api/timesheet/${values.timeSheetId}`,
				{
					duration: values.duration,
					keyboard: values.keyboard,
					mouse: values.mouse,
					overall: values.overall,
					stoppedAt: values.stoppedAt,
				},
				{
					headers: headers,
				}
			)
		);
	}

	updateToTimeSlot(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		return firstValueFrom(
			this.http.put(
				`${values.apiHost}/api/timesheet/time-slot/${values.timeSlotId}`,
				{
					duration: values.duration,
					keyboard: values.keyboard,
					mouse: values.mouse,
					overall: values.overall,
					activities: values.activities,
				},
				{
					headers: headers,
				}
			)
		);
	}

	pushToActivity(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		return firstValueFrom(
			this.http.post(
				`${values.apiHost}/api/timesheet/activity/bulk`,
				{
					activities: values.activities,
				},
				{
					headers: headers,
				}
			)
		);
	}

	updateToActivity(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		return firstValueFrom(
			this.http.put(
				`${values.apiHost}/api/timesheet/activity/${values.activityId}`,
				{
					duration: values.duration,
				},
				{
					headers: headers,
				}
			)
		);
	}

	setTimeLog(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		const body = {
			employeeId: values.employeeId,
			timesheetId: values.timesheetId,
			projectId: values.projectId,
			taskId: values.taskId,
			startedAt: values.startedAt,
			stoppedAt: values.stoppedAt,
			isBillable: true,
			logType: TimeLogType.TRACKED,
			source: TimeLogSourceEnum.DESKTOP,
		};
		return firstValueFrom(
			this.http.post(
				`${values.apiHost}/api/timesheet/time-log`,
				{ ...body },
				{ headers: headers }
			)
		);
	}

	updateTimeLog(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		return firstValueFrom(
			this.http.put(
				`${values.apiHost}/api/timesheet/time-log/${values.timeLogId}`,
				{
					startedAt: values.startedAt,
					stoppedAt: values.stoppedAt,
				},
				{
					headers: headers,
				}
			)
		);
	}

	stopTimer(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		const body = {
			description: values.note,
			isBillable: true,
			logType: TimeLogType.TRACKED,
			projectId: values.projectId,
			taskId: values.taskId,
			source: TimeLogSourceEnum.DESKTOP,
			manualTimeSlot: values.manualTimeSlot,
			organizationId: values.organizationId,
			tenantId: values.tenantId,
			organizationContactId: values.organizationContactId,
		};
		console.log(body, 'body from toggle API from app.service.ts 353 line');
		return firstValueFrom(
			this.http.post(
				`${values.apiHost}/api/timesheet/timer/stop`,
				{ ...body },
				{ headers: headers }
			)
		);
	}

	uploadScreenCapture(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});

		const formData = new FormData();
		const fileUpload: File = values.fileStream;

		formData.append('file', fileUpload);
		formData.append('timeSlotId', values.timeSlotId);
		formData.append('organizationContactId', values.organizationContactId);

		return firstValueFrom(
			this.http.post(
				`${values.apiHost}/api/timesheet/screenshot`,
				formData,
				{
					headers: headers,
				}
			)
		);
	}

	reqGetUserDetail(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId,
		});
		const params = this.toParams({
			relations: [
				'tenant',
				'employee',
				'employee.organization',
				'role',
				'role.rolePermissions',
			],
		});
		return firstValueFrom(
			this.http.get(`${values.apiHost}/api/user/me`, {
				params,
				headers: headers,
			})
		);
	}

	async getUserDetail(values) {
		let userDetail;
		try {
			userDetail = await this.reqGetUserDetail(values);
			localStorage.setItem('userDetail', JSON.stringify(userDetail));
			return userDetail;
		} catch (error) {
			userDetail = localStorage.getItem('userDetail');
			if (userDetail) {
				return JSON.parse(userDetail);
			}
			throw error;
		}
	}

	toParams(query) {
		let params: HttpParams = new HttpParams();
		Object.keys(query).forEach((key) => {
			if (this.isJsObject(query[key])) {
				params = this.toSubParams(params, key, query[key]);
			} else {
				params = params.append(key.toString(), query[key]);
			}
		});
		return params;
	}

	isJsObject(object: any) {
		return (
			object !== null &&
			object !== undefined &&
			typeof object === 'object'
		);
	}

	toSubParams(params: HttpParams, key: string, object: any) {
		Object.keys(object).forEach((childKey) => {
			if (this.isJsObject(object[childKey])) {
				params = this.toSubParams(
					params,
					`${key}[${childKey}]`,
					object[childKey]
				);
			} else {
				params = params.append(`${key}[${childKey}]`, object[childKey]);
			}
		});

		return params;
	}
}
