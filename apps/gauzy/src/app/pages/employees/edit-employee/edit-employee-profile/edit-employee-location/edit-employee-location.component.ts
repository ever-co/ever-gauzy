import { OnInit, OnDestroy, Component } from '@angular/core';
import { Subject } from 'rxjs';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Employee, Country } from '@gauzy/models';
import { EmployeeStore } from 'apps/gauzy/src/app/@core/services/employee-store.service';
import { takeUntil } from 'rxjs/operators';
import { CountryService } from 'apps/gauzy/src/app/@core/services/country.service';

@Component({
	selector: 'ga-edit-employee-location',
	templateUrl: './edit-employee-location.component.html',
	styleUrls: ['./edit-employee-location.component.scss']
})
export class EditEmployeeLocationComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	selectedEmployee: Employee;
	countries: Country[];

	constructor(
		private fb: FormBuilder,
		private employeeStore: EmployeeStore,
		private countryService: CountryService
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

	ngOnDestroy() {
		this._ngDestroy$.next();
	}

	async submitForm() {
		if (this.form.valid) {
			this.employeeStore.employeeForm = {
				...this.form.value
			};
		}
	}

	private async _initializeForm(employee: Employee) {
		await this.loadCountries();

		this.form = this.fb.group({
			country: [employee.country],
			city: [employee.city],
			postcode: [employee.postcode],
			address: [employee.address],
			address2: [employee.address2]
		});
	}

	private async loadCountries() {
		const { items } = await this.countryService.getAll();
		this.countries = items;
	}
}
