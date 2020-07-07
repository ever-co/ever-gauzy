import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
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
			Authorization: `Bearer ${values.token}`
		});
		return this.http
			.get(
				`${values.apiHost}/api/tasks/team?data={"employeeId": "${values.employeeId}"}`,
				{
					headers: headers
				}
			)
			.pipe()
			.toPromise();
	}
}
