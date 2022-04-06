import { Component, OnInit, ViewChild, Input, OnDestroy, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	OrganizationSelectInput,
	IRecurringExpenseModel,
	RecurringExpenseDefaultCategoriesEnum,
	StartDateUpdateTypeEnum,
	IEmployee,
	IOrganization,
	IExpenseCategory
} from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { debounceTime, filter, firstValueFrom, tap } from 'rxjs';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	EmployeeRecurringExpenseService,
	EmployeesService,
	ErrorHandlingService,
	ExpenseCategoriesStoreService,
	OrganizationRecurringExpenseService,
	OrganizationsService,
	Store,
	ToastrService
} from '../../../@core/services';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { defaultDateFormat } from '../../../@core/utils/date';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { COMPONENT_TYPE, DEFAULT_CATEGORIES } from './recurring-expense.setting';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-recurring-expense-mutation',
	templateUrl: './recurring-expense-mutation.component.html',
	styleUrls: ['./recurring-expense-mutation.component.scss']
})
export class RecurringExpenseMutationComponent extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	organization: IOrganization;

	@ViewChild('employeeSelector', { static: false })
	employeeSelector: EmployeeSelectorComponent;

	startDateUpdateType: StartDateUpdateTypeEnum = StartDateUpdateTypeEnum.NO_CHANGE;
	startDateChangeLoading = false;

	defaultFilteredCategories: {
		label: string;
		value: string;
	}[] = [];

	defaultCategories: {
		category: string;
		types: COMPONENT_TYPE[];
	}[] = DEFAULT_CATEGORIES;

	/*
	* Getter & Setter for dynamic enabled/disabled element
	*/
	_recurringExpense: IRecurringExpenseModel;
	get recurringExpense(): IRecurringExpenseModel {
		return this._recurringExpense;
	}
	@Input() set recurringExpense(recurringExpense: IRecurringExpenseModel) {
		if (recurringExpense) {
			this._recurringExpense = recurringExpense;
			this._initializeForm(recurringExpense);
		}	
	}
	
	componentType: COMPONENT_TYPE;
	conflicts: IRecurringExpenseModel[] = [];
	selectedOrganization: IOrganization;

	/*
	* Recurring Expense Mutation Form
	*/
	public form: FormGroup = RecurringExpenseMutationComponent.buildForm(this.fb, this);
	static buildForm(
		fb: FormBuilder,
		self: RecurringExpenseMutationComponent
	): FormGroup {
		const { startDate } = self.store.selectedDateRange;
		return fb.group({
			categoryName: [null, Validators.required],
			value: [null, Validators.required],
			currency: [
				{
					value: null,
					disabled: true
				},
				Validators.required
			],
			splitExpense: [false],
			startDate: [
				new Date(
					startDate.getFullYear(),
					startDate.getMonth(),
					1
				)
			]
		});
	}

	constructor(
		private readonly fb: FormBuilder,
		protected readonly dialogRef: NbDialogRef<RecurringExpenseMutationComponent>,
		private readonly organizationsService: OrganizationsService,
		private readonly store: Store,
		private readonly employeesService: EmployeesService,
		private readonly expenseCategoriesStore: ExpenseCategoriesStoreService,
		private readonly translate: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService
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
		return moment(date).subtract({ months: 1 }).format('MMM, YYYY');
	}

	month(date: string) {
		return moment(date).format('MMM, YYYY');
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				debounceTime(200),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this._loadDefaultCurrency()),
				untilDestroyed(this)
			)
			.subscribe();
		this.defaultFilteredCategories = this.defaultCategories
			.filter((c) => c.types.indexOf(this.componentType) > -1)
			.map((i) => ({
				value: i.category,
				label: this.getTranslatedExpenseCategory(i.category)
			}));
		this.expenseCategoriesStore.expenseCategories$
			.pipe(
				filter((categories: IExpenseCategory[]) => !!categories.length),
				tap((categories: IExpenseCategory[]) => this.mappedExpenseCategories(categories)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.expenseCategoriesStore.loadAll();
	}

	ngOnDestroy(): void {}

	/**
	 * Mapped Expense Categories
	 * 
	 * @param categories 
	 */
	mappedExpenseCategories(categories: IExpenseCategory[]) {
		const storedCategories: {
			label: string;
			value: string;
		}[] = [];
		for (let category of categories) {
			storedCategories.push({
				value: category.name,
				label: category.name
			});
		}
		this.defaultFilteredCategories = [
			...this.defaultFilteredCategories,
			...storedCategories
		];
	}

	submitForm() {
		if (this.form.valid) {
			this.closeAndSubmit();
		}
	}

	async closeAndSubmit() {
		if (!this.organization) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		let employee: IEmployee;
		if (this.recurringExpense && this.recurringExpense.employeeId) {
			employee = await this.employeesService.getEmployeeById(
				this.recurringExpense.employeeId
			);
		}	
		const { categoryName, startDate } = this.form.getRawValue();
		const payload = {
			...this.form.getRawValue(),
			categoryName: categoryName,
			startDay: startDate.getDate(),
			startMonth: startDate.getMonth(),
			startYear: startDate.getFullYear(),
			organizationId,
			tenantId
		};
		if (this.recurringExpense && this.recurringExpense.employeeId) {
			payload['employee'] = employee;
		} else {
			payload['employee'] = this.employeeSelector
				? this.employeeSelector.selectedEmployee
				: null;
		}
		this.dialogRef.close(payload);
	}

	getTranslatedExpenseCategory(categoryName) {
		return this.getTranslation(
			`EXPENSES_PAGE.DEFAULT_CATEGORY.${categoryName}`
		);
	}

	addCustomCategoryName(term) {
		return { value: term, label: term };
	}

	addNewCustomCategoryName = async (name: string): Promise<any> => {
		try {
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.ADD_EXPENSE_CATEGORY',
				{
					name
				}
			);
      		const createdCategory =  await firstValueFrom(this.expenseCategoriesStore.create(name));
			return {
				value: createdCategory.name,
				label: createdCategory.name
			};
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	private _initializeForm(recurringExpense?: any) {
		const { startDate } = this.store.selectedDateRange;
		this.form.patchValue({
			categoryName: recurringExpense ? recurringExpense.categoryName : '',
			value: recurringExpense ? recurringExpense.value : '',
			currency: recurringExpense ? recurringExpense.currency : '',
			splitExpense: recurringExpense && recurringExpense.splitExpense ? recurringExpense.splitExpense : false,
			startDate: recurringExpense && recurringExpense.startDate ? new Date(recurringExpense.startDate) : new Date(
				startDate.getFullYear(),
				startDate.getMonth(),
				1
			)
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
		const orgData = await firstValueFrom(this.organizationsService
			.getById(this.store.selectedOrganization.id, [
				OrganizationSelectInput.currency
			])
		);

		if (orgData && this.currency && !this.currency.value) {
			this.currency.setValue(orgData.currency);
			this.currency.updateValueAndValidity();
		}
	}

	close() {
		this.dialogRef.close();
	}
}
