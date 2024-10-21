import { Injectable } from '@angular/core';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { JobService } from './job.service';
import { ToastrService } from '../notification/toastr.service';

@Injectable({
	providedIn: 'root'
})
export class JobSearchStoreService {
	constructor(private readonly _jobService: JobService, private readonly _toastrService: ToastrService) {}

	/**
	 * Updates the job search availability status of an employee within the organization.
	 *
	 * @param organization - The current organization context.
	 * @param employee - The employee object to update.
	 * @param isJobSearchActive - A boolean flag indicating whether the job search is active.
	 * @returns {Promise<void>} - A Promise resolving to void.
	 */
	async updateJobSearchAvailability(
		organization: IOrganization | undefined,
		employee: IEmployee,
		isJobSearchActive: boolean
	): Promise<void> {
		try {
			// Ensure the organization context is available before proceeding.
			if (!organization) {
				console.warn('No organization provided to update job search availability.');
				return;
			}

			// Destructure organization properties for clarity.
			const { id: organizationId, tenantId } = organization;

			// Update the job search status using the employeesService.
			await this._jobService.updateJobSearchStatus(employee.id, {
				isJobSearchActive,
				organizationId,
				tenantId
			});

			// Display a success toastr notification based on the job search status.
			const toastrMessageKey = isJobSearchActive
				? 'TOASTR.MESSAGE.EMPLOYEE_JOB_STATUS_ACTIVE'
				: 'TOASTR.MESSAGE.EMPLOYEE_JOB_STATUS_INACTIVE';

			const fullName = employee.fullName.trim() || 'Unknown Employee';
			this._toastrService.success(toastrMessageKey, { name: fullName });
		} catch (error) {
			// Display an error toastr notification in case of any exceptions.
			const errorMessage = error?.message || 'An error occurred while updating the job search availability.';
			console.error('Error while updating job search availability:', error?.message);
			this._toastrService.danger(errorMessage);
		}
	}
}
