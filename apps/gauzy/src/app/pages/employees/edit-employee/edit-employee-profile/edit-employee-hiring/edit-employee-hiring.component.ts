import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NbToastrService } from '@nebular/theme';
import { EmployeeStore } from 'apps/gauzy/src/app/@core/services/employee-store.service';
import { Subject, Subscription } from 'rxjs';
import { Params } from '@angular/router';
import { Employee } from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ga-edit-employee-hiring',
	templateUrl: './edit-employee-hiring.component.html',
	styleUrls: [
		'../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss'
	]
})
export class EditEmployeeHiringComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	selectedEmployee: Employee;

	constructor(
		private fb: FormBuilder,
		private employeeStore: EmployeeStore
	) {}

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((emp) => {
				this.selectedEmployee = emp;
				if (this.selectedEmployee) {
					this._initializeForm(this.selectedEmployee);
				}
			});
	}

	async submitForm() {
		if (this.form.valid) {
			this.employeeStore.employeeForm = {
				...this.form.value
			};
		}
	}

	private _initializeForm(employee: Employee) {
		this.form = this.fb.group({
			offerDate: [employee.offerDate],
			acceptDate: [employee.acceptDate],
			rejectDate: [employee.rejectDate]
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
	}
}
