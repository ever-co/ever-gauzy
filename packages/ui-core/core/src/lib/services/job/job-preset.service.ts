import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, IEmployeePresetInput, IGetJobPresetInput, IJobPreset, IMatchingCriterions } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class JobPresetService {
	constructor(readonly http: HttpClient) {}

	/**
	 * Fetches a list of job presets.
	 * @param request Optional parameter to filter the job presets.
	 * @returns A promise that resolves to an array of job presets.
	 */
	getJobPresets(request?: IGetJobPresetInput) {
		return firstValueFrom(
			this.http.get<IJobPreset[]>(`${API_PREFIX}/job-preset`, {
				params: request ? toParams(request) : {}
			})
		);
	}

	/**
	 * Fetches a specific job preset by its ID.
	 * @param id The ID of the job preset to fetch.
	 * @param request Optional parameter to filter the job preset.
	 * @returns A promise that resolves to the job preset.
	 */
	getJobPreset(id: ID, request?: IGetJobPresetInput) {
		return firstValueFrom(
			this.http.get<IJobPreset>(`${API_PREFIX}/job-preset/${id}`, {
				params: request ? toParams(request) : {}
			})
		);
	}

	/**
	 * Fetches an employee's job preset.
	 * @param request Optional parameter to filter the job preset.
	 * @returns A promise that resolves to the job preset.
	 */
	getEmployeePreset(request?: IGetJobPresetInput) {
		return firstValueFrom(
			this.http.get<IJobPreset>(`${API_PREFIX}/job-preset`, {
				params: request ? toParams(request) : {}
			})
		);
	}

	/**
	 * Fetches matching criterions for a specific employee.
	 * @param employeeId The ID of the employee whose criterions are to be fetched.
	 * @param request Optional parameter to filter the criterions.
	 * @returns A promise that resolves to an array of matching criterions.
	 */
	getEmployeeCriterions(employeeId: ID, request?: IGetJobPresetInput) {
		return firstValueFrom(
			this.http.get<IMatchingCriterions[]>(`${API_PREFIX}/job-preset/employee/${employeeId}/criterion`, {
				params: request ? toParams(request) : {}
			})
		);
	}

	/**
	 * Creates a new job preset.
	 * @param request The job preset data to create.
	 * @returns A promise that resolves to the created job preset.
	 */
	createJobPreset(request?: IJobPreset) {
		return firstValueFrom(this.http.post<IJobPreset>(`${API_PREFIX}/job-preset`, request));
	}

	/**
	 * Saves an employee's job preset.
	 * @param input The data for the employee's job preset.
	 * @returns A promise that resolves to an array of job presets.
	 */
	saveEmployeePreset(input: IEmployeePresetInput): Promise<IJobPreset[]> {
		return firstValueFrom(this.http.post<IMatchingCriterions[]>(`${API_PREFIX}/job-preset/employee`, input));
	}

	/**
	 * Creates a new criterion for a job preset.
	 * @param jobPresetId The ID of the job preset to add the criterion to.
	 * @param criterion The criterion data to create.
	 * @returns A promise that resolves to the created job preset.
	 */
	createJobPresetCriterion(jobPresetId: ID, criterion: IMatchingCriterions) {
		return firstValueFrom(
			this.http.post<IJobPreset>(`${API_PREFIX}/job-preset/${jobPresetId}/criterion`, criterion)
		);
	}

	/**
	 * Creates a new criterion for an employee.
	 * @param employeeId The ID of the employee to add the criterion to.
	 * @param criterion The criterion data to create.
	 * @returns A promise that resolves to the created matching criterions.
	 */
	createEmployeeCriterion(employeeId: ID, criterion: IMatchingCriterions) {
		return firstValueFrom(
			this.http.post<IMatchingCriterions>(`${API_PREFIX}/job-preset/employee/${employeeId}/criterion`, criterion)
		);
	}

	/**
	 * Deletes a criterion from a job preset.
	 * @param criterionId The ID of the criterion to delete.
	 * @returns A promise that resolves to the deleted job preset.
	 */
	deleteJobPresetCriterion(criterionId: ID) {
		return firstValueFrom(this.http.delete<IJobPreset>(`${API_PREFIX}/job-preset/criterion/${criterionId}`));
	}

	/**
	 * Deletes a criterion from an employee's criterions.
	 * @param employeeId The ID of the employee whose criterion is to be deleted.
	 * @param criterionId The ID of the criterion to delete.
	 * @returns A promise that resolves to the deleted matching criterions.
	 */
	deleteEmployeeCriterion(employeeId: ID, criterionId: ID) {
		return firstValueFrom(
			this.http.delete<IMatchingCriterions>(
				`${API_PREFIX}/job-preset/employee/${employeeId}/criterion/${criterionId}`
			)
		);
	}
}
