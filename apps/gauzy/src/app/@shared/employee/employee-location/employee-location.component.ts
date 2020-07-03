import { OnInit, OnDestroy, Component, Input } from '@angular/core';
import { Subject } from 'rxjs';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Employee, Country, Candidate } from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { CandidateStore } from '../../../@core/services/candidate-store.service';
import { EmployeeStore } from '../../../@core/services/employee-store.service';
import { CountryService } from '../../../@core/services/country.service';

@Component({
	selector: 'ga-employee-location',
	templateUrl: 'employee-location.component.html',
	styleUrls: ['employee-location.component.scss']
})
export class EmployeeLocationComponent implements OnInit, OnDestroy {
	@Input() public isEmployee: boolean;
	@Input() public isCandidate: boolean;

	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	selectedEmployee: Employee;
	selectedCandidate: Candidate;
	countries: Country[];

	constructor(
		private fb: FormBuilder,
		private candidateStore: CandidateStore,
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

	private async _initializeForm(role: Employee | Candidate) {
		await this.loadCountries();

		this.form = this.fb.group({
			country: [role.contact ? role.contact.country : ''],
			city: [role.contact ? role.contact.city : ''],
			postcode: [role.contact ? role.contact.postcode : ''],
			address: [role.contact ? role.contact.address : ''],
			address2: [role.contact ? role.contact.address2 : '']
		});
	}

	private async loadCountries() {
		const { items } = await this.countryService.getAll();
		this.countries = items;
	}
}
