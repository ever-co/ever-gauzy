import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Params } from '@angular/router';
import {
	CurrenciesEnum,
	Employee,
	OrganizationSelectInput,
	PayPeriodEnum
} from '@gauzy/models';
import { EmployeeStore } from 'apps/gauzy/src/app/@core/services/employee-store.service';
import { OrganizationsService } from 'apps/gauzy/src/app/@core/services/organizations.service';
import { Subject, Subscription } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ga-edit-employee-rates',
	templateUrl: './edit-employee-rate.component.html',
	styleUrls: ['./edit-employee-rate.component.scss']
})
export class EditEmployeeRatesComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	paramSubscription: Subscription;
	hoverState: boolean;
	routeParams: Params;
	selectedEmployee: Employee;

	currencies = Object.values(CurrenciesEnum);
	payPeriods = Object.values(PayPeriodEnum);

	constructor(
		private fb: FormBuilder,
		private employeeStore: EmployeeStore,
		private readonly organizationsService: OrganizationsService
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

	private async _initializeForm(employee: Employee) {
		const currencyValue =
			employee.billRateCurrency ||
			(await this.getDefaultCurrency(employee));

		this.form = this.fb.group({
			payPeriod: [employee.payPeriod],
			billRateValue: [employee.billRateValue],
			billRateCurrency: [currencyValue],
			reWeeklyLimit: [
				employee.reWeeklyLimit,
				Validators.compose([Validators.min(1), Validators.max(128)])
			]
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	private async getDefaultCurrency(employee: Employee) {
		const orgData = await this.organizationsService
			.getById(employee.orgId, [OrganizationSelectInput.currency])
			.pipe(first())
			.toPromise();

		return orgData.currency;
	}
}
