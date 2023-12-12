import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { firstValueFrom, throwError } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class AppService {
	constructor(private http: HttpClient) {}

	public async pingServer(values) {
		return await firstValueFrom(this.http.get(values.host + '/api'));
	}

	pushToTimeSlot(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
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
		return this.http
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
			.toPromise();
	}

	pushToTimesheet(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
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
					organizationContactId: values.organizationContactId,
				},
				{
					headers: headers,
				}
			)
			.pipe()
			.toPromise();
	}

	updateToTimeSheet(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
		});
		return this.http
			.put(
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
			.pipe()
			.toPromise();
	}

	updateToTimeSlot(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
		});
		return this.http
			.put(
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
			.pipe()
			.toPromise();
	}

	pushToActivity(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
		});
		return this.http
			.post(
				`${values.apiHost}/api/timesheet/activity/bulk`,
				{
					activities: values.activities,
				},
				{
					headers: headers,
				}
			)
			.pipe()
			.toPromise();
	}

	updateToActivity(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
		});
		return this.http
			.put(
				`${values.apiHost}/api/timesheet/activity/${values.activityId}`,
				{
					duration: values.duration,
				},
				{
					headers: headers,
				}
			)
			.pipe()
			.toPromise();
	}

	setTimeLog(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
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
					source: 'DESKTOP',
				},
				{
					headers: headers,
				}
			)
			.pipe()
			.toPromise();
	}

	updateTimeLog(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
		});
		return this.http
			.put(
				`${values.apiHost}/api/timesheet/time-log/${values.timeLogId}`,
				{
					startedAt: values.startedAt,
					stoppedAt: values.stoppedAt,
				},
				{
					headers: headers,
				}
			)
			.pipe()
			.toPromise();
	}

	stopTimer(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
		});

		return this.http
			.post(
				`${values.apiHost}/api/timesheet/timer/stop`,
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
					organizationContactId: values.organizationContactId,
				},
				{
					headers: headers,
				}
			)
			.pipe()
			.toPromise();
	}

	uploadScreenCapture(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
		});
		const formData = new FormData();
		const fileUpload: File = values.fileStream;
		formData.append('file', fileUpload);
		formData.append('timeSlotId', values.timeSlotId);
		formData.append('organizationContactId', values.organizationContactId);
		console.log(values);
		return this.http
			.post(`${values.apiHost}/api/timesheet/screenshot`, formData, {
				headers: headers,
			})
			.pipe()
			.toPromise();
	}
}
