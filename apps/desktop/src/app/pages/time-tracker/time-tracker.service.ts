import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import * as moment from 'moment';
@Injectable({
	providedIn: 'root'
})
export class TimeTrackerService {
	AW_HOST = environment.AWHost;
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
			'Tenant-ID': values.tenantId
		});
		return this.http
			.get(`${values.apiHost}/api/tasks/employee/${values.employeeId}`, {
				headers: headers
			})
			.pipe()
			.toPromise();
	}

	getProjects(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-ID': values.tenantId
		});
		return this.http
			.get(
				`${values.apiHost}/api/organization-projects/employee/${values.employeeId}`,
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}

	getClient(values) {
		const headers = new HttpHeaders({
			Authorization: `Bearer ${values.token}`,
			'Tenant-ID': values.tenantId
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
			'Tenant-ID': values.tenantId
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
			'Tenant-ID': values.tenantId
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
			'Tenant-ID': values.tenantId
		});
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
}
