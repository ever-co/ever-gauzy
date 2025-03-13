import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IEmployee, PayPeriodEnum, ICandidate, ICurrency } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs';
import { CandidateStore, EmployeeStore, Store } from '@gauzy/ui-core/core';

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
	public form: UntypedFormGroup = EmployeeRatesComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			payPeriod: [],
			billRateValue: ['', Validators.min(0)],
			billRateCurrency: [],
			reWeeklyLimit: [0, [Validators.required, Validators.min(0), Validators.max(168)]],
			minimumBillingRate: ['', Validators.min(0)]
		});
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly employeeStore: EmployeeStore,
		private readonly candidateStore: CandidateStore
	) {}

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(
				filter((employee: IEmployee) => !!employee),
				tap((employee: IEmployee) => (this.selectedEmployee = employee)),
				tap((employee: IEmployee) => this._syncRates(employee)),
				untilDestroyed(this)
			)
			.subscribe();
		this.candidateStore.selectedCandidate$
			.pipe(
				filter((candidate: ICandidate) => !!candidate),
				tap((candidate: ICandidate) => (this.selectedCandidate = candidate)),
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
			reWeeklyLimit: user.reWeeklyLimit,
			minimumBillingRate: user.minimumBillingRate
		});
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}

	public get reWeeklyLimit() {
		return this.form.get('reWeeklyLimit');
	}

	public get billRateValue() {
		return this.form.get('billRateValue');
	}

	public get billRateCurrency() {
		return this.form.get('billRateCurrency');
	}

	public get minimumBillingRate() {
		return this.form.get('minimumBillingRate');
	}

	public limitDecimalPlaces(event: InputEvent) {
		const value = (event.target as HTMLInputElement).value;
		const regex = /^\d*(\.\d{0,4})?$/;
		if (!regex.test(value)) {
			(event.target as HTMLInputElement).value = value.slice(0, -1);
		}
	}

	ngOnDestroy() {}
}
