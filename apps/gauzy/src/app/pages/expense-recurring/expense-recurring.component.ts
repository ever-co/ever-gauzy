import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	IDateRangePicker,
	IOrganization,
	IOrganizationRecurringExpense,
	RecurringExpenseDefaultCategoriesEnum,
	RecurringExpenseDeletionEnum
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	Subject,
	firstValueFrom,
	debounceTime,
	tap,
	combineLatest
} from 'rxjs';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { TranslationBaseComponent } from '../../@shared/language-base';
import {
	OrganizationRecurringExpenseService,
	Store,
	ToastrService
} from '../../@core/services';
import { monthNames } from '../../@core/utils/date';
import {
	COMPONENT_TYPE,
	RecurringExpenseDeleteConfirmationComponent,
	RecurringExpenseMutationComponent
} from '../../@shared/expenses';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expense-recurring',
	templateUrl: './expense-recurring.component.html',
	styleUrls: [
		'./expense-recurring.component.scss',
		'../dashboard/dashboard.component.scss'
	]
})
export class ExpenseRecurringComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy
{
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

	showHistory: boolean = false;

	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private readonly store: Store,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.expenses$
			.pipe(
				debounceTime(300),
				tap(() => (this.loading = true)),
				tap(() => this._loadRecurringExpenses()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDateRange$ = this.store.selectedDateRange$;
		combineLatest([storeOrganization$, selectedDateRange$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				tap(([organization]) => (this.organization = organization)),
				distinctUntilChange(),
				tap(([organization, dateRange]) => {
					if (organization) {
						this.selectedDateRange = dateRange;
						this.expenses$.next(true);
					}
				}),
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
			? this.getTranslation(
					`EXPENSES_PAGE.DEFAULT_CATEGORY.${categoryName}`
			  )
			: categoryName;
	}

	async deleteOrgRecurringExpense() {
		const startDate = new Date(this.selectedDateRange.startDate);
		const selectedExpense = this.selectedRecurringExpense.data;
		const result: RecurringExpenseDeletionEnum = await firstValueFrom(
			this.dialogService.open(
				RecurringExpenseDeleteConfirmationComponent,
				{
					context: {
						recordType: 'Organization recurring expense',
						start: `${this.getMonthString(
							selectedExpense.startMonth
						)}, ${selectedExpense.startYear}`,
						current: `${this.getMonthString(
							startDate.getMonth()
						)}, ${startDate.getFullYear()}`,
						end: selectedExpense.endMonth
							? `${this.getMonthString(
									selectedExpense.endMonth
							  )}, ${selectedExpense.endYear}`
							: 'end'
					}
				}
			).onClose
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
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}

	async addOrganizationRecurringExpense() {
		const result = await firstValueFrom(
			this.dialogService.open(RecurringExpenseMutationComponent, {
				context: {
					componentType: COMPONENT_TYPE.ORGANIZATION
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
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}

	async editOrganizationRecurringExpense() {
		const result = await firstValueFrom(
			this.dialogService.open(RecurringExpenseMutationComponent, {
				context: {
					recurringExpense: this.selectedRecurringExpense.data,
					componentType: COMPONENT_TYPE.ORGANIZATION
				}
			}).onClose
		);
		if (result) {
			try {
				const id = this.selectedRecurringExpense.data.id;
				await this.organizationRecurringExpenseService.update(
					id,
					result
				);
				this.expenses$.next(true);

				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_RECURRING_EXPENSES.UPDATE_RECURRING_EXPENSE',
					{
						name: this.organization.name
					}
				);
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}

	private async _loadRecurringExpenses() {
		if (!this.organization) {
			return;
		}
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
			this.loading = false;
		} catch (error) {
			console.log(
				'Error while retriving organization recurring expenses',
				error
			);
		}
	}

	public async fetchHistory() {
		this.showHistory = !this.showHistory;
		this.fetchedHistories[this.selectedRecurringExpense.index] = (
			await this.organizationRecurringExpenseService.getAll(
				[],
				{
					parentRecurringExpenseId:
						this.selectedRecurringExpense.data
							.parentRecurringExpenseId
				},
				{
					startDate: 'ASC'
				}
			)
		).items;
	}

	selectRecurringExpense(
		recurringExpense: IOrganizationRecurringExpense,
		i: number
	) {
		this.showHistory = false;
		this.selectedRecurringExpense =
			this.selectedRecurringExpense.data &&
			recurringExpense.id === this.selectedRecurringExpense.data.id
				? {
						isSelected: !this.selectedRecurringExpense.isSelected,
						data: null,
						index: null
				  }
				: { isSelected: true, data: recurringExpense, index: i };
	}
}
