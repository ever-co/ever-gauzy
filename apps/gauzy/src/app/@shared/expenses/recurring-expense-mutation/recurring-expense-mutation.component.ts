import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	CurrenciesEnum,
	OrganizationSelectInput,
	RecurringExpenseModel,
	RecurringExpenseDefaultCategoriesEnum
} from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { first } from 'rxjs/operators';

import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

export enum COMPONENT_TYPE {
	EMPLOYEE = 'EMPLOYEE',
	ORGANIZATION = 'ORGANIZATION'
}

@Component({
	selector: 'ga-recurring-expense-mutation',
	templateUrl: './recurring-expense-mutation.component.html',
	styleUrls: ['./recurring-expense-mutation.component.scss']
})
export class RecurringExpenseMutationComponent extends TranslationBaseComponent
	implements OnInit {
	public form: FormGroup;

	defaultFilteredCategories: {
		label: string;
		value: string;
	}[] = [];

	defaultCategories: {
		category: string;
		types: COMPONENT_TYPE[];
	}[] = [
		{
			category: RecurringExpenseDefaultCategoriesEnum.SALARY,
			types: [COMPONENT_TYPE.EMPLOYEE]
		},
		{
			category: RecurringExpenseDefaultCategoriesEnum.SALARY_TAXES,
			types: [COMPONENT_TYPE.EMPLOYEE]
		},
		{
			category: RecurringExpenseDefaultCategoriesEnum.RENT,
			types: [COMPONENT_TYPE.ORGANIZATION]
		},
		{
			category: RecurringExpenseDefaultCategoriesEnum.EXTRA_BONUS,
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
		private store: Store,
		private translate: TranslateService
	) {
		super(translate);
	}

	get currency() {
		return this.form.get('currency');
	}

	ngOnInit() {
		this.defaultFilteredCategories = this.defaultCategories
			.filter((c) => c.types.indexOf(this.componentType) > -1)
			.map((i) => ({
				value: i.category,
				label: this.getTranslatedExpenseCategory(i.category)
			}));

		this._initializeForm(this.recurringExpense);
	}

	submitForm() {
		if (this.form.valid) {
			this.dialogRef.close(this.form.getRawValue());
		}
	}

	getTranslatedExpenseCategory(categoryName) {
		return this.getTranslation(
			`EXPENSES_PAGE.DEFAULT_CATEGORY.${categoryName}`
		);
	}

	addCustomCategoryName(term) {
		return { value: term, label: term };
	}

	private _initializeForm(recurringExpense?: any) {
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
				{
					value: recurringExpense ? recurringExpense.currency : '',
					disabled: true
				},
				Validators.required
			],
			splitExpense: [
				recurringExpense && recurringExpense.splitExpense
					? recurringExpense.splitExpense
					: false
			]
		});

		if (
			recurringExpense &&
			!(
				recurringExpense.categoryName in
				RecurringExpenseDefaultCategoriesEnum
			)
		) {
			this.defaultFilteredCategories = [
				{
					value: recurringExpense.categoryName,
					label: recurringExpense.categoryName
				},
				...this.defaultFilteredCategories
			];
		}
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
