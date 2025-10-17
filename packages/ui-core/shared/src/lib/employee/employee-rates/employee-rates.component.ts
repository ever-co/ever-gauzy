import { Component, OnInit, Input } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IEmployee, PayPeriodEnum, ICandidate, ICurrency } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs';
import { CandidateStore, EmployeeStore, Store } from '@gauzy/ui-core/core';
import { ActionConfirmationComponent } from '../../user';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-rates',
	templateUrl: 'employee-rates.component.html',
	styleUrls: ['employee-rates.component.scss'],
	standalone: false
})
export class EmployeeRatesComponent implements OnInit {
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
		private readonly candidateStore: CandidateStore,
		private readonly dialogService: NbDialogService,
		public readonly translateService: TranslateService
	) {}

	ngOnInit() {
		this.form.disable();
		this.employeeStore.selectedEmployee$
			.pipe(
				filter((employee: IEmployee) => !!employee),
				tap((employee: IEmployee) => {
					this.selectedEmployee = employee;
					this._syncRates(employee);
					this.form.enable();
				}),
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

		const hasCurrencyChanged = this.form.value.billRateCurrency !== this.selectedEmployee?.billRateCurrency;
		const hasRateChanged = this.form.value.billRateValue !== this.selectedEmployee?.billRateValue;

		if ((!hasCurrencyChanged && !hasRateChanged) || this.isCandidate) {
			await this._saveForm(organizationId);
			return;
		}

		let recordType = '';

		if (hasCurrencyChanged && hasRateChanged) {
			recordType = ` ${this.translateService.instant(
				'FORM.LABELS.CURRENCY_PER_HOUR'
			)} & ${this.translateService.instant('FORM.LABELS.BILL_RATE')}`;
		} else if (hasCurrencyChanged) {
			recordType = this.translateService.instant('FORM.LABELS.CURRENCY_PER_HOUR');
		} else if (hasRateChanged) {
			recordType = this.translateService.instant('FORM.LABELS.BILL_RATE');
		}

		const dialogRef = this.dialogService.open(ActionConfirmationComponent, {
			context: {
				recordType: ` ${recordType}`,
				extraText: `${this.translateService.instant('FORM.NOTIFICATIONS.RATE_EFFECTIVE_VALUE_CONFIRM')}`
			}
		});

		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (confirmed) => {
			if (confirmed) {
				await this._saveForm(organizationId);
			} else {
				this._syncRates(this.selectedEmployee);
			}
		});
	}

	private async _saveForm(organizationId: string) {
		const formData = {
			...this.form.getRawValue(),
			organizationId
		};

		if (this.isEmployee) {
			this.employeeStore.employeeForm = formData;
		}
		if (this.isCandidate) {
			this.candidateStore.candidateForm = formData;
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
}
