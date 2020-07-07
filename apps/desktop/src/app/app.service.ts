import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';
@Injectable({
	providedIn: 'root'
})
export class AppService {
	AW_HOST = environment.AWHost;
	constructor(private http: HttpClient) {}

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

	collectevents(tpURL, tp, start, end): Promise<any> {
		switch (tp) {
			case 'aw':
				return this.collectFromAW(tpURL, start, end);
			default:
				return this.collectFromAW(tpURL, start, end);
		}
	}

	collectAfk(tpURL, tp, start, end): Promise<any> {
		switch (tp) {
			case 'aw':
				return this.collectAfkFromAW(tpURL, start, end);
			default:
				return this.collectAfkFromAW(tpURL, start, end);
		}
	}

	pushActivityCollectionToGauzy(gauzyAPI) {
		return true;
	}

	collectFromAW(tpURL, start, end) {
		return this.http
			.get(
				`${tpURL}/api/0/buckets/aw-watcher-window_btr.local/events?start=${start}&end=${end}&limit=-1`
			)
			.pipe()
			.toPromise();
	}

	collectAfkFromAW(tpURL, start, end) {
		return this.http
			.get(
				`${tpURL}/api/0/buckets/aw-watcher-afk_btr.local/events?limit=1`
			)
			.pipe()
			.toPromise();
	}

	pushTotimeslot(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`
		});
		return this.http
			.post(
				`${values.apiHost}/api/timesheet/time-slot`,
				{
					employeeId: values.employeeId,
					duration: values.duration,
					keyboard: 0,
					mouse: 0,
					overall: 0,
					startedAt: values.startedAt
				},
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	pushTotimesheet(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`
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
					stoppedAt: values.stoppedAt
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
			Authorization: `Bearer ${values.token}`
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
			Authorization: `Bearer ${values.token}`
		});
		return this.http
			.put(
				`${values.apiHost}/api/timesheet/time-slot/${values.timeSlotId}`,
				{
					duration: values.duration,
					keyboard: values.keyboard,
					mouse: values.mouse,
					overall: values.overall
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
			Authorization: `Bearer ${values.token}`
		});
		return this.http
			.post(
				`${values.apiHost}/api/timesheet/activity`,
				{
					employeeId: values.employeeId,
					projectId: values.projectId,
					taskId: values.taskId,
					title: values.title,
					date: values.date,
					duration: values.duration,
					type: values.type
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
			Authorization: `Bearer ${values.token}`
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
			Authorization: `Bearer ${values.token}`
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
			Authorization: `Bearer ${values.token}`
		});
		return this.http
			.put(
				`${values.apiHost}/api/timesheet/time-log/${values.timeLogId}`,
				{
					stoppedAt: values.stoppedAt
				},
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}
}
