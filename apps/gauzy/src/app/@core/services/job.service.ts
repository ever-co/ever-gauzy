import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
		return firstValueFrom(
			this.http
			.get<IPagination<IEmployeeJobPost>>(`${API_PREFIX}/employee-job`, {
				params: request ? toParams(request) : {}
			})
		);
	}

	hideJob(request: IVisibilityJobPostInput) {
		return firstValueFrom(
			this.http
			.post<boolean>(`${API_PREFIX}/employee-job/hide`, request)
		);
	}

	applyJob(request: IApplyJobPostInput) {
		return firstValueFrom(
			this.http
			.post<IUpdateEmployeeJobPostAppliedResult>(
				`${API_PREFIX}/employee-job/applied`,
				request
			)
		);
	}
}
