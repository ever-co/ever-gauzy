import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	EmployeePresetInput,
	GetJobPresetInput,
	JobPostSourceEnum,
	JobPreset,
	MatchingCriterions
} from '@gauzy/models';
import { toParams } from '@gauzy/utils';

@Injectable({
	providedIn: 'root'
})
export class JobPresetService {
	constructor(private http: HttpClient) {}

	getJobPresets(request?: GetJobPresetInput) {
		return this.http
			.get<JobPreset[]>(`/api/job-preset`, {
				params: request ? toParams(request) : {}
			})
			.toPromise();
	}

	getJobPreset(id: string, request?: GetJobPresetInput) {
		return this.http
			.get<JobPreset>(`/api/job-preset/${id}`, {
				params: request ? toParams(request) : {}
			})
			.toPromise();
	}

	getEmployeePresets(id: string) {
		return this.http
			.get<JobPreset[]>(`/api/job-preset/employee/${id}`)
			.toPromise();
	}
	createJobPreset(request?: JobPreset) {
		return this.http
			.post<JobPreset>(`/api/job-preset`, request)
			.toPromise();
	}

	saveEmployeePreset(arg: EmployeePresetInput) {
		return this.http
			.post<JobPreset>(`/api/job-preset/employee`, arg)
			.toPromise();
	}

	createJobPresetCriterion(
		jobPresetId: string,
		criterion: MatchingCriterions
	) {
		return this.http
			.post<JobPreset>(
				`/api/job-preset/${jobPresetId}/criterion`,
				criterion
			)
			.toPromise();
	}

	deleteJobPresetCriterion(criterionId: string) {
		return this.http
			.delete<JobPreset>(`/api/job-preset/criterion/${criterionId}`)
			.toPromise();
	}
}
