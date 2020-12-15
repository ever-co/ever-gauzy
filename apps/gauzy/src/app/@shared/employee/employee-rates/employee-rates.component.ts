import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Params } from '@angular/router';
import {
	IEmployee,
	OrganizationSelectInput,
	PayPeriodEnum,
	ICandidate,
	ICurrency
} from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Subscription } from 'rxjs';
import { first } from 'rxjs/operators';
import { CandidateStore } from '../../../@core/services/candidate-store.service';
import { EmployeeStore } from '../../../@core/services/employee-store.service';
import { OrganizationsService } from '../../../@core/services/organizations.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-rates',
	templateUrl: 'employee-rates.component.html',
	styleUrls: ['employee-rates.component.scss']
})
export class EmployeeRatesComponent implements OnInit, OnDestroy {
	@Input() public isEmployee: boolean;
	@Input() public isCandidate: boolean;

	form: FormGroup;
	paramSubscription: Subscription;
	hoverState: boolean;
	routeParams: Params;
	selectedEmployee: IEmployee;
	selectedCandidate: ICandidate;
	payPeriods = Object.values(PayPeriodEnum);

	constructor(
		private fb: FormBuilder,
		private employeeStore: EmployeeStore,
		private candidateStore: CandidateStore,
		private readonly organizationsService: OrganizationsService
	) {}

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(untilDestroyed(this))
			.subscribe((emp) => {
				this.selectedEmployee = emp;
				if (this.selectedEmployee) {
					this._initializeForm(this.selectedEmployee);
				}
			});
		this.candidateStore.selectedCandidate$
			.pipe(untilDestroyed(this))
			.subscribe((candidate) => {
				this.selectedCandidate = candidate;
				if (this.selectedCandidate) {
					this._initializeForm(this.selectedCandidate);
				}
			});
	}

	async submitForm() {
		if (this.form.valid && this.isEmployee) {
			this.employeeStore.employeeForm = {
				...this.form.value
			};
		}
		if (this.form.valid && this.isCandidate) {
			this.candidateStore.candidateForm = {
				...this.form.value
			};
		}
	}

	private async _initializeForm(role: IEmployee | ICandidate) {
		const currencyValue =
			role.billRateCurrency || (await this.getDefaultCurrency(role));

		this.form = this.fb.group({
			payPeriod: [role.payPeriod],
			billRateValue: [role.billRateValue],
			billRateCurrency: [currencyValue],
			reWeeklyLimit: [
				role.reWeeklyLimit,
				Validators.compose([Validators.min(1), Validators.max(128)])
			]
		});
	}

	ngOnDestroy() {}

	private async getDefaultCurrency(role: IEmployee | ICandidate) {
		const orgData = await this.organizationsService
			.getById(role.organizationId, [OrganizationSelectInput.currency])
			.pipe(first())
			.toPromise();

		return orgData.currency;
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}
}
