import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	IEmployee,
	PayPeriodEnum,
	ICandidate,
	ICurrency
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs';
import {
	CandidateStore,
	EmployeeStore,
	Store
} from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-rates',
	templateUrl: 'employee-rates.component.html',
	styleUrls: ['employee-rates.component.scss']
})
export class EmployeeRatesComponent implements OnInit, OnDestroy {

	@Input() public isEmployee: boolean;
	@Input() public isCandidate: boolean;

	selectedEmployee: IEmployee;
	selectedCandidate: ICandidate;
	payPeriods = Object.values(PayPeriodEnum);

	/*
	* Employee Rates Form
	*/
	public form: FormGroup = EmployeeRatesComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			payPeriod: [],
			billRateValue: [],
			billRateCurrency: [],
			reWeeklyLimit: ['', Validators.compose([
					Validators.min(1),
					Validators.max(128)
				])
			]
		});
	}

	constructor(
		private readonly fb: FormBuilder,
		private readonly store: Store,
		private readonly employeeStore: EmployeeStore,
		private readonly candidateStore: CandidateStore
	) { }

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(
				filter((employee: IEmployee) => !!employee),
				tap((employee: IEmployee) => this.selectedEmployee = employee),
				tap((employee: IEmployee) => this._syncRates(employee)),
				untilDestroyed(this)
			)
			.subscribe();
		this.candidateStore.selectedCandidate$
			.pipe(
				filter((candidate: ICandidate) => !!candidate),
				tap((candidate: ICandidate) => this.selectedCandidate = candidate),
				tap((candidate: ICandidate) => this._syncRates(candidate)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async onSubmit() {
		if (this.form.invalid || !this.store.selectedOrganization) {
			return;
		}
		const { id: organizationId } = this.store.selectedOrganization;
		if (this.form.valid && this.isEmployee) {
			this.employeeStore.employeeForm = {
				...this.form.getRawValue(),
				organizationId
			};
		}
		if (this.form.valid && this.isCandidate) {
			this.candidateStore.candidateForm = {
				...this.form.getRawValue(),
				organizationId
			};
		}
	}

	private async _syncRates(user: IEmployee | ICandidate) {
		this.form.patchValue({
			payPeriod: user.payPeriod,
			billRateValue: user.billRateValue,
			billRateCurrency: user.billRateCurrency,
			reWeeklyLimit: user.reWeeklyLimit
		});
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) { }

	ngOnDestroy() { }
}
