import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject, firstValueFrom, debounceTime, tap, combineLatest } from 'rxjs';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	ComponentType,
	IDateRangePicker,
	IOrganization,
	IOrganizationRecurringExpense,
	RecurringExpenseDefaultCategoriesEnum,
	RecurringExpenseDeletionEnum
} from '@gauzy/contracts';
import {
	DateRangePickerBuilderService,
	OrganizationRecurringExpenseService,
	Store,
	ToastrService,
	monthNames
} from '@gauzy/ui-core/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	IRecordViewSection,
	RecurringExpenseDeleteConfirmationComponent,
	RecurringExpenseMutationComponent
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-expense-recurring',
    templateUrl: './expense-recurring.component.html',
    styleUrls: ['./expense-recurring.component.scss', '../dashboard/dashboard.component.scss'],
    standalone: false
})
export class ExpenseRecurringComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	selectedDateRange: IDateRangePicker;
	expenses: IOrganizationRecurringExpense[] = [];
	fetchedHistories: any = {};
	loading: boolean;
	organization: IOrganization;
	expenses$: Subject<any> = new Subject();

	selectedRecurringExpense = {
		isSelected: false,
		data: null,
		index: null
	};

	/*
	 * Read-only View: a recurring expense is a small record, so it opens in the
	 * right-side drawer rather than on a page of its own.
	 */
	viewedRecurringExpense: IOrganizationRecurringExpense;
	viewSections: IRecordViewSection[] = [];

	showHistory: boolean = false;

	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService,
		public readonly route: ActivatedRoute
	) {
		super(translateService);
	}

	ngOnInit() {
		this.expenses$
			.pipe(
				debounceTime(300),
				tap(() => this._loadRecurringExpenses()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
		combineLatest([storeOrganization$, selectedDateRange$])
			.pipe(
				debounceTime(300),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				tap(([organization]) => (this.organization = organization)),
				distinctUntilChange(),
				tap(([organization, dateRange]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
				}),
				tap(() => this.expenses$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.addOrganizationRecurringExpense()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}

	getMonthString(month: number) {
		return monthNames[month];
	}

	getCategoryName(categoryName: string) {
		return categoryName in RecurringExpenseDefaultCategoriesEnum
			? this.getTranslation(`EXPENSES_PAGE.DEFAULT_CATEGORY.${categoryName}`)
			: categoryName;
	}

	async deleteOrgRecurringExpense() {
		const startDate = new Date(this.selectedDateRange.startDate);
		const selectedExpense = this.selectedRecurringExpense.data;
		const result: RecurringExpenseDeletionEnum = await firstValueFrom(
			this.dialogService.open(RecurringExpenseDeleteConfirmationComponent, {
				context: {
					recordType: 'Organization recurring expense',
					start: `${this.getMonthString(selectedExpense.startMonth)}, ${selectedExpense.startYear}`,
					current: `${this.getMonthString(startDate.getMonth())}, ${startDate.getFullYear()}`,
					end: selectedExpense.endMonth
						? `${this.getMonthString(selectedExpense.endMonth)}, ${selectedExpense.endYear}`
						: 'end'
				}
			}).onClose
		);

		if (result) {
			try {
				const id = selectedExpense.id;
				await this.organizationRecurringExpenseService.delete(id, {
					deletionType: result,
					month: startDate.getMonth(),
					year: startDate.getFullYear()
				});

				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_RECURRING_EXPENSES.DELETE_RECURRING_EXPENSE',
					{
						name: this.organization.name
					}
				);
				this.expenses$.next(true);
			} catch (error) {
				this.toastrService.danger(error.error.message || error.message, 'Error');
			}
		}
	}

	async addOrganizationRecurringExpense() {
		const result = await firstValueFrom(
			this.dialogService.open(RecurringExpenseMutationComponent, {
				context: {
					componentType: ComponentType.ORGANIZATION
				}
			}).onClose
		);

		if (result) {
			try {
				await this.organizationRecurringExpenseService.create({
					organizationId: this.organization.id,
					...result
				});

				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_RECURRING_EXPENSES.ADD_RECURRING_EXPENSE',
					{
						name: this.organization.name
					}
				);
				this.expenses$.next(true);
			} catch (error) {
				this.toastrService.danger(error.error.message || error.message, 'Error');
			}
		}
	}

	/**
	 * Opens the read-only View of the selected recurring expense in the right-side drawer.
	 */
	viewOrganizationRecurringExpense(): void {
		const expense: IOrganizationRecurringExpense = this.selectedRecurringExpense.data;
		if (!expense) {
			return;
		}

		this.viewSections = this.buildViewSections(expense);
		this.viewedRecurringExpense = expense;
	}

	closeView(): void {
		this.viewedRecurringExpense = null;
	}

	/**
	 * Field descriptor for the drawer — the block row's columns, read vertically,
	 * then the fields the row has no room for.
	 */
	private buildViewSections(expense: IOrganizationRecurringExpense): IRecordViewSection[] {
		return [
			{
				fields: [
					// Default categories are stored as enum keys — show them translated,
					// exactly as the block row does.
					{ label: 'POP_UPS.CATEGORY_NAME', value: this.getCategoryName(expense.categoryName) },
					{ label: 'POP_UPS.DATE', key: 'startDate', type: 'date' },
					{ label: 'POP_UPS.EXPENSE_VALUE', key: 'value', type: 'money' },
					{ label: 'EXPENSES_PAGE.SPLIT_EXPENSE', key: 'splitExpense', type: 'boolean' },
					{ label: 'SM_TABLE.END_DATE', key: 'endDate', type: 'date' }
				]
			}
		];
	}

	async editOrganizationRecurringExpense() {
		const result = await firstValueFrom(
			this.dialogService.open(RecurringExpenseMutationComponent, {
				context: {
					recurringExpense: this.selectedRecurringExpense.data,
					componentType: ComponentType.ORGANIZATION
				}
			}).onClose
		);
		if (result) {
			try {
				const id = this.selectedRecurringExpense.data.id;
				await this.organizationRecurringExpenseService.update(id, result);
				this.expenses$.next(true);

				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_RECURRING_EXPENSES.UPDATE_RECURRING_EXPENSE',
					{
						name: this.organization.name
					}
				);
			} catch (error) {
				this.toastrService.danger(error.error.message || error.message, 'Error');
			}
		}
	}

	private async _loadRecurringExpenses() {
		if (!this.organization) {
			return;
		}

		// The list is about to be reloaded: close the drawer AND drop the
		// selection — a kept selection would leave the toolbar enabled and let
		// View reopen a record object the reload has already detached.
		this.closeView();
		this.selectedRecurringExpense = { isSelected: false, data: null, index: null };

		this.loading = true;

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const { startDate, endDate } = this.selectedDateRange;

		try {
			this.fetchedHistories = {};
			this.expenses = (
				await this.organizationRecurringExpenseService.getAllByMonth({
					organizationId,
					tenantId,
					startDate,
					endDate
				})
			).items;
		} catch (error) {
			console.log('Error while retrieving organization recurring expenses', error);
		} finally {
			this.loading = false;
		}
	}

	public async fetchHistory() {
		this.showHistory = !this.showHistory;
		this.fetchedHistories[this.selectedRecurringExpense.index] = (
			await this.organizationRecurringExpenseService.getAll(
				[],
				{
					parentRecurringExpenseId: this.selectedRecurringExpense.data.parentRecurringExpenseId
				},
				{
					startDate: 'ASC'
				}
			)
		).items;
	}

	selectRecurringExpense(recurringExpense: IOrganizationRecurringExpense, i: number) {
		// Whatever the drawer is showing no longer matches the selection.
		this.closeView();
		this.showHistory = false;
		this.selectedRecurringExpense =
			this.selectedRecurringExpense.data && recurringExpense.id === this.selectedRecurringExpense.data.id
				? {
						isSelected: !this.selectedRecurringExpense.isSelected,
						data: null,
						index: null
				  }
				: { isSelected: true, data: recurringExpense, index: i };
	}
}
