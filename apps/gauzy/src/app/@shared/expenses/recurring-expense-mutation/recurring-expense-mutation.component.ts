import { Component, OnInit, ViewChild, Input, OnDestroy, AfterViewInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { debounceTime, filter, firstValueFrom, tap } from 'rxjs';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	DateRangePickerBuilderService,
	EmployeeRecurringExpenseService,
	EmployeesService,
	ErrorHandlingService,
	ExpenseCategoriesStoreService,
	OrganizationRecurringExpenseService,
	ToastrService,
	defaultDateFormat
} from '@gauzy/ui-sdk/core';
import {
	ComponentType,
	IRecurringExpenseModel,
	RecurringExpenseDefaultCategoriesEnum,
	StartDateUpdateTypeEnum,
	IEmployee,
	IOrganization,
	IExpenseCategory
} from '@gauzy/contracts';
import { Store, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { DEFAULT_CATEGORIES } from './recurring-expense.setting';
import { EmployeeSelectorComponent } from '../../selectors/employee';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-recurring-expense-mutation',
	templateUrl: './recurring-expense-mutation.component.html',
	styleUrls: ['./recurring-expense-mutation.component.scss']
})
export class RecurringExpenseMutationComponent
	extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy
{
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
		types: ComponentType[];
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

	ComponentTypeEnum = ComponentType;
	componentType: ComponentType;
	conflicts: IRecurringExpenseModel[] = [];
	public organization: IOrganization;

	/*
	 * Recurring Expense Mutation Form
	 */
	public form: UntypedFormGroup = RecurringExpenseMutationComponent.buildForm(this.fb, this);
	static buildForm(fb: UntypedFormBuilder, self: RecurringExpenseMutationComponent): UntypedFormGroup {
		const { startDate } = self.dateRangePickerBuilderService.selectedDateRange;
		return fb.group({
			categoryName: [null, Validators.required],
			value: [null, Validators.required],
			currency: [null, Validators.required],
			splitExpense: [false],
			startDate: [new Date(startDate.getFullYear(), startDate.getMonth(), 1)]
		});
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		protected readonly dialogRef: NbDialogRef<RecurringExpenseMutationComponent>,
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly employeesService: EmployeesService,
		private readonly expenseCategoriesStore: ExpenseCategoriesStoreService,
		public readonly translate: TranslateService,
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
		return date ? moment(date).format(this.store.selectedOrganization.dateFormat || defaultDateFormat) : 'end';
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
				debounceTime(200),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.getExpenseCategories()),
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

	ngAfterViewInit(): void {}

	ngOnDestroy(): void {}

	/**
	 * GET expense categories by organization
	 *
	 * @returns
	 */
	getExpenseCategories() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;

		this.expenseCategoriesStore.loadAll({
			organizationId,
			tenantId
		});
	}

	/**
	 * Mapped Expense Categories
	 *
	 * @param categories
	 */
	mappedExpenseCategories(categories: IExpenseCategory[]) {
		const storedCategories: { label: string; value: string }[] = [];

		for (let category of categories) {
			storedCategories.push({
				value: category.name,
				label: category.name
			});
		}

		// Define a helper function to create a unique key based on label and name
		const getKey = (item: any) => `${item.label}-${item.value}`;

		// Merge the storedCategories with defaultFilteredCategories and filter out duplicates
		const mergedCategories = [...this.defaultFilteredCategories, ...storedCategories].reduce(
			(uniqueItems, item) => {
				// Generate a unique key for the current item
				const key = getKey(item);
				// If the key is not already present in the set, add the item to the set and to the result array
				if (!uniqueItems.set.has(key)) {
					uniqueItems.set.add(key);
					uniqueItems.result.push(item);
				}
				return uniqueItems;
			},
			{ set: new Set(), result: [] }
		).result;

		// Now, map the mergedCategories as needed
		const uniqueFilteredCategories = mergedCategories.map((item) => {
			// Perform any additional mapping or transformation if required
			return item;
		});

		// Update the defaultFilteredCategories with the uniqueFilteredCategories
		this.defaultFilteredCategories = uniqueFilteredCategories;
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
			employee = await firstValueFrom(this.employeesService.getEmployeeById(this.recurringExpense.employeeId));
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
			payload['employee'] = this.employeeSelector ? this.employeeSelector.selectedEmployee : null;
		}
		this.dialogRef.close(payload);
	}

	getTranslatedExpenseCategory(categoryName) {
		return this.getTranslation(`EXPENSES_PAGE.DEFAULT_CATEGORY.${categoryName}`);
	}

	addCustomCategoryName(term) {
		return { value: term, label: term };
	}

	addNewCustomCategory = async (name: string): Promise<any> => {
		if (!this.organization || !name) {
			return;
		}
		try {
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;

			const createdCategory = await firstValueFrom(
				this.expenseCategoriesStore.create({
					tenantId,
					organizationId,
					name
				})
			);
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.ADD_EXPENSE_CATEGORY',
				{
					name
				}
			);
			return {
				value: createdCategory.name,
				label: createdCategory.name
			};
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	private _initializeForm(recurringExpense?: any) {
		const { startDate } = this.dateRangePickerBuilderService.selectedDateRange;
		this.form.patchValue({
			categoryName: recurringExpense ? recurringExpense.categoryName : '',
			value: recurringExpense ? recurringExpense.value : '',
			currency: recurringExpense ? recurringExpense.currency : '',
			splitExpense: recurringExpense && recurringExpense.splitExpense ? recurringExpense.splitExpense : false,
			startDate:
				recurringExpense && recurringExpense.startDate
					? new Date(recurringExpense.startDate)
					: new Date(startDate.getFullYear(), startDate.getMonth(), 1)
		});
		if (recurringExpense && !(recurringExpense.categoryName in RecurringExpenseDefaultCategoriesEnum)) {
			this.defaultFilteredCategories = [
				{
					value: recurringExpense.categoryName,
					label: recurringExpense.categoryName
				},
				...this.defaultFilteredCategories
			];
			console.log(this.defaultFilteredCategories);
		}
	}

	async datePickerChanged(newValue: string) {
		this.startDateChangeLoading = true;
		if (newValue && this.recurringExpense && this.recurringExpense.startDate) {
			const newStartDate = new Date(newValue);
			const { value, conflicts } =
				this.componentType === ComponentType.ORGANIZATION
					? await this.organizationRecurringExpenseService.getStartDateUpdateType({
							newStartDate,
							recurringExpenseId: this.recurringExpense.id
					  })
					: await this.employeeRecurringExpenseService.getStartDateUpdateType({
							newStartDate,
							recurringExpenseId: this.recurringExpense.id
					  });
			this.startDateUpdateType = value;
			this.conflicts = conflicts;
		}
		this.startDateChangeLoading = false;
	}

	close() {
		this.dialogRef.close();
	}
}
