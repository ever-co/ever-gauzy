import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	GetJobPresetInput,
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

	createJobPreset(request?: JobPreset) {
		return this.http
			.post<JobPreset>(`/api/job-preset`, request)
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
