import { Component, OnDestroy, OnInit, Input, ChangeDetectionStrategy } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IEmployee, PayPeriodEnum, ICandidate, ICurrency, PermissionsEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import { CandidateStore, EmployeeStore } from '@gauzy/ui-core/core';

/** Whether two ids name the same employee, whatever their letter case. */
function isSameId(first: string | null | undefined, second: string | null | undefined): boolean {
	const bothSet = Boolean(first) && Boolean(second);
	if (!bothSet) {
		return false;
	}
	return first.toLowerCase() === second.toLowerCase();
}

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-employee-rates',
    templateUrl: 'employee-rates.component.html',
    styleUrls: ['employee-rates.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class EmployeeRatesComponent implements OnInit, OnDestroy {
	@Input() public isEmployee: boolean;
	@Input() public isCandidate: boolean;

	selectedEmployee: IEmployee;
	selectedCandidate: ICandidate;
	payPeriods = Object.values(PayPeriodEnum);

	/**
	 * Changing one's own rates needs CHANGE_OWN_RATES (super admins and admins by default). Without it, a person's
	 * own rates are shown read-only and they ask an admin; someone else's rates stay editable as before.
	 */
	public ownRatesLocked = false;

	/*
	 * Employee Rates Form
	 */
	public form: UntypedFormGroup = EmployeeRatesComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			payPeriod: [],
			billRateValue: ['', Validators.min(0)],
			billRateCurrency: [],
			reWeeklyLimit: ['', Validators.compose([Validators.min(0), Validators.max(168)])],
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
				tap((employee: IEmployee) => this._applyOwnRatesLock(employee)),
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

	private _applyOwnRatesLock(employee: IEmployee) {
		if (!this.isEmployee) {
			return;
		}
		const editsOwnRecord = isSameId(this.store.user?.employeeId, employee.id);
		const changesOwnRates = this.store.hasPermission(PermissionsEnum.CHANGE_OWN_RATES);
		this.ownRatesLocked = editsOwnRecord && !changesOwnRates;
		if (this.ownRatesLocked) {
			this.form.disable({ emitEvent: false });
			return;
		}
		this.form.enable({ emitEvent: false });
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

	ngOnDestroy() {}
}
