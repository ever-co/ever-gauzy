import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	CurrenciesEnum,
	OrganizationSelectInput,
	RecurringExpenseModel,
	RecurringExpenseDefaultCategoriesEnum,
	StartDateUpdateTypeEnum
} from '@gauzy/models';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { first } from 'rxjs/operators';
import * as moment from 'moment';
import { IExpenseCategory } from './../../../../../../../libs/models/src/lib/expense-category.model';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { OrganizationRecurringExpenseService } from '../../../@core/services/organization-recurring-expense.service';
import { defaultDateFormat } from '../../../@core/utils/date';
import { EmployeeRecurringExpenseService } from '../../../@core/services/employee-recurring-expense.service';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { ExpenseCategoriesStoreService } from '../../../@core/services/expense-categories-store.service';

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

	startDateUpdateType: StartDateUpdateTypeEnum =
		StartDateUpdateTypeEnum.NO_CHANGE;

	startDateChangeLoading = false;

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
	selectedDate: Date;
	conflicts: RecurringExpenseModel[] = [];

	constructor(
		private fb: FormBuilder,
		protected dialogRef: NbDialogRef<RecurringExpenseMutationComponent>,
		private organizationsService: OrganizationsService,
		private store: Store,
		private readonly expenseCategoriesStore: ExpenseCategoriesStoreService,
		private translate: TranslateService,
		private readonly toastrService: NbToastrService,
		private errorHandler: ErrorHandlingService,
		private organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private employeeRecurringExpenseService: EmployeeRecurringExpenseService
	) {
		super(translate);
	}

	get currencyValue() {
		return this.form.get('currency').value;
	}

	get currency() {
		return this.form.get('currency');
	}

	get startDate() {
		return this.form.get('startDate').value;
	}

	get value() {
		return this.form.get('value').value;
	}

	formatToOrganizationDate(date: string) {
		return date
			? moment(date).format(
					this.store.selectedOrganization.dateFormat ||
						defaultDateFormat
			  )
			: 'end';
	}

	previousMonth(date: string) {
		return moment(date)
			.subtract({ months: 1 })
			.format('MMM, YYYY');
	}

	month(date: string) {
		return moment(date).format('MMM, YYYY');
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
			this.closeAndSubmit();
		}
	}

	closeAndSubmit() {
		let formValues = this.form.getRawValue();
		formValues = {
			...formValues,
			startDay: formValues.startDate.getDate(),
			startMonth: formValues.startDate.getMonth(),
			startYear: formValues.startDate.getFullYear()
		};
		this.dialogRef.close(formValues);
	}

	getTranslatedExpenseCategory(categoryName) {
		return this.getTranslation(
			`EXPENSES_PAGE.DEFAULT_CATEGORY.${categoryName}`
		);
	}

	addCustomCategoryName(term) {
		return { value: term, label: term };
	}

	addNewCustomCategoryName = (name: string): Promise<IExpenseCategory> => {
		try {
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.ADD_EXPENSE_CATEGORY',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			return this.expenseCategoriesStore.create(name).toPromise();
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

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
			],
			startDate: [
				recurringExpense && recurringExpense.startDate
					? new Date(recurringExpense.startDate)
					: new Date(
							this.selectedDate.getFullYear(),
							this.selectedDate.getMonth(),
							1
					  )
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

	async datePickerChanged(newValue: string) {
		this.startDateChangeLoading = true;
		if (
			newValue &&
			this.recurringExpense &&
			this.recurringExpense.startDate
		) {
			const newStartDate = new Date(newValue);
			const { value, conflicts } =
				this.componentType === COMPONENT_TYPE.ORGANIZATION
					? await this.organizationRecurringExpenseService.getStartDateUpdateType(
							{
								newStartDate,
								recurringExpenseId: this.recurringExpense.id
							}
					  )
					: await this.employeeRecurringExpenseService.getStartDateUpdateType(
							{
								newStartDate,
								recurringExpenseId: this.recurringExpense.id
							}
					  );
			this.startDateUpdateType = value;
			this.conflicts = conflicts;
		}
		this.startDateChangeLoading = false;
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
