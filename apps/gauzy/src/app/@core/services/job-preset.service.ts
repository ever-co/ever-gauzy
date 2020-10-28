import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IEmployeePresetInput,
	IGetJobPresetInput,
	IJobPreset,
	IMatchingCriterions
} from '@gauzy/models';
import { toParams } from '@gauzy/utils';

@Injectable({
	providedIn: 'root'
})
export class JobPresetService {
	constructor(private http: HttpClient) {}

	getJobPresets(request?: IGetJobPresetInput) {
		return this.http
			.get<IJobPreset[]>(`/api/job-preset`, {
				params: request ? toParams(request) : {}
			})
			.toPromise();
	}

	getJobPreset(id: string, request?: IGetJobPresetInput) {
		return this.http
			.get<IJobPreset>(`/api/job-preset/${id}`, {
				params: request ? toParams(request) : {}
			})
			.toPromise();
	}

	getEmployeePresets(id: string) {
		return this.http
			.get<IJobPreset[]>(`/api/job-preset/employee/${id}`)
			.toPromise();
	}
	createJobPreset(request?: IJobPreset) {
		return this.http
			.post<IJobPreset>(`/api/job-preset`, request)
			.toPromise();
	}

	saveEmployeePreset(arg: IEmployeePresetInput) {
		return this.http
			.post<IJobPreset>(`/api/job-preset/employee`, arg)
			.toPromise();
	}

	createJobPresetCriterion(
		jobPresetId: string,
		criterion: IMatchingCriterions
	) {
		return this.http
			.post<IJobPreset>(
				`/api/job-preset/${jobPresetId}/criterion`,
				criterion
			)
			.toPromise();
	}

	deleteJobPresetCriterion(criterionId: string) {
		return this.http
			.delete<IJobPreset>(`/api/job-preset/criterion/${criterionId}`)
			.toPromise();
	}
}
