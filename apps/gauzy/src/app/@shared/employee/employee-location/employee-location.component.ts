import { OnInit, OnDestroy, Component, Input } from '@angular/core';
import { Subject } from 'rxjs';
import { FormGroup, FormBuilder } from '@angular/forms';
import { IEmployee, ICountry, ICandidate } from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { CandidateStore } from '../../../@core/services/candidate-store.service';
import { EmployeeStore } from '../../../@core/services/employee-store.service';
@Component({
	selector: 'ga-employee-location',
	templateUrl: 'employee-location.component.html'
})
export class EmployeeLocationComponent implements OnInit, OnDestroy {
	@Input() public isEmployee: boolean;
	@Input() public isCandidate: boolean;

	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	selectedEmployee: IEmployee;
	selectedCandidate: ICandidate;
	country: string;

	constructor(
		private fb: FormBuilder,
		private candidateStore: CandidateStore,
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
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				this.selectedCandidate = candidate;
				if (this.selectedCandidate) {
					this._initializeForm(this.selectedCandidate);
				}
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
	}

	async submitForm() {
		const contact = {
			country: this.form.value.country,
			city: this.form.value.city,
			address: this.form.value.address,
			address2: this.form.value.address2,
			postcode: this.form.value.postcode
		};
		if (this.form.valid && this.isCandidate) {
			this.candidateStore.candidateForm = {
				...this.form.value,
				contact
			};
		}
		if (this.form.valid && this.isEmployee) {
			this.employeeStore.employeeForm = {
				...this.form.value,
				contact
			};
		}
	}

	private async _initializeForm(employee: IEmployee | ICandidate) {
		this.form = this.fb.group({
			country: [''],
			city: [''],
			postcode: [''],
			address: [''],
			address2: ['']
		});
		this._setValues(employee);
	}

	private _setValues(employee: IEmployee | ICandidate) {
		if (!employee.contact) {
			return;
		}
		this.country = employee.contact.country;
		this.form.setValue({
			country: employee.contact.country,
			city: employee.contact.city,
			postcode: employee.contact.postcode,
			address: employee.contact.address,
			address2: employee.contact.address2
		});
		this.form.updateValueAndValidity();
	}

	/*
	 * On Changed Country Event Emitter
	 */
	countryChanged($event: ICountry) {}
}
