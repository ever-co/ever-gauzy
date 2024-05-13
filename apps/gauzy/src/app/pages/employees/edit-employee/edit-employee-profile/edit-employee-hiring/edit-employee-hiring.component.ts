import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { IEmployee } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { CompareDateValidator } from '@gauzy/ui-sdk/core';
import { EmployeeStore, Store } from './../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-employee-hiring',
	templateUrl: './edit-employee-hiring.component.html',
	styleUrls: [
		'../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss',
		'./edit-employee-hiring.component.scss'
	]
})
export class EditEmployeeHiringComponent implements OnInit, OnDestroy {
	selectedEmployee: IEmployee;

	public form: UntypedFormGroup = EditEmployeeHiringComponent.buildForm(this.fb);
	static buildForm(formBuilder: UntypedFormBuilder): UntypedFormGroup {
		return formBuilder.group(
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
	}

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

	public submitForm() {
		if (this.form.valid) {
			const { id: organizationId } = this.store.selectedOrganization;
			this.employeeStore.employeeForm = {
				...this.form.getRawValue(),
				organizationId
			};
		}
	}

	private _patchForm(employee: IEmployee) {
		const { offerDate, acceptDate, rejectDate } = employee;
		this.form.patchValue({
			offerDate: offerDate ? new Date(offerDate) : null,
			acceptDate: acceptDate ? new Date(acceptDate) : null,
			rejectDate: rejectDate ? new Date(rejectDate) : null
		});
	}

	ngOnDestroy() {}
}
