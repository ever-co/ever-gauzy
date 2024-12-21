import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEmployee } from '@gauzy/contracts';
import { CompareDateValidator, EmployeeStore, Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-edit-employee-hiring',
    templateUrl: './edit-employee-hiring.component.html',
    styleUrls: [
        '../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss',
        './edit-employee-hiring.component.scss'
    ],
    standalone: false
})
export class EditEmployeeHiringComponent implements OnInit, OnDestroy {
	selectedEmployee: IEmployee;
	public form: UntypedFormGroup = this.fb.group(
		{
			offerDate: [],
			acceptDate: [],
			rejectDate: []
		},
		{
			validators: [
				CompareDateValidator.validateDate('offerDate', 'acceptDate'),
				CompareDateValidator.validateDate('offerDate', 'rejectDate')
			]
		}
	);

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly employeeStore: EmployeeStore,
		private readonly store: Store
	) {}

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(
				filter((employee: IEmployee) => !!employee),
				tap((employee: IEmployee) => (this.selectedEmployee = employee)),
				tap((employee) => this._patchForm(employee)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Submits the form if it is valid. Updates the employeeStore with the form values
	 * and additional information such as organizationId and tenantId.
	 */
	public submitForm(): void {
		if (!this.form.invalid) {
			return;
		}

		// Extract organizationId and tenantId from the selected organization
		const { id: organizationId, tenantId } = this.store.selectedOrganization;

		// Update the employee form in the store with the form values and additional info
		this.employeeStore.employeeForm = {
			...this.form.value,
			organizationId,
			tenantId
		};
	}
	/**
	 * Patches the form with values from the provided employee object.
	 * Converts date fields to Date objects if they are present, otherwise sets them to null.
	 *
	 * @param employee - The employee object containing data to patch the form.
	 */
	private _patchForm(employee: IEmployee): void {
		// Utility function to convert date string to Date object or null
		const toDateOrNull = (date?: Date): Date | null => (date ? new Date(date) : null);

		// Patch form with the employee data, converting dates using the utility function
		this.form.patchValue({
			offerDate: toDateOrNull(employee.offerDate),
			acceptDate: toDateOrNull(employee.acceptDate),
			rejectDate: toDateOrNull(employee.rejectDate)
		});
	}

	ngOnDestroy() {}
}
