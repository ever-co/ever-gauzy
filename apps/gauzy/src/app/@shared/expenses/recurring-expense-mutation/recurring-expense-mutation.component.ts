import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	CurrenciesEnum,
	OrganizationSelectInput,
	RecurringExpenseModel
} from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { first } from 'rxjs/operators';

import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';

export enum COMPONENT_TYPE {
	EMPLOYEE = 'EMPLOYEE',
	ORGANIZATION = 'ORGANIZATION'
}

@Component({
	selector: 'ga-recurring-expense-mutation',
	templateUrl: './recurring-expense-mutation.component.html',
	styleUrls: ['./recurring-expense-mutation.component.scss']
})
export class RecurringExpenseMutationComponent implements OnInit {
	public form: FormGroup;
	categoryNames = [];
	defaultCategories: {
		name: string;
		types: COMPONENT_TYPE[];
	}[] = [
		{
			name: 'Salary',
			types: [COMPONENT_TYPE.EMPLOYEE]
		},
		{
			name: 'Salary Taxes',
			types: [COMPONENT_TYPE.EMPLOYEE]
		},
		{
			name: 'Rent',
			types: [COMPONENT_TYPE.ORGANIZATION]
		},
		{
			name: 'Extra Bonus',
			types: [COMPONENT_TYPE.EMPLOYEE, COMPONENT_TYPE.ORGANIZATION]
		}
	];

	recurringExpense?: RecurringExpenseModel;
	componentType: COMPONENT_TYPE;
	currencies = Object.values(CurrenciesEnum);

	constructor(
		private fb: FormBuilder,
		protected dialogRef: NbDialogRef<RecurringExpenseMutationComponent>,
		private organizationsService: OrganizationsService,
		private store: Store
	) {}

	get currency() {
		return this.form.get('currency');
	}

	ngOnInit() {
		this.categoryNames = this.defaultCategories
			.filter((c) => c.types.indexOf(this.componentType) > -1)
			.map((i) => i.name);
		this.recurringExpense
			? this._initializeForm(this.recurringExpense)
			: this._initializeForm();
	}

	submitForm() {
		if (this.form.valid) {
			this.dialogRef.close(this.form.value);
		}
	}

	private _initializeForm(recurringExpense?: RecurringExpenseModel) {
		this.form = this.fb.group({
			categoryName: [
				recurringExpense ? recurringExpense.categoryName : '',
				Validators.required
			],
			value: [
				recurringExpense ? recurringExpense.value : '',
				Validators.required
			],
			currency: [
				recurringExpense ? recurringExpense.currency : '',
				Validators.required
			]
		});

		this._loadDefaultCurrency();
	}

	private async _loadDefaultCurrency() {
		const orgData = await this.organizationsService
			.getById(this.store.selectedOrganization.id, [
				OrganizationSelectInput.currency
			])
			.pipe(first())
			.toPromise();

		if (orgData && this.currency && !this.currency.value) {
			this.currency.setValue(orgData.currency);
		}
	}
}
