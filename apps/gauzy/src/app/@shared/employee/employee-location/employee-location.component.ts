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
		if (this.form.valid && this.isCandidate) {
			this.candidateStore.candidateForm = {
				...this.form.value
			};
		}
		if (this.form.valid && this.isEmployee) {
			this.employeeStore.employeeForm = {
				...this.form.value
			};
		}
	}

	private async _initializeForm(role: Employee | Candidate) {
		await this.loadCountries();

		this.form = this.fb.group({
			country: [role.country],
			city: [role.city],
			postcode: [role.postcode],
			address: [role.address],
			address2: [role.address2]
		});
	}

	private async loadCountries() {
		const { items } = await this.countryService.getAll();
		this.countries = items;
	}
}
