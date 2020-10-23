import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	GetEmployeeJobPostInput,
	EmployeeJobPost,
	Pagination
} from '@gauzy/models';
import { toParams } from '@gauzy/utils';

@Injectable({
	providedIn: 'root'
})
export class JobService {
	constructor(private http: HttpClient) {}

	getJobs(request?: GetEmployeeJobPostInput) {
		return this.http
			.get<Pagination<EmployeeJobPost>>(`/api/employee-job`, {
				params: request ? toParams(request) : {}
			})
			.pipe(first())
			.toPromise();
	}
}
