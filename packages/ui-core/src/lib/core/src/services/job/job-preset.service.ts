import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEmployeePresetInput, IGetJobPresetInput, IJobPreset, IMatchingCriterions } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { firstValueFrom } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class JobPresetService {
	constructor(private http: HttpClient) {}

	getJobPresets(request?: IGetJobPresetInput) {
		return firstValueFrom(
			this.http.get<IJobPreset[]>(`${API_PREFIX}/job-preset`, {
				params: request ? toParams(request) : {}
			})
		);
	}

	getJobPreset(id: string, request?: IGetJobPresetInput) {
		return firstValueFrom(
			this.http.get<IJobPreset>(`${API_PREFIX}/job-preset/${id}`, {
				params: request ? toParams(request) : {}
			})
		);
	}

	getEmployeePreset(request?: IGetJobPresetInput) {
		return firstValueFrom(
			this.http.get<IJobPreset>(`${API_PREFIX}/job-preset`, {
				params: request ? toParams(request) : {}
			})
		);
	}

	getEmployeeCriterions(employeeId: string, request?: IGetJobPresetInput) {
		return firstValueFrom(
			this.http.get<IMatchingCriterions[]>(`${API_PREFIX}/job-preset/employee/${employeeId}/criterion`, {
				params: request ? toParams(request) : {}
			})
		);
	}

	createJobPreset(request?: IJobPreset) {
		return firstValueFrom(this.http.post<IJobPreset>(`${API_PREFIX}/job-preset`, request));
	}

	saveEmployeePreset(arg: IEmployeePresetInput) {
		return firstValueFrom(this.http.post<IMatchingCriterions[]>(`${API_PREFIX}/job-preset/employee`, arg));
	}

	createJobPresetCriterion(jobPresetId: string, criterion: IMatchingCriterions) {
		return firstValueFrom(
			this.http.post<IJobPreset>(`${API_PREFIX}/job-preset/${jobPresetId}/criterion`, criterion)
		);
	}

	createEmployeeCriterion(employeeId: string, criterion: IMatchingCriterions) {
		return firstValueFrom(
			this.http.post<IMatchingCriterions>(`${API_PREFIX}/job-preset/employee/${employeeId}/criterion`, criterion)
		);
	}

	deleteJobPresetCriterion(criterionId: string) {
		return firstValueFrom(this.http.delete<IJobPreset>(`${API_PREFIX}/job-preset/criterion/${criterionId}`));
	}

	deleteEmployeeCriterion(employeeId: string, criterionId: string) {
		return firstValueFrom(
			this.http.delete<IMatchingCriterions>(
				`${API_PREFIX}/job-preset/employee/${employeeId}/criterion/${criterionId}`
			)
		);
	}
}
