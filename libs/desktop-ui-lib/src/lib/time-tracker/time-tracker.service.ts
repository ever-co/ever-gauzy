import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
// import { environment } from '../../../environments/environment';
import * as moment from 'moment';

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

@Injectable({
	providedIn: 'root'
})
export class TimeTrackerService {
	AW_HOST = 'http://localhost:5600';
	token = '';
	userId = '';
	employeeId = '';

	constructor(private http: HttpClient) {}

	createAuthorizationHeader(headers: Headers) {
		headers.append('Authorization', 'Basic ' + btoa('username:password'));
	}

	getTasks(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return this.http
			.get(`${values.apiHost}/api/tasks/employee/${values.employeeId}`, {
				headers: headers,
				params: values.projectId
					? this.toParams({
							data: JSON.stringify({
								findInput: {
									projectId: values.projectId
								}
							})
					  })
					: this.toParams({})
			})
			.pipe()
			.toPromise();
	}

	getProjects(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return this.http
			.get(
				`${values.apiHost}/api/organization-projects/employee/${values.employeeId}`,
				{
					headers: headers,
					params: values.organizationContactId
						? this.toParams({
								data: JSON.stringify({
									findInput: {
										organizationContactId:
											values.organizationContactId
									}
								})
						  })
						: this.toParams({})
				}
			)
			.pipe()
			.toPromise();
	}

	getClient(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return this.http
			.get(
				`${values.apiHost}/api/organization-contact/employee/${values.employeeId}`,
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	getUserDetail(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});
		return this.http
			.get(
				`${values.apiHost}/api/user/me?data={"relations":  ["employee", "tenant", "employee.organization"]}`,
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	getTimeLogs(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});

		return this.http
			.get(`${values.apiHost}/api/timesheet/time-log/`, {
				headers: headers,
				params: {
					startDate: moment().startOf('day').utc().format(),
					endDate: moment().endOf('day').utc().format()
				}
			})
			.pipe()
			.toPromise();
	}

	getTimeSlot(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});

		log.info(`Get Time Slot: ${moment().format()}`);

		return this.http
			.get(
				`${values.apiHost}/api/timesheet/time-slot/${values.timeSlotId}?relations[]=screenshots&relations[]=activities&relations[]=employee`,
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	pingAw(host) {
		return this.http.get(host).pipe().toPromise();
	}

	toggleApiStart(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});

		const request = {
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
		};

		log.info(`Toggle Timer Request: ${moment().format()}`, request);

		return this.http
			.post(
				`${values.apiHost}/api/timesheet/timer/toggle`,
				{ ...request },
				{ headers: headers }
			)
			.pipe()
			.toPromise();
	}

	deleteTimeSlot(values) {
		const params = this.toParams({
			ids: [values.timeSlotId],
			tenantId: values.tenantId
		});
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});

		return this.http
			.delete(`${values.apiHost}/api/timesheet/time-slot`, {
				params,
				headers: headers
			})
			.pipe()
			.toPromise();
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

	getInvalidTimeLog(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});

		return this.http
			.get(`${values.apiHost}/api/timesheet/time-log/`, {
				headers: headers,
				params: {
					tenantId: values.tenantId,
					organizationId: values.organizationId,
					source: 'DESKTOP'
				}
			})
			.pipe()
			.toPromise();
	}

	deleteInvalidTimeLog(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-Id': values.tenantId
		});

		return this.http
			.delete(
				`${values.apiHost}/api/timesheet/time-log/${values.timeLogId}`,
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}
}
