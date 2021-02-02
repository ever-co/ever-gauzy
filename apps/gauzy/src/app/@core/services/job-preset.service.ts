import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IEmployeePresetInput,
	IGetJobPresetInput,
	IJobPreset,
	IMatchingCriterions
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class JobPresetService {
	constructor(private http: HttpClient) {}

	getJobPresets(request?: IGetJobPresetInput) {
		return this.http
			.get<IJobPreset[]>(`${API_PREFIX}/job-preset`, {
				params: request ? toParams(request) : {}
			})
			.toPromise();
	}

	getJobPreset(id: string, request?: IGetJobPresetInput) {
		return this.http
			.get<IJobPreset>(`${API_PREFIX}/job-preset/${id}`, {
				params: request ? toParams(request) : {}
			})
			.toPromise();
	}

	getEmployeePreset(request?: IGetJobPresetInput) {
		return this.http
			.get<IJobPreset>(`${API_PREFIX}/job-preset`, {
				params: request ? toParams(request) : {}
			})
			.toPromise();
	}

	getEmployeeCriterions(employeeId: string, request?: IGetJobPresetInput) {
		return this.http
			.get<IMatchingCriterions[]>(
				`${API_PREFIX}/job-preset/employee/${employeeId}/criterion`,
				{
					params: request ? toParams(request) : {}
				}
			)
			.toPromise();
	}

	createJobPreset(request?: IJobPreset) {
		return this.http
			.post<IJobPreset>(`${API_PREFIX}/job-preset`, request)
			.toPromise();
	}

	saveEmployeePreset(arg: IEmployeePresetInput) {
		return this.http
			.post<IMatchingCriterions[]>(
				`${API_PREFIX}/job-preset/employee`,
				arg
			)
			.toPromise();
	}

	createJobPresetCriterion(
		jobPresetId: string,
		criterion: IMatchingCriterions
	) {
		return this.http
			.post<IJobPreset>(
				`${API_PREFIX}/job-preset/${jobPresetId}/criterion`,
				criterion
			)
			.toPromise();
	}

	createEmployeeCriterion(
		employeeId: string,
		criterion: IMatchingCriterions
	) {
		return this.http
			.post<IMatchingCriterions>(
				`${API_PREFIX}/job-preset/employee/${employeeId}/criterion`,
				criterion
			)
			.toPromise();
	}

	deleteJobPresetCriterion(criterionId: string) {
		return this.http
			.delete<IJobPreset>(
				`${API_PREFIX}/job-preset/criterion/${criterionId}`
			)
			.toPromise();
	}

	deleteEmployeeCriterion(employeeId: string, criterionId: string) {
		return this.http
			.delete<IMatchingCriterions>(
				`${API_PREFIX}/job-preset/employee/${employeeId}/criterion/${criterionId}`
			)
			.toPromise();
	}
}
