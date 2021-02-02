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
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class JobService {
	constructor(private http: HttpClient) {}

	getJobs(request?: IGetEmployeeJobPostInput) {
		return this.http
			.get<IPagination<IEmployeeJobPost>>(`${API_PREFIX}/employee-job`, {
				params: request ? toParams(request) : {}
			})
			.pipe(first())
			.toPromise();
	}

	hideJob(request: IVisibilityJobPostInput) {
		return this.http
			.post<boolean>(`${API_PREFIX}/employee-job/hide`, request)
			.pipe(first())
			.toPromise();
	}

	applyJob(request: IApplyJobPostInput) {
		return this.http
			.post<IUpdateEmployeeJobPostAppliedResult>(
				`${API_PREFIX}/employee-job/applied`,
				request
			)
			.pipe(first())
			.toPromise();
	}
}
