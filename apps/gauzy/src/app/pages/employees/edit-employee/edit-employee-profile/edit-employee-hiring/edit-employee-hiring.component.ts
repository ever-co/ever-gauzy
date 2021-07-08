import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IEmployee } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EmployeeStore } from './../../../../../@core/services';
import { CompareDateValidators } from './../../../../../@core/validators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-employee-hiring',
	templateUrl: './edit-employee-hiring.component.html',
	styleUrls: [
		'../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss'
	]
})
export class EditEmployeeHiringComponent implements OnInit, OnDestroy {
	selectedEmployee: IEmployee;

	public form: FormGroup = EditEmployeeHiringComponent.buildForm(this.fb);
	static buildForm(formBuilder: FormBuilder): FormGroup {
		return formBuilder.group({
			offerDate: [],
			acceptDate: [],
			rejectDate: []
		}, { 
			validators: [
				CompareDateValidators.validateDate('offerDate', 'acceptDate'),
				CompareDateValidators.validateDate('offerDate', 'rejectDate')
			] 
		});
	}

	constructor(
		private readonly fb: FormBuilder,
		private readonly employeeStore: EmployeeStore
	) {}

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(
				filter((employee: IEmployee) => !!employee),
				tap((employee: IEmployee) => this.selectedEmployee = employee),
				tap((employee) => this._patchForm(employee)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public submitForm() {
		if (this.form.valid) {
			this.employeeStore.employeeForm = {
				...this.form.value
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

	ngOnDestroy() { }
}
