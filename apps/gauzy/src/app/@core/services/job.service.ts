import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	IGetEmployeeJobPostInput,
	IEmployeeJobPost,
	IPagination,
	IUpdateEmployeeJobPostAppliedResult,
	IApplyJobPostInput,
	IVisibilityJobPostInput
} from '@gauzy/models';
import { toParams } from '@gauzy/utils';

@Injectable({
	providedIn: 'root'
})
export class JobService {
	constructor(private http: HttpClient) {}

	getJobs(request?: IGetEmployeeJobPostInput) {
		return this.http
			.get<IPagination<IEmployeeJobPost>>(`/api/employee-job`, {
				params: request ? toParams(request) : {}
			})
			.pipe(first())
			.toPromise();
	}

	hideJob(request: IVisibilityJobPostInput) {
		return this.http
			.post<boolean>(`/api/employee-job/hide`, request)
			.pipe(first())
			.toPromise();
	}

	applyJob(request: IApplyJobPostInput) {
		return this.http
			.post<IUpdateEmployeeJobPostAppliedResult>(
				`/api/employee-job/applied`,
				request
			)
			.pipe(first())
			.toPromise();
	}
}
